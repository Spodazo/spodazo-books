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
  assert.deepEqual(
    spaced.map((entry) => entry.top),
    BE_THOU_SONG_NAV.entries.map((entry) => entry.top),
  );
  assert.equal(spaced[0]?.top, 53.3);
  assert.equal(spaced[1]?.top, 55.5);
  assert.equal(spaced[7]?.top, 68.8);
  assert.equal(spaced[9]?.top, 73.3);
});

test("Be Thou hotspots cover measured Forward title centers", () => {
  const height = 2.15;
  // Midpoints of the printed title glyphs on pages/p-03.jpg (percent of page height).
  const centers = [54.4, 56.6, 58.8, 61.0, 63.3, 65.5, 67.8, 70.0, 72.2, 74.4];
  assert.equal(BE_THOU_SONG_NAV.entries.length, centers.length);
  BE_THOU_SONG_NAV.entries.forEach((entry, index) => {
    const top = entry.top;
    const bottom = top + height;
    assert.ok(
      top <= centers[index] && bottom >= centers[index],
      `${entry.label} hotspot ${top}–${bottom} misses title center ${centers[index]}`,
    );
  });
});
