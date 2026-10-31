import assert from "node:assert/strict";
import test from "node:test";
import { RUDOLPH_STORY_LAST_WORD_END_AT, rudolphTurnToStoryPageFromLastWord } from "./rudolph-story-sync";
import { RUDOLPH_SONG_PAGE_CUES, RUDOLPH_MUSIC_START_PDF_PAGE } from "./rudolph-song-book";

test("story pages 17–19 turn when the prior page last word ends", () => {
  for (const storyPage of [17, 18, 19] as const) {
    const pdfPage = storyPage + 5;
    const idx = pdfPage - RUDOLPH_MUSIC_START_PDF_PAGE;
    assert.equal(RUDOLPH_SONG_PAGE_CUES[idx], RUDOLPH_STORY_LAST_WORD_END_AT[storyPage - 1]);
  }
  assert.equal(rudolphTurnToStoryPageFromLastWord(17), RUDOLPH_STORY_LAST_WORD_END_AT[16]);
});
