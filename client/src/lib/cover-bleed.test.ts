import assert from "node:assert/strict";
import test from "node:test";
import { fittedBox } from "./cover-bleed";

const cover = { width: 1600, height: 2000 };

test("a standard cover page fills the height and leaves the page color across the rest of the width", () => {
  const pageW = 960;
  const pageH = 600;
  const box = fittedBox(cover, pageW, pageH);
  assert.equal(box.y, 0);
  assert.equal(box.height, pageH);
  assert.ok(box.x > 0);
  assert.ok(box.x + box.width < pageW);
  assert.equal(box.x, (pageW - box.width) / 2);
});

test("a folded cover fills the half-sheet width so the page color can cover the rest of the height", () => {
  const halfW = 841.89 / 2;
  const sheetH = 595.28;
  const box = fittedBox(cover, halfW, sheetH);
  assert.ok(Math.abs(box.x) < 0.01);
  assert.ok(Math.abs(box.width - halfW) < 0.01);
  assert.ok(box.y > 0);
  assert.ok(box.y + box.height < sheetH);
});
