import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { importPdfOnServer } from "./pdf-import";

test("importPdfOnServer renders each page as a facsimile JPEG", async () => {
  const pdfPath = path.join(process.cwd(), "media/pdfs/Willows-Big-Forest-Adventure.pdf");
  const copyDir = path.join(process.cwd(), ".books-data/test-import");
  await fs.mkdir(copyDir, { recursive: true });
  const copyPath = path.join(copyDir, "willow-copy.pdf");
  await fs.copyFile(pdfPath, copyPath);

  const { book } = await importPdfOnServer(copyPath, "Willows-Big-Forest-Adventure.pdf");
  assert.equal(book.pages.length, 10);
  assert.equal(book.pages[0]?.kind, "facsimile");
  assert.match(book.pages[0]?.imageAsset || "", /\.jpg$/i);
  assert.ok(book.pages[0]?.imageUrl.includes("/media/images/"));
});
