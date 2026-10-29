import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKLET_BLEED_MM,
  bookletImpositionSlots,
  bookletPrintSheetFromPageSizeMm,
  bookletSheetFromPageWidthMm,
  bookletSheetSizeMm,
  bookletSheets,
  mmToPt,
  paddedPageCount,
  withOutsideBack,
} from "./booklet";

test("booklet sheets put the cover on the outside right and the last page on the outside left", () => {
  assert.equal(paddedPageCount(9), 12);
  const sheets = bookletSheets(8);
  assert.deepEqual(sheets[0], { front: { left: 7, right: 0 }, back: { left: 1, right: 6 } });
  assert.deepEqual(sheets[1], { front: { left: 5, right: 2 }, back: { left: 3, right: 4 } });
});

test("booklet sheet size follows page width in millimeters", () => {
  const [sheetW, sheetH] = bookletSheetFromPageWidthMm(148);
  assert.equal(sheetW, mmToPt(296));
  assert.equal(sheetH, mmToPt(148 * 1.25));
});

test("booklet print sheet adds bleed on the outer edges", () => {
  const [sheetW, sheetH] = bookletPrintSheetFromPageSizeMm(210, 297);
  assert.equal(sheetW, mmToPt(210 * 2 + BOOKLET_BLEED_MM * 2));
  assert.equal(sheetH, mmToPt(297 + BOOKLET_BLEED_MM * 2));
  const sizes = bookletSheetSizeMm(210, 297);
  assert.equal(sizes.trimSheetWidthMm, 420);
  assert.equal(sizes.printSheetWidthMm, 420 + BOOKLET_BLEED_MM * 2);
});

test("small booklets pad imposition so the title faces a blank, not the ending", () => {
  const slots = bookletImpositionSlots("cover", "back", ["title", "end"], "blank");
  assert.equal(slots.length, 32);
  assert.equal(slots[0], "cover");
  assert.equal(slots[31], "back");
  assert.equal(slots[1], "title");
  assert.equal(slots[2], "end");
  assert.equal(slots[30], "blank");
  const inside = bookletSheets(32)[0].back;
  assert.equal(slots[inside.left], "title");
  assert.equal(slots[inside.right], "blank");
});

test("a designed back cover stays on the outside left of the cover sheet", () => {
  const ordered = withOutsideBack(["front", "a", "b", "c", "d"], "back", "blank");
  assert.equal(ordered.length % 4, 0);
  assert.equal(ordered[0], "front");
  assert.equal(ordered[ordered.length - 1], "back");
  const outside = bookletSheets(ordered.length)[0].front;
  assert.equal(ordered[outside.right], "front");
  assert.equal(ordered[outside.left], "back");
});
