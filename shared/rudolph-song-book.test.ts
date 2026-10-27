import assert from "node:assert/strict";
import test from "node:test";
import {
  RUDOLPH_SONG_FIRST_PDF_PAGE,
  RUDOLPH_SONG_LAST_PDF_PAGE,
  RUDOLPH_SONG_PAGE_CUES,
  RUDOLPH_SONG_LAST_WORD_AT,
  RUDOLPH_STORY_PAGE_OFFSET,
  rudolphPdfPageForStoryPage,
  rudolphSingAlongConfig,
  rudolphSingalongNoteMetrics,
  rudolphSongCueForPdfPage,
  rudolphSongPdfPageForTime,
} from "./rudolph-song-book";

test("Rudolph story pages map onto the v3 PDF", () => {
  assert.equal(RUDOLPH_STORY_PAGE_OFFSET, 5);
  assert.equal(rudolphPdfPageForStoryPage(1), RUDOLPH_SONG_FIRST_PDF_PAGE);
  assert.equal(rudolphPdfPageForStoryPage(19), RUDOLPH_SONG_LAST_PDF_PAGE);
  assert.equal(RUDOLPH_SONG_PAGE_CUES.length, 19);
  for (let i = 1; i < RUDOLPH_SONG_PAGE_CUES.length; i += 1) {
    assert.ok(RUDOLPH_SONG_PAGE_CUES[i] > RUDOLPH_SONG_PAGE_CUES[i - 1]);
  }
  assert.equal(rudolphSongCueForPdfPage(RUDOLPH_SONG_FIRST_PDF_PAGE), RUDOLPH_SONG_PAGE_CUES[0]);
});

test("Rudolph sing-along follows the recording through the outro", () => {
  assert.equal(rudolphSongPdfPageForTime(0), RUDOLPH_SONG_FIRST_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(10), RUDOLPH_SONG_FIRST_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(38), RUDOLPH_SONG_FIRST_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(40), 7);
  assert.equal(rudolphSongPdfPageForTime(270), RUDOLPH_SONG_FIRST_PDF_PAGE + 9);
  assert.equal(rudolphSongPdfPageForTime(290), RUDOLPH_SONG_FIRST_PDF_PAGE + 10);
  assert.equal(rudolphSongPdfPageForTime(470), RUDOLPH_SONG_LAST_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(RUDOLPH_SONG_LAST_WORD_AT + 1), 25);
  assert.equal(rudolphSongPdfPageForTime(RUDOLPH_SONG_LAST_WORD_AT + 8), 26);
  assert.ok(rudolphSingAlongConfig("/").soundOffUrl.includes("sound-off.webp"));
  assert.equal(rudolphSingAlongConfig("/").singalongNoteText, "This is a sing-along book.");
  assert.equal(rudolphSingalongNoteMetrics(900, 1080).topPct, 43.52);
  assert.equal(rudolphSingalongNoteMetrics(1188, 1861).topPct, 91.1);
});
