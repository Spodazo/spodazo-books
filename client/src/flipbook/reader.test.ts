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

test("Willow’s front cover is the supplied page", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  const song = await readFile(new URL("../../../shared/willow-song-book.ts", import.meta.url), "utf8");
  assert.match(song, /willow-front-cover\.webp/);
  assert.match(reader, /WILLOW_FRONT_COVER_URL/);
  assert.match(reader, /class="front-cover-art"/);
  assert.match(css, /\.front-cover-art\{[^}]*object-fit:cover/);
});

test("back covers sit alone on the right for every book", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /function backCoverPageHtml/);
  assert.match(reader, /endPageHtml\(book,baseUrl,credits,copyright,logoUrl\)\+backCoverPageHtml\(book,baseUrl,credits,copyright,logoUrl\)/);
  assert.match(reader, /class="page end-page back-cover/);
  assert.match(reader, /class="back-cover-leaf"/);
  assert.match(reader, /class="read-again">Read again/);
  assert.match(reader, /legalHtml\(credits, copyright, logoUrl, baseUrl, book\.date\)/);
  assert.match(reader, /book\.backCoverLayout/);
  assert.match(css, /html:not\(\.mobile\) \.back-cover-leaf\{[^}]*left:50%;/);
  assert.doesNotMatch(css, /html:not\(\.mobile\) \.back-cover-leaf\{[^}]*left:0;/);
  assert.match(css, /\.mobile \.back-cover-leaf\{[^}]*inset:0/);
  assert.match(css, /\.back-cover-leaf::after\{[^}]*inset 0 0 20px #00000033/);
  assert.match(css, /\.page\.back-cover \.back-cover-leaf > \.read-again\{[^}]*top:57%/);
});

test("Willow’s The End sits on the nap’s left leaf, not the back cover", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /willow-bear-nap\.webp/);
  assert.match(reader, /class="nap-leaf nap-leaf-blank"><p class="nap-end">The End<\/p>/);
  assert.match(reader, /class="nap-leaf nap-leaf-art"/);
  assert.match(reader, /willow-back-cover\.webp/);
  assert.doesNotMatch(reader, /back-cover-art" src="\$\{src\}" alt=""><h1 class="end-title">/);
  assert.match(css, /html:not\(\.mobile\) \.nap-leaf-art\{[^}]*left:50%/);
  assert.match(css, /\.nap-end\{[^}]*JuiceBox Script/);
  assert.match(css, /\.nap-picture\{[^}]*object-fit:cover/);
});

test("Willow’s front cover sits on the dark brown stage", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /front-cover willow-front/);
  assert.match(css, /html\.willow:not\(\.mobile\) \.page\.front-cover\.willow-front\{[^}]*background:#322616!important/);
});

test("Willow’s title page keeps the author and date apart", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /function separatedTitleCredits/);
  assert.match(reader, /willow-title/);
  assert.match(reader, /author\.y = 78/);
  assert.match(reader, /date\.y = 88/);
  assert.match(css, /page\.willow-title>\.el-text\[data-role="author"\][\s\S]{0,700}top:78%!important/);
  assert.match(css, /page\.willow-title>\.el-text\[data-role="date"\][\s\S]{0,400}top:88%!important/);
  assert.match(css, /white-space:nowrap/);
});
