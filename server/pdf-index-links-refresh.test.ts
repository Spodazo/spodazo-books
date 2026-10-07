import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { normalizeBookPage } from "../shared/seed-data";
import { refreshImportedPdfIndexLinks } from "./pdf-index-links-refresh";
import { JsonBookStore, resetStoreForTests } from "./storage";

test("refreshImportedPdfIndexLinks rewrites stored contents taps from the PDF", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-links-"));
  process.env.BOOKS_DATA_DIR = dir;
  resetStoreForTests();
  fs.mkdirSync(path.join(dir, "pdfs"), { recursive: true });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595, 842]).drawText("Songbook", { x: 72, y: 720, size: 28, font });
  const contents = pdf.addPage([595, 842]);
  contents.drawText("Contents", { x: 72, y: 760, size: 24, font });
  contents.drawText("01 First Light", { x: 90, y: 680, size: 16, font });
  contents.drawText("02 River Hymn", { x: 90, y: 640, size: 16, font });
  pdf.addPage([595, 842]).drawText("01 First Light", { x: 72, y: 720, size: 22, font });
  pdf.addPage([595, 842]).drawText("02 River Hymn", { x: 72, y: 720, size: 22, font });
  const pdfName = "evening-songs.pdf";
  fs.writeFileSync(path.join(dir, "pdfs", pdfName), await pdf.save());

  const store = new JsonBookStore();
  const created = await store.createBook({
    slug: "evening-songs",
    title: "Evening Songs",
    pdf: pdfName,
    pages: [
      normalizeBookPage({ id: "page-1", sourcePage: 1, kind: "facsimile", title: "Cover", imageAsset: "a.jpg" }, 0),
      normalizeBookPage({
        id: "page-2",
        sourcePage: 2,
        kind: "facsimile",
        title: "Contents",
        imageAsset: "b.jpg",
        links: [
          { page: 2, label: "01 First Light", top: 22, left: 12, width: 40, height: 3 },
          { page: 2, label: "02 River Hymn", top: 27, left: 12, width: 40, height: 3 },
        ],
      }, 1),
      normalizeBookPage({ id: "page-3", sourcePage: 3, kind: "facsimile", title: "01 First Light", imageAsset: "c.jpg" }, 2),
      normalizeBookPage({ id: "page-4", sourcePage: 4, kind: "facsimile", title: "02 River Hymn", imageAsset: "d.jpg" }, 3),
    ],
  });

  const count = await refreshImportedPdfIndexLinks(store);
  const book = await store.getBookById(created.id);
  const links = book?.pages[1]?.links || [];
  assert.equal(count, 1);
  assert.deepEqual(links.map((link) => link.page), [3, 4]);
  assert.ok(links[0].top < 20);

  delete process.env.BOOKS_DATA_DIR;
  resetStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});
