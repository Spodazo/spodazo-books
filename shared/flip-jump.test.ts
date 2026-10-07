import assert from "node:assert/strict";
import test from "node:test";
import { edgeJumpSide, FLIP_EDGE_MIN_PX, isDoubleTap } from "./flip-jump";

test("edgeJumpSide uses left and right bands", () => {
  assert.equal(edgeJumpSide(10, 390), -1);
  assert.equal(edgeJumpSide(380, 390), 1);
  assert.equal(edgeJumpSide(195, 390), 0);
  assert.equal(edgeJumpSide(FLIP_EDGE_MIN_PX, 200), -1);
  assert.equal(edgeJumpSide(FLIP_EDGE_MIN_PX + 1, 200), 0);
  assert.equal(edgeJumpSide(Math.floor(1400 * 0.18), 1400), -1);
  assert.equal(edgeJumpSide(Math.floor(1400 * 0.18) + 1, 1400), 0);
});

test("isDoubleTap requires the same edge within the window", () => {
  assert.equal(isDoubleTap(1000, -1, 1280, -1), true);
  assert.equal(isDoubleTap(1000, -1, 1280, 1), false);
  assert.equal(isDoubleTap(1000, -1, 1500, -1), false);
  assert.equal(isDoubleTap(1000, 0, 1100, 0), false);
});

test("bundled flipbooks jump on double-click arrows and mobile edges", async () => {
  const { readFile } = await import("node:fs/promises");
  const zoom = await readFile(new URL("../client/public/flipbooks/mobile-view-zoom.js", import.meta.url), "utf8");
  assert.match(zoom, /function wireFlipArrows/);
  assert.match(zoom, /opts\.onJump/);
  for (const file of [
    "../client/public/flipbooks/be-thou-my-vision/index.html",
    "../client/public/flipbooks/rudolph-the-red-nosed-reindeer/index.html",
  ]) {
    const html = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(html, /function goToStart/);
    assert.match(html, /function goToEnd/);
    assert.match(html, /wireFlipArrows\(arrL, arrR/);
    assert.match(html, /onJump:/);
  }
});

test("Be Thou song-list jumps open on the cover leaf, not the lyrics leaf", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
    new URL("../client/public/flipbooks/be-thou-my-vision/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /function songPagePair\(n\) \{\s*return \[n, 0\];\s*\}/);
  assert.match(html, /function songFollowPage\(n\)/);
  assert.match(html, /Song-list jumps always open on the cover\/title leaf/);
});

test("in-app reader jumps on double-click zones and mobile edge taps", async () => {
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../client/src/flipbook/reader-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /function goToStart\(\)\{jumpTo\(0\);\}/);
  assert.match(runtime, /function goToEnd\(\)\{jumpTo\(pages\.length-1\);\}/);
  assert.match(runtime, /e\.detail>=2/);
  assert.match(runtime, /edgeJumpSide/);
});
