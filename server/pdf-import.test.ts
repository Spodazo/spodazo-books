import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

test("importPdfOnServer turns a contents page into tappable song links", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const cover = pdf.addPage([595, 842]);
  cover.drawText("Songbook", { x: 72, y: 720, size: 28, font });
  const contents = pdf.addPage([595, 842]);
  contents.drawText("Contents", { x: 72, y: 760, size: 24, font });
  contents.drawText("01 First Light", { x: 90, y: 680, size: 16, font });
  contents.drawText("02 River Hymn", { x: 90, y: 640, size: 16, font });
  const song1 = pdf.addPage([595, 842]);
  song1.drawText("01 First Light", { x: 72, y: 720, size: 22, font });
  song1.drawText("Verse one of the first song.", { x: 72, y: 680, size: 14, font });
  const song2 = pdf.addPage([595, 842]);
  song2.drawText("02 River Hymn", { x: 72, y: 720, size: 22, font });
  song2.drawText("Verse one of the second song.", { x: 72, y: 680, size: 14, font });

  const copyDir = path.join(process.cwd(), ".books-data/test-import");
  await fs.mkdir(copyDir, { recursive: true });
  const pdfPath = path.join(copyDir, "song-list.pdf");
  await fs.writeFile(pdfPath, await pdf.save());

  const { book } = await importPdfOnServer(pdfPath, "Evening-Songs.pdf");
  const links = book.pages[1]?.links || [];
  assert.equal(book.pages.length, 4);
  assert.equal(links.length, 2);
  assert.equal(links[0].page, 3);
  assert.equal(links[1].page, 4);
  assert.match(links[0].label, /First Light/);
});
