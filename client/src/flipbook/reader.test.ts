import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Willow title page has a Sing Along control wired to the song", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("./reader-runtime.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /WILLOW_SONG_AUDIO_URL/);
  assert.match(reader, /class="sing-along"/);
  assert.match(reader, /data-cue/);
  assert.match(reader, /WILLOW_SONG_END_CUE/);
  assert.match(reader, /Sing Along/);
  assert.match(runtime, /toggleSingAlong/);
  assert.match(runtime, /followSong/);
  assert.match(runtime, /pageForSongTime/);
  assert.match(runtime, /song\.ended/);
  assert.match(runtime, /end-page/);
  assert.match(runtime, /\.sing-along/);
  assert.match(css, /\.sing-along/);
});

test("desktop and landscape flip books keep a 2px top and bottom margin", async () => {
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(css, /--book-w:calc\(var\(--book-h\) \* 1\.4142137\)/);
  assert.doesNotMatch(css, /inset:2px 20px/);
  assert.match(css, /--book-gap:2px;/);
  const engine = await readFile(new URL("./facsimile-flipbook-engine.js", import.meta.url), "utf8");
  assert.match(engine, /var m = single \? Math\.max\(12, Math\.round\(H \* 0\.03\)\) : 2;/);
  assert.match(engine, /ph = avail;/);
  assert.doesNotMatch(engine, /sideRoom/);
  const rudolph = await readFile(new URL("../../public/flipbooks/rudolph-the-red-nosed-reindeer/index.html", import.meta.url), "utf8");
  const beThou = await readFile(new URL("../../public/flipbooks/be-thou-my-vision/index.html", import.meta.url), "utf8");
  assert.match(rudolph, /ph = avail;/);
  assert.match(beThou, /ph = avail;/);
  assert.match(css, /a\.viewport-close/);
  assert.match(css, /html\.mobile main/);
  assert.doesNotMatch(css, /--book-w:calc\(var\(--book-h\) \* 1\.6\)/);
});

test("the cover turns with the same leaf as the other pages", async () => {
  const runtime = await readFile(new URL("./reader-runtime.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.doesNotMatch(runtime, /openUnderCover/);
  assert.doesNotMatch(runtime, /cover-open-top/);
  assert.match(runtime, /animateLeaf/);
  assert.match(css, /html:not\(\.mobile\) \.front-cover-leaf\{[^}]*left:50%/);
});
