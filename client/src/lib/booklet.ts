export type SheetSide = { left: number; right: number };

export type BookletSheet = { front: SheetSide; back: SheetSide };

export function paddedPageCount(count: number): number {
  return Math.max(4, Math.ceil(count / 4) * 4);
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
