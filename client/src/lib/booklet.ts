export type SheetSide = { left: number; right: number };

export type BookletSheet = { front: SheetSide; back: SheetSide };

/** Matches rendered booklet leaves (800×1000 px). */
export const BOOKLET_PAGE_HEIGHT_PER_WIDTH = 1000 / 800;

export const BOOKLET_BLEED_MM = 3;

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

function assertPageSizeMm(pageWidthMm: number, pageHeightMm: number) {
  if (!Number.isFinite(pageWidthMm) || pageWidthMm <= 0 || !Number.isFinite(pageHeightMm) || pageHeightMm <= 0) {
    throw new Error("Booklet page size must be positive width and height in millimeters");
  }
}

/** Trim size: landscape sheet, two pages wide (PDF points). */
export function bookletTrimSheetFromPageSizeMm(pageWidthMm: number, pageHeightMm: number): [number, number] {
  assertPageSizeMm(pageWidthMm, pageHeightMm);
  return [mmToPt(pageWidthMm * 2), mmToPt(pageHeightMm)];
}

/** Print size including 3 mm bleed on the outer sheet edges (PDF points). */
export function bookletPrintSheetFromPageSizeMm(
  pageWidthMm: number,
  pageHeightMm: number,
  bleedMm = BOOKLET_BLEED_MM,
): [number, number] {
  assertPageSizeMm(pageWidthMm, pageHeightMm);
  return [mmToPt(pageWidthMm * 2 + bleedMm * 2), mmToPt(pageHeightMm + bleedMm * 2)];
}

/** @deprecated Use bookletTrimSheetFromPageSizeMm or bookletPrintSheetFromPageSizeMm. */
export function bookletSheetFromPageSizeMm(pageWidthMm: number, pageHeightMm: number): [number, number] {
  return bookletTrimSheetFromPageSizeMm(pageWidthMm, pageHeightMm);
}

/** @deprecated Prefer bookletSheetFromPageSizeMm with the book’s print height. */
export function bookletSheetFromPageWidthMm(pageWidthMm: number): [number, number] {
  return bookletSheetFromPageSizeMm(pageWidthMm, pageWidthMm * BOOKLET_PAGE_HEIGHT_PER_WIDTH);
}

export function bookletSheetSizeMm(
  pageWidthMm: number,
  pageHeightMm: number,
  bleedMm = BOOKLET_BLEED_MM,
): {
  trimSheetWidthMm: number;
  trimSheetHeightMm: number;
  printSheetWidthMm: number;
  printSheetHeightMm: number;
  bleedMm: number;
} {
  assertPageSizeMm(pageWidthMm, pageHeightMm);
  return {
    trimSheetWidthMm: pageWidthMm * 2,
    trimSheetHeightMm: pageHeightMm,
    printSheetWidthMm: pageWidthMm * 2 + bleedMm * 2,
    printSheetHeightMm: pageHeightMm + bleedMm * 2,
    bleedMm,
  };
}

export function paddedPageCount(count: number): number {
  return Math.max(4, Math.ceil(count / 4) * 4);
}

/**
 * Reading order with a designed back cover on the outside left.
 * Blank leaves are inserted before the back cover so the count stays a multiple of 4.
 */
export function withOutsideBack<T>(leaves: T[], back: T, blank: T): T[] {
  const front = leaves[0];
  const interiors = leaves.slice(1);
  const total = paddedPageCount(interiors.length + 2);
  const pads = Array.from({ length: total - interiors.length - 2 }, () => blank);
  return [front, ...interiors, ...pads, back];
}

/** Small saddle-stitch booklets pair early pages with late ones; pad to 32 slots so the title does not face the ending. */
export const BOOKLET_SMALL_IMPOSITION_SLOTS = 32;

export function bookletImpositionSlotCount(interiorCount: number): number {
  const contentSlots = interiorCount + 2;
  const padded = paddedPageCount(contentSlots);
  if (padded <= BOOKLET_SMALL_IMPOSITION_SLOTS) return BOOKLET_SMALL_IMPOSITION_SLOTS;
  return padded;
}

/** Cover at 0, back at last index, interiors at 1..n, remaining slots blank. */
export function bookletImpositionSlots<T>(cover: T, back: T, interiors: T[], blank: T): T[] {
  const total = bookletImpositionSlotCount(interiors.length);
  const slots: T[] = Array.from({ length: total }, () => blank);
  slots[0] = cover;
  slots[total - 1] = back;
  for (let i = 0; i < interiors.length; i += 1) slots[i + 1] = interiors[i];
  return slots;
}

/** Saddle-stitch sheets. Page indexes are zero-based and already padded to a multiple of 4. */
export function bookletSheets(pageCount: number): BookletSheet[] {
  if (pageCount < 4 || pageCount % 4 !== 0) throw new Error("Booklet page count must be a multiple of 4");
  const sheets: BookletSheet[] = [];
  for (let i = 0; i < pageCount / 4; i += 1) {
    sheets.push({
      front: { left: pageCount - 2 * i - 1, right: 2 * i },
      back: { left: 2 * i + 1, right: pageCount - 2 * i - 2 },
    });
  }
  return sheets;
}
