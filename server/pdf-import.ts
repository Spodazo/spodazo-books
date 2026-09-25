import fs from "fs/promises";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
import { createCanvas } from "@napi-rs/canvas";

declare global {
  // PDF.js fake worker on Node reads this instead of loading ./pdf.worker.mjs from dist/.
  var pdfjsWorker: typeof pdfWorker | undefined;
}

globalThis.pdfjsWorker = pdfWorker;
import { detectStoryLayout } from "../client/src/flipbook/layout.js";
import { imagesDir, pdfsDir, uniqueFileName } from "./paths";
import { imageUrl, pdfUrl } from "./media";

const MAX_PAGES = 100;
const MAX_BYTES = 80 * 1024 * 1024;

export type ImportedPdfPage = {
  id: string;
  sourcePage: number;
  kind: "facsimile";
  title: string;
  paragraphs: string[];
  imageAsset: string;
  fullPageAsset: string;
  imageUrl: string;
  fullPageUrl: string;
  position: "bottom";
  focalPoint: string;
};

export type ImportedPdfBook = {
  schemaVersion: 1;
  title: string;
  pages: ImportedPdfPage[];
  pdfUrl: string;
};

function titleFromFilename(name: string): string {
  return (name || "New book").replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
}

export async function importPdfOnServer(
  pdfPath: string,
  originalName: string,
  onProgress?: (page: number, total: number) => void,
): Promise<{ book: ImportedPdfBook; pdfAsset: string }> {
  const stat = await fs.stat(pdfPath);
  if (stat.size > MAX_BYTES) throw new Error("PDF exceeds the 80 MB import limit.");
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const header = new TextDecoder().decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("This file is not a PDF.");

  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`Maximum ${MAX_PAGES} pages per book.`);
    const pages: ImportedPdfPage[] = [];
    await fs.mkdir(imagesDir(), { recursive: true });

    for (let i = 1; i <= doc.numPages; i += 1) {
      onProgress?.(i, doc.numPages);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items
        .filter((t) => "str" in t)
        .map((t) => {
          const text = t as { str: string; transform: number[] };
          const m = pdfjs.Util.transform(base.transform, text.transform);
          return { text: text.str, x: m[4], y: m[5], size: Math.hypot(m[2], m[3]) };
        });
      const layout = detectStoryLayout(items, base.width, base.height, "auto");
      const scale = Math.min(1800 / Math.max(base.width, base.height), Math.sqrt(4_000_000 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;

      const jpeg = canvas.toBuffer("image/jpeg", 91);
      const fileName = `page-${String(i).padStart(3, "0")}.jpg`;
      const dest = path.join(imagesDir(), uniqueFileName(imagesDir(), fileName));
      await fs.writeFile(dest, jpeg);
      const asset = path.basename(dest);
      const url = imageUrl(asset);

      pages.push({
        id: `page-${i}`,
        sourcePage: i,
        kind: "facsimile",
        title: layout?.title || `Page ${i}`,
        paragraphs: layout?.paragraphs || [],
        imageAsset: asset,
        fullPageAsset: asset,
        imageUrl: url,
        fullPageUrl: url,
        position: "bottom",
        focalPoint: "50% 50%",
      });
      page.cleanup();
    }

    const pdfAsset = path.basename(pdfPath);
    return {
      book: {
        schemaVersion: 1,
        title: titleFromFilename(originalName),
        pages,
        pdfUrl: pdfUrl(pdfAsset),
      },
      pdfAsset,
    };
  } finally {
    await doc.cleanup();
  }
}
