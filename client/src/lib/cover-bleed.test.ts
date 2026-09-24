import assert from "node:assert/strict";
import test from "node:test";
import { filledBox, fittedBox } from "./cover-bleed";

const cover = { width: 1600, height: 2000 };

test("inside pages stay letterboxed on a standard PDF page", () => {
  const pageW = 960;
  const pageH = 600;
  const box = fittedBox(cover, pageW, pageH);
  assert.equal(box.y, 0);
  assert.equal(box.height, pageH);
  assert.ok(box.x > 0);
  assert.equal(box.x, (pageW - box.width) / 2);
});

test("a standard cover fills the page width so background art reaches the sides", () => {
  const pageW = 960;
  const pageH = 600;
  const box = filledBox(cover, pageW, pageH);
  assert.equal(box.x, 0);
  assert.equal(box.width, pageW);
  assert.ok(box.height > pageH);
});
