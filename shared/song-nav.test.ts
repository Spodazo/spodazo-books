import assert from "node:assert/strict";
import test from "node:test";
import { applyUniformSongSpacing, BE_THOU_SONG_NAV, defaultSpreads, parseSongNav } from "./song-nav";

test("defaultSpreads opens cover on the right and closes on the left", () => {
  assert.deepEqual(defaultSpreads(18), [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 0]]);
  assert.deepEqual(defaultSpreads(1), [[0, 1]]);
  assert.deepEqual(defaultSpreads(2), [[0, 1], [2, 0]]);
});

test("parseSongNav keeps Be Thou entries", () => {
  const parsed = parseSongNav(BE_THOU_SONG_NAV);
  assert.equal(parsed.songListPage, 3);
  assert.equal(parsed.entries.length, 10);
  assert.equal(parsed.entries[0]?.page, 4);
  assert.equal(parsed.entries[2]?.label, "03 Horsemen's Praise");
});

test("applyUniformSongSpacing matches Be Thou first/step", () => {
  const spaced = applyUniformSongSpacing(BE_THOU_SONG_NAV.entries);
  assert.equal(spaced[0]?.top, 53.6);
  assert.equal(spaced[1]?.top, 56.8);
  assert.equal(spaced[9]?.top, 82.4);
});
