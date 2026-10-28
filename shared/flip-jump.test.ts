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

test("a phone turned sideways opens the two-page book and can pinch-zoom", async () => {
  const { readFile } = await import("node:fs/promises");
  const zoom = await readFile(new URL("../client/public/flipbooks/mobile-view-zoom.js", import.meta.url), "utf8");
  const start = zoom.indexOf("function decideFlipbookSingle");
  const end = zoom.indexOf("function wireFlipArrows");
  const decide = new Function(`${zoom.slice(start, end)}; return decideFlipbookSingle;`)() as (w: number, h: number) => boolean;
  assert.equal(decide(844, 390), false);
  assert.equal(decide(667, 375), false);
  assert.equal(decide(932, 430), false);
  assert.equal(decide(390, 844), true);
  assert.equal(decide(768, 1024), true);
  assert.equal(decide(1280, 800), false);
  assert.equal(decide(0, 800), true);
  assert.match(zoom, /touchPts\.size === 2/);
  assert.doesNotMatch(zoom, /isSingle\(\) && touchPts\.size === 2/);
  assert.doesNotMatch(zoom, /!isSingle\(\) \|\| viewScale <= 1/);
  for (const file of [
    "../client/public/flipbooks/be-thou-my-vision/index.html",
    "../client/public/flipbooks/rudolph-the-red-nosed-reindeer/index.html",
    "../client/src/flipbook/facsimile-flipbook-engine.js",
  ]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(src, /return decideFlipbookSingle\(W, H\)/);
    assert.doesNotMatch(src, /H < 520/);
    assert.match(src, /resetViewZoom\(\)/);
    assert.doesNotMatch(src, /if \(single\) resetViewZoom/);
  }
  const runtime = await readFile(new URL("../client/src/flipbook/reader-runtime.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../client/src/flipbook/reader.css", import.meta.url), "utf8");
  assert.match(runtime, /gesturePinch/);
  assert.match(runtime, /function applyViewZoom/);
  assert.match(runtime, /reader-zoomed/);
  assert.match(css, /html\.reader-zoomed \.page-curl/);
  assert.match(css, /pointer: coarse/);
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

test("Rudolph sing-along cues match shared/rudolph-song-book.ts", async () => {
  const { readFile } = await import("node:fs/promises");
  const { RUDOLPH_SONG_PAGE_CUES, RUDOLPH_MUSIC_START_PDF_PAGE, RUDOLPH_SONG_LAST_PDF_PAGE } = await import(
    "./rudolph-song-book",
  );
  const html = await readFile(
    new URL("../client/public/flipbooks/rudolph-the-red-nosed-reindeer/index.html", import.meta.url),
    "utf8",
  );
  const engine = await readFile(new URL("../client/src/flipbook/facsimile-flipbook-engine.js", import.meta.url), "utf8");
  const mount = await readFile(new URL("../client/src/flipbook/facsimile-flipbook.js", import.meta.url), "utf8");
  assert.match(html, /var SONG_FIRST = 2, SONG_END = 24/);
  const found = html.match(/var SONG_CUES = \[([\d.,\s]+)\]/)?.[1] || "";
  assert.deepEqual(
    found.split(",").map((n) => Number(n.trim())),
    [...RUDOLPH_SONG_PAGE_CUES],
  );
  assert.match(engine, /cfg\.singAlong/);
  assert.match(mount, /rudolphSingAlongConfig/);
  assert.equal(RUDOLPH_SONG_PAGE_CUES.length, RUDOLPH_SONG_LAST_PDF_PAGE - RUDOLPH_MUSIC_START_PDF_PAGE + 1);
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
  assert.match(html, /function clearSongHots/);
  assert.match(html, /\.page\.link \.hot-song \{ display: none; \}/);
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
  assert.match(html, /suppressTurnsUntil/);
  assert.match(html, /landPage/);
  assert.match(html, /function turnsSuppressed/);
  assert.match(html, /pointerType === 'mouse' && Date\.now\(\) < suppressTurnsUntil/);
});

test("in-app reader jumps on double-click zones and mobile edge taps", async () => {
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../client/src/flipbook/reader-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /function goToStart\(\)\{jumpTo\(0\);\}/);
  assert.match(runtime, /function goToEnd\(\)\{jumpTo\(pages\.length-1\);\}/);
  assert.match(runtime, /e\.detail>=2/);
  assert.match(runtime, /edgeJumpSide/);
});
