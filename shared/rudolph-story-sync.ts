/**
 * Numbered story pages 16–19: last sung word on the page (turn after that note ends).
 * Used with scripts/rudolph-sync-story-cues.mjs against the v2 MP3.
 */
export const RUDOLPH_STORY_LAST_WORDS: Readonly<Record<number, string>> = {
  16: "light",
  17: "night",
  18: "glows",
  19: "night",
};

/** v2 recording: when each last word’s note finishes (seconds). Pages 1–15 use RUDOLPH_SONG_PAGE_CUES. */
export const RUDOLPH_STORY_LAST_WORD_END_AT: Readonly<Partial<Record<number, number>>> = {
  16: 314.5,
  17: 337.6,
  18: 362.4,
  19: 387.1,
};

/** PDF page when numbered story page N first appears (story page N−1 last word has finished). */
export function rudolphTurnToStoryPageFromLastWord(storyPage: number): number | undefined {
  if (storyPage < 2 || storyPage > 19) return undefined;
  const endAt = RUDOLPH_STORY_LAST_WORD_END_AT[storyPage - 1];
  return endAt;
}
