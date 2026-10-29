import { usesStaticBundledFlipbook } from "./bundled-flipbooks";
import { FACSIMILE_A4_RATIO, shouldUseFacsimileFlipbook } from "./facsimile-flipbook";
import { isOneLeafPdfPage } from "./page-layout";
import type { PublicBook } from "./types";

/** ISO A4 portrait width — facsimile PDF pages and bundled flipbook JPEGs. */
export const FACSIMILE_PAGE_WIDTH_MM = 210;

/** Layout story pages in `downloadStandardBookPdf` (480×600 pt). */
export const LAYOUT_PAGE_WIDTH_PT = 480;
export const LAYOUT_PAGE_HEIGHT_PT = 600;

export type BookPrintPageDimensionsMm = { widthMm: number; heightMm: number };

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

export function bookUsesFacsimilePrintPages(
  book: Pick<PublicBook, "slug" | "pdf" | "pdfUrl" | "pages">,
): boolean {
  if (usesStaticBundledFlipbook(book) || shouldUseFacsimileFlipbook(book)) return true;
  const pages = book.pages || [];
  if (!pages.length) return false;
  return pages.every((page) =>
    page.kind === "facsimile" &&
    isOneLeafPdfPage({
      kind: page.kind,
      imageAsset: page.imageAsset,
      fullPageAsset: page.fullPageAsset,
    }),
  );
}

export function bookPrintPageDimensionsMm(
  book: Pick<PublicBook, "slug" | "pdf" | "pdfUrl" | "pages">,
): BookPrintPageDimensionsMm {
  if (bookUsesFacsimilePrintPages(book)) {
    const widthMm = FACSIMILE_PAGE_WIDTH_MM;
    return { widthMm, heightMm: widthMm * FACSIMILE_A4_RATIO };
  }
  return {
    widthMm: ptToMm(LAYOUT_PAGE_WIDTH_PT),
    heightMm: ptToMm(LAYOUT_PAGE_HEIGHT_PT),
  };
}

export function scaleBookPrintPageDimensionsMm(
  book: Pick<PublicBook, "slug" | "pdf" | "pdfUrl" | "pages">,
  pageWidthMm: number,
): BookPrintPageDimensionsMm {
  const base = bookPrintPageDimensionsMm(book);
  const scale = pageWidthMm / base.widthMm;
  return { widthMm: pageWidthMm, heightMm: base.heightMm * scale };
}
