import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { localPdfPath } from "./media";
import { dataDir, pdfsDir } from "./paths";
import { applyReplacementPdf, enqueuePdfReplace } from "./replace-book-pdf";
import type { BookStore } from "./storage";

/** Desktop upload “Rudolph the Red Nosed Reindeer -v1.pdf” (28 pages). */
export const RUDOLPH_V3_SHA256 = "8ad1c427abfa9f8029b823454f18d9a3ad4e31bb96db0e4a15208bd50cdad0ba";

export function bundledRudolphPdfPath(): string {
  return path.resolve(process.cwd(), "media/pdfs/rudolph-v3.pdf");
}

function markerPath(): string {
  return path.join(dataDir(), `rudolph-pdf-${RUDOLPH_V3_SHA256.slice(0, 12)}.applied`);
}

export function fileSha256(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

/**
 * Apply the bundled v3 once. A later upload (marker already written, file hash different)
 * is left alone. The same v3 file is skipped.
 */
export function shouldApplyBundledRudolph(currentSha: string | null, markerExists: boolean): boolean {
  if (currentSha === RUDOLPH_V3_SHA256) return false;
  if (markerExists) return false;
  return true;
}

/** Put the uploaded v3 PDF on the live Rudolph book if that upload never landed. */
export async function ensureRudolphCurrentPdf(store: BookStore): Promise<void> {
  const bundled = bundledRudolphPdfPath();
  if (!fs.existsSync(bundled)) return;
  const list = await store.listBooks();
  const item = list.find((book) => /^rudolph$/i.test(book.slug || ""));
  if (!item) return;
  const book = await store.getBookById(item.id);
  if (!book) return;
  const currentPath = book.pdf ? localPdfPath(book.pdf) : null;
  const currentSha = currentPath && fs.existsSync(currentPath) ? fileSha256(currentPath) : null;
  const marker = markerPath();
  if (!shouldApplyBundledRudolph(currentSha, fs.existsSync(marker))) return;

  const destName = `rudolph-v3-${RUDOLPH_V3_SHA256.slice(0, 12)}.pdf`;
  const dest = path.join(pdfsDir(), destName);
  await fs.promises.mkdir(pdfsDir(), { recursive: true });
  if (!fs.existsSync(dest) || fileSha256(dest) !== RUDOLPH_V3_SHA256) {
    await fs.promises.copyFile(bundled, dest);
  }
  const revision = `v3${RUDOLPH_V3_SHA256.slice(0, 8)}`;
  console.log("[catalog] Rudolph revised PDF was not the saved PDF. Rendering that upload onto the book.");
  enqueuePdfReplace(book.id, async () => {
    const saved = await applyReplacementPdf(store, book.id, dest, "Rudolph the Red Nosed Reindeer -v1.pdf", revision);
    await fs.promises.mkdir(dataDir(), { recursive: true });
    await fs.promises.writeFile(marker, `${saved.pdf}\n`);
    console.log(`[catalog] Rudolph is now ${saved.pageCount} pages from the revised PDF`);
  });
}
