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
  assert.match(css, /html:not\(\.mobile\) main\{\s*position:absolute;\s*inset:2px 20px;/);
  assert.match(css, /--book-gap:2px;/);
  const engine = await readFile(new URL("./facsimile-flipbook-engine.js", import.meta.url), "utf8");
  assert.match(engine, /var m = single \? Math\.max\(12, Math\.round\(H \* 0\.03\)\) : 2;/);
});

test("the cover turns with the same leaf as the other pages", async () => {
  const runtime = await readFile(new URL("./reader-runtime.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.doesNotMatch(runtime, /openUnderCover/);
  assert.doesNotMatch(runtime, /cover-open-top/);
  assert.match(runtime, /animateLeaf/);
  assert.match(css, /html:not\(\.mobile\) \.front-cover-leaf\{[^}]*left:50%/);
});

test("Willow’s nap replaces The End and The End is the back cover", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /class="page nap-page"/);
  assert.match(reader, /willow-bear-nap\.webp/);
  assert.match(reader, /class="page end-page back-cover"/);
  assert.match(reader, /THE END/);
  assert.match(reader, /Read again/);
  const napAt = reader.indexOf('class="page nap-page"');
  const backAt = reader.indexOf('class="page end-page back-cover"');
  assert.ok(napAt > 0 && backAt > napAt);
  assert.match(css, /html:not\(\.mobile\) \.page\.back-cover \.back-cover-leaf\{[^}]*left:0/);
  assert.match(css, /html:not\(\.mobile\) \.page\.back-cover \.back-cover-leaf \.end-legal\{[^}]*bottom:14%/);
});
