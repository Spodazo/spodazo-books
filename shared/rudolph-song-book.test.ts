import assert from "node:assert/strict";
import test from "node:test";
import {
  RUDOLPH_SONG_END_PAGE,
  RUDOLPH_SONG_FIRST_PAGE,
  RUDOLPH_SONG_IMAGE_CUES,
  RUDOLPH_SONG_LAST_WORD_AT,
  rudolphSongCueForImage,
  rudolphSongImageForTime,
} from "./rudolph-song-book";

test("Rudolph sing-along cues cover story images through The End", () => {
  assert.equal(RUDOLPH_SONG_IMAGE_CUES.length, RUDOLPH_SONG_END_PAGE - RUDOLPH_SONG_FIRST_PAGE + 1);
  for (let i = 1; i < RUDOLPH_SONG_IMAGE_CUES.length; i += 1) {
    assert.ok(RUDOLPH_SONG_IMAGE_CUES[i] > RUDOLPH_SONG_IMAGE_CUES[i - 1]);
  }
  assert.equal(rudolphSongCueForImage(RUDOLPH_SONG_FIRST_PAGE), RUDOLPH_SONG_IMAGE_CUES[0]);
  assert.ok(rudolphSongCueForImage(RUDOLPH_SONG_END_PAGE)! >= RUDOLPH_SONG_LAST_WORD_AT - 12);
});

test("Rudolph image lookup follows the recording", () => {
  assert.equal(rudolphSongImageForTime(0), 0);
  assert.equal(rudolphSongImageForTime(16), RUDOLPH_SONG_FIRST_PAGE);
  assert.equal(rudolphSongImageForTime(40), 5);
  assert.equal(rudolphSongImageForTime(470), RUDOLPH_SONG_END_PAGE);
  assert.equal(rudolphSongImageForTime(RUDOLPH_SONG_LAST_WORD_AT + 2), 20);
});
