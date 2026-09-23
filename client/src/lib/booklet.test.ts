import assert from "node:assert/strict";
import test from "node:test";
import { bookletSheets, paddedPageCount } from "./booklet";

test("booklet sheets put the cover on the outside right and the last page on the outside left", () => {
  assert.equal(paddedPageCount(9), 12);
  const sheets = bookletSheets(8);
  assert.deepEqual(sheets[0], { front: { left: 7, right: 0 }, back: { left: 1, right: 6 } });
  assert.deepEqual(sheets[1], { front: { left: 5, right: 2 }, back: { left: 3, right: 4 } });
});
