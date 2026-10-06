import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { generateBundledSongbookHtml } from "./bundled-songbook";
import { BE_THOU_SONG_NAV } from "./song-nav";

const template = fs.readFileSync(
  path.resolve(process.cwd(), "client/public/flipbooks/songbook-template.html"),
  "utf8",
);

test("generated songbook html injects config and song nav", () => {
  const html = generateBundledSongbookHtml(template, {
    title: "Be Thou My Vision Songbook",
    imageCount: 18,
    ratio: 842.16 / 595.44,
    songNav: BE_THOU_SONG_NAV,
  });
  assert.match(html, /<title>Be Thou My Vision Songbook<\/title>/);
  assert.match(html, /var IMAGES = 18, TOTAL = 18/);
  assert.match(html, /var SONG_LIST_PAGE = 3;/);
  assert.match(html, /"label":"01 Be Thou My Vision"/);
  assert.match(html, /attachFlipbookMobileZoom/);
  assert.doesNotMatch(html, /%%TITLE%%/);
});
