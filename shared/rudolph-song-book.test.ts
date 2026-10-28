import assert from "node:assert/strict";
import test from "node:test";
import {
  RUDOLPH_MUSIC_START_PDF_PAGE,
  RUDOLPH_PREFACE_PDF_PAGE,
  RUDOLPH_SONG_DURATION,
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
  assert.equal(RUDOLPH_SONG_PAGE_CUES.length, RUDOLPH_SONG_LAST_PDF_PAGE - RUDOLPH_MUSIC_START_PDF_PAGE + 1);
  for (let i = 1; i < RUDOLPH_SONG_PAGE_CUES.length; i += 1) {
    assert.ok(RUDOLPH_SONG_PAGE_CUES[i] > RUDOLPH_SONG_PAGE_CUES[i - 1]);
  }
  assert.equal(rudolphSongCueForPdfPage(RUDOLPH_MUSIC_START_PDF_PAGE), 0);
  assert.equal(rudolphSongCueForPdfPage(RUDOLPH_SONG_FIRST_PDF_PAGE), 23.46);
  assert.equal(rudolphSongCueForPdfPage(rudolphPdfPageForStoryPage(12)), 220.72);
});

test("the preface holds the longest part of the introduction", () => {
  const dwell = (pdfPage: number) => {
    const start = rudolphSongCueForPdfPage(pdfPage);
    const next = rudolphSongCueForPdfPage(pdfPage + 1);
    assert.equal(typeof start, "number");
    assert.equal(typeof next, "number");
    return (next as number) - (start as number);
  };
  const preface = dwell(RUDOLPH_PREFACE_PDF_PAGE);
  for (let page = RUDOLPH_MUSIC_START_PDF_PAGE; page < RUDOLPH_PREFACE_PDF_PAGE; page += 1) {
    assert.ok(preface > dwell(page));
  }
});

test("Rudolph sing-along follows the recording through the outro", () => {
  assert.equal(rudolphSongPdfPageForTime(0), RUDOLPH_MUSIC_START_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(12), RUDOLPH_PREFACE_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(23.96), rudolphPdfPageForStoryPage(1));
  assert.equal(rudolphSongPdfPageForTime(44.8), rudolphPdfPageForStoryPage(2));
  assert.equal(rudolphSongPdfPageForTime(125), rudolphPdfPageForStoryPage(6));
  assert.equal(rudolphSongPdfPageForTime(126.4), rudolphPdfPageForStoryPage(7));
  assert.equal(rudolphSongPdfPageForTime(233.5), rudolphPdfPageForStoryPage(13));
  assert.equal(rudolphSongPdfPageForTime(252.08), rudolphPdfPageForStoryPage(14));
  assert.equal(rudolphSongPdfPageForTime(360.28), RUDOLPH_SONG_LAST_PDF_PAGE);
  assert.equal(rudolphSongPdfPageForTime(RUDOLPH_SONG_LAST_WORD_AT), 25);
  assert.equal(rudolphSongPdfPageForTime(387.2), 26);
  assert.equal(rudolphSongPdfPageForTime(391), 27);
  assert.equal(rudolphSongPdfPageForTime(RUDOLPH_SONG_DURATION), 28);
  assert.equal(rudolphSingAlongConfig("/").firstPage, RUDOLPH_MUSIC_START_PDF_PAGE);
  assert.ok(rudolphSingAlongConfig("/").soundOffUrl.includes("sound-off.webp"));
  assert.equal(rudolphSingAlongConfig("/").singalongNoteText, "");
  assert.equal(rudolphSingAlongConfig("/").verselessBriefSpreads.length, 0);
  assert.equal(rudolphSingalongNoteMetrics(900, 1080).topPct, 43.52);
  assert.equal(rudolphSingalongNoteMetrics(1188, 1861).topPct, 91.1);
});
