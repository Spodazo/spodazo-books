import assert from "node:assert/strict";
import test from "node:test";
import { bookletSheets, paddedPageCount, withOutsideBack } from "./booklet";

test("booklet sheets put the cover on the outside right and the last page on the outside left", () => {
  assert.equal(paddedPageCount(9), 12);
  const sheets = bookletSheets(8);
  assert.deepEqual(sheets[0], { front: { left: 7, right: 0 }, back: { left: 1, right: 6 } });
  assert.deepEqual(sheets[1], { front: { left: 5, right: 2 }, back: { left: 3, right: 4 } });
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
