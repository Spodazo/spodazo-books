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
    "../client/src/flipbook/facsimile-flipbook-engine.js",
  ]) {
    const html = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(html, /function goToStart/);
    assert.match(html, /function goToEnd/);
    assert.match(html, /wireFlipArrows\(arrL, arrR/);
    assert.match(html, /onJump:/);
  }
});

test("uploaded PDF flipbooks mount contents taps from pageLinks", async () => {
  const { readFile } = await import("node:fs/promises");
  const engine = await readFile(new URL("../client/src/flipbook/facsimile-flipbook-engine.js", import.meta.url), "utf8");
  assert.match(engine, /PAGE_LINKS/);
  assert.match(engine, /function goToPageNumber/);
  assert.match(engine, /function mountIndexHots/);
  assert.match(engine, /hot-index/);
  assert.match(engine, /closest\("\.hot"\)/);
});

test("Be Thou song list taps live on the contents page", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
    new URL("../client/public/flipbooks/be-thou-my-vision/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /if \(n === 2\) \{\s*p\.classList\.add\('songs'\)/);
  assert.match(html, /label: '01 Be Thou My Vision'/);
  assert.match(html, /label: '10 All is Well'/);
  assert.match(html, /page: 4, top: 31\.53/);
  assert.equal([...html.matchAll(/label: ['"]/g)].length, 10);
});

test("Be Thou song-list jumps open the cover leaf (and lyrics for two-leaf songs)", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
    new URL("../client/public/flipbooks/be-thou-my-vision/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /function songPagePair\(n\) \{\s*return \[n, songFollowPage\(n\)\];\s*\}/);
  assert.match(html, /function songFollowPage\(n\)/);
  assert.match(html, /Two-leaf songs also show the lyrics leaf on the right/);
  assert.match(html, /suppressTurns/);
  assert.match(html, /landPage/);
  assert.match(html, /if \(suppressTurns\) return/);
});

test("in-app reader jumps on double-click zones and mobile edge taps", async () => {
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../client/src/flipbook/reader-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /function goToStart\(\)\{jumpTo\(0\);\}/);
  assert.match(runtime, /function goToEnd\(\)\{jumpTo\(pages\.length-1\);\}/);
  assert.match(runtime, /e\.detail>=2/);
  assert.match(runtime, /edgeJumpSide/);
});
