import assert from "node:assert/strict";
import test from "node:test";
import { RUDOLPH_SLUG } from "./rudolph";
import {
  bookPrintPageDimensionsMm,
  bookUsesFacsimilePrintPages,
  FACSIMILE_PAGE_WIDTH_MM,
  scaleBookPrintPageDimensionsMm,
} from "./book-print-size";
import { FACSIMILE_A4_RATIO } from "./facsimile-flipbook";

test("bundled Rudolph pages are A4 facsimile print size", () => {
  const book = {
    slug: RUDOLPH_SLUG,
    pdf: "",
    pdfUrl: "",
    pages: [
      {
        id: "p1",
        kind: "facsimile" as const,
        imageAsset: "p-01.jpg",
        fullPageAsset: "p-01.jpg",
      },
    ],
  };
  assert.equal(bookUsesFacsimilePrintPages(book), true);
  const dims = bookPrintPageDimensionsMm(book);
  assert.equal(dims.widthMm, FACSIMILE_PAGE_WIDTH_MM);
  assert.equal(Math.round(dims.heightMm), Math.round(FACSIMILE_PAGE_WIDTH_MM * FACSIMILE_A4_RATIO));
});

test("layout story books use the standard PDF leaf size in millimeters", () => {
  const book = {
    slug: "Willows-Big-Forest-Adventure",
    pdf: "",
    pdfUrl: "",
    pages: [{ id: "p1", kind: "story" as const, imageAsset: "art.webp", fullPageAsset: "art.webp" }],
  };
  assert.equal(bookUsesFacsimilePrintPages(book), false);
  const dims = bookPrintPageDimensionsMm(book);
  assert.ok(Math.abs(dims.widthMm - 169.3) < 0.2);
  assert.ok(Math.abs(dims.heightMm - 211.7) < 0.2);
});

test("scaleBookPrintPageDimensionsMm keeps the book aspect ratio", () => {
  const book = { slug: RUDOLPH_SLUG, pdf: "", pdfUrl: "", pages: [] };
  const scaled = scaleBookPrintPageDimensionsMm(book, 105);
  assert.equal(scaled.widthMm, 105);
  assert.equal(scaled.heightMm, 105 * FACSIMILE_A4_RATIO);
});
