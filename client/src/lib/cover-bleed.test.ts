import assert from "node:assert/strict";
import test from "node:test";
import { filledBox, fitHeightBox, fittedBox, sideBleedStrip } from "./cover-bleed";

const cover = { width: 800, height: 1000 };

test("inside pages stay letterboxed on a standard PDF page", () => {
  const pageW = 960;
  const pageH = 600;
  const box = fittedBox(cover, pageW, pageH);
  assert.equal(box.y, 0);
  assert.equal(box.height, pageH);
  assert.ok(box.x > 0);
  assert.equal(box.x, (pageW - box.width) / 2);
});

test("cover-fit crops top and bottom on a landscape standard page", () => {
  const pageW = 960;
  const pageH = 600;
  const box = filledBox(cover, pageW, pageH);
  assert.ok(box.height > pageH);
  assert.notEqual(box.y, 0);
});

test("height-fit keeps the full cover and leaves equal side gaps", () => {
  const pageW = 960;
  const pageH = 600;
  const box = fitHeightBox(cover, pageW, pageH);
  assert.equal(box.y, 0);
  assert.equal(box.height, pageH);
  assert.equal(box.width, 480);
  assert.equal(box.leftGap, 240);
  assert.equal(box.rightGap, 240);
});

test("side bleed uses a narrow strip from the cover edge", () => {
  assert.equal(sideBleedStrip(800), 64);
  assert.equal(sideBleedStrip(100), 8);
});
