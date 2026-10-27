/** Rudolph v3 PDF sing-along (28 leaves). Story pages 1–19 map to PDF pages 6–24. */
export const RUDOLPH_SONG_AUDIO_ASSET = "rudolph-the-red-nosed-reindeer.mp3";
export const RUDOLPH_SONG_AUDIO_URL = `/media/audio/${RUDOLPH_SONG_AUDIO_ASSET}`;

export const RUDOLPH_PDF_PAGE_COUNT = 28;
/** Printed story page 1 (“Up on the silver hills…”) is PDF page 6. */
export const RUDOLPH_STORY_PAGE_OFFSET = 5;

export const RUDOLPH_SONG_FIRST_PDF_PAGE = 1 + RUDOLPH_STORY_PAGE_OFFSET;
/** Printed story page 19 (final verse) is PDF page 24. */
export const RUDOLPH_SONG_LAST_PDF_PAGE = 19 + RUDOLPH_STORY_PAGE_OFFSET;
/** Outro leaves after the song (PDF pages 25–28). */
export const RUDOLPH_SONG_OUTRO_FIRST_PDF_PAGE = RUDOLPH_SONG_LAST_PDF_PAGE + 1;

/** @deprecated Use RUDOLPH_SONG_FIRST_PDF_PAGE */
export const RUDOLPH_SONG_FIRST_PAGE = RUDOLPH_SONG_FIRST_PDF_PAGE;
/** @deprecated Use RUDOLPH_SONG_LAST_PDF_PAGE */
export const RUDOLPH_SONG_END_PAGE = RUDOLPH_SONG_LAST_PDF_PAGE;
/** @deprecated Use RUDOLPH_SONG_OUTRO_FIRST_PDF_PAGE */
export const RUDOLPH_SONG_OUTRO_PAGE = RUDOLPH_SONG_OUTRO_FIRST_PDF_PAGE;

export function rudolphPdfPageForStoryPage(storyPage: number): number {
  return storyPage + RUDOLPH_STORY_PAGE_OFFSET;
}

/**
 * Seconds into the recording when each PDF page (6–24) should appear.
 * Matched to `Rudloph the Red Nosed Reindeer-BEST.mp3`.
 */
export const RUDOLPH_SONG_PAGE_CUES: readonly number[] = [
  0, 39, 87, 125, 160, 186, 210, 223, 247, 270, 289, 318, 345, 356, 378, 412, 425, 446, 468,
];

/** Seconds when the last sung words finish; outro plays on PDF pages 25–28. */
export const RUDOLPH_SONG_LAST_WORD_AT = 478;
export const RUDOLPH_SONG_DURATION = 492;

/** Outro page turns during the instrumental tail. */
export const RUDOLPH_SONG_OUTRO_CUES: readonly [number, number][] = [
  [478, 25],
  [484, 26],
  [488, 27],
  [491, 28],
];

export function rudolphSongCueForPdfPage(pdfPage: number): number | undefined {
  if (pdfPage < RUDOLPH_SONG_FIRST_PDF_PAGE || pdfPage > RUDOLPH_SONG_LAST_PDF_PAGE) return undefined;
  return RUDOLPH_SONG_PAGE_CUES[pdfPage - RUDOLPH_SONG_FIRST_PDF_PAGE];
}

/** @deprecated Use rudolphSongCueForPdfPage */
export function rudolphSongCueForImage(imageNumber: number): number | undefined {
  return rudolphSongCueForPdfPage(imageNumber);
}

export function rudolphSongPdfPageForTime(seconds: number): number {
  let best = 0;
  for (let page = RUDOLPH_SONG_FIRST_PDF_PAGE; page <= RUDOLPH_SONG_LAST_PDF_PAGE; page += 1) {
    const cue = rudolphSongCueForPdfPage(page);
    if (cue == null) continue;
    const lead = page === RUDOLPH_SONG_LAST_PDF_PAGE ? 0 : 0.35;
    if (seconds + lead >= cue) best = page;
  }
  for (const [at, page] of RUDOLPH_SONG_OUTRO_CUES) {
    if (seconds >= at) best = Math.max(best, page);
  }
  return best;
}

/** @deprecated Use rudolphSongPdfPageForTime */
export function rudolphSongImageForTime(seconds: number): number {
  return rudolphSongPdfPageForTime(seconds);
}

export const RUDOLPH_SINGALONG_NOTE_PAGE = 2;
export const RUDOLPH_SINGALONG_NOTE_TEXT = "This is a sing-along book.";

/** Story pages 11–12 (PDF 16–17) are art-only — show ~2s then advance to story page 13. */
export const RUDOLPH_VERSELESS_BRIEF_PDF_LEFT = rudolphPdfPageForStoryPage(11);
export const RUDOLPH_VERSELESS_BRIEF_PDF_RIGHT = rudolphPdfPageForStoryPage(12);
export const RUDOLPH_VERSELESS_BRIEF_MS = 2000;

export type RudolphSingalongNoteMetrics = {
  topPct: number;
  fontSizePct: number;
  color: string;
};

/** Percentages are relative to the displayed page image (see imageContentBox in the flipbook engine). */
export function rudolphSingalongNoteMetrics(imageWidth: number, imageHeight: number): RudolphSingalongNoteMetrics {
  const ratio = imageWidth / imageHeight;
  if (ratio < 0.75) {
    return { topPct: 91.1, fontSizePct: 1.182, color: "#6b0f28" };
  }
  return { topPct: 43.52, fontSizePct: 1.481, color: "#6a111f" };
}

export type RudolphSingAlongConfig = {
  audio: string;
  firstPage: number;
  endPage: number;
  outroFirstPage: number;
  lastWordAt: number;
  duration: number;
  cues: number[];
  outroCues: [number, number][];
  soundOnUrl: string;
  soundOffUrl: string;
  singalongNotePage: number;
  singalongNoteText: string;
  verselessBriefSpread: { left: number; right: number; dwellMs: number };
};

/** Payload for facsimile / bundled flipbook engines. */
export function rudolphSingAlongConfig(baseUrl = "/"): RudolphSingAlongConfig {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return {
    audio: RUDOLPH_SONG_AUDIO_URL,
    firstPage: RUDOLPH_SONG_FIRST_PDF_PAGE,
    endPage: RUDOLPH_SONG_LAST_PDF_PAGE,
    outroFirstPage: RUDOLPH_SONG_OUTRO_FIRST_PDF_PAGE,
    lastWordAt: RUDOLPH_SONG_LAST_WORD_AT,
    duration: RUDOLPH_SONG_DURATION,
    cues: [...RUDOLPH_SONG_PAGE_CUES],
    outroCues: [...RUDOLPH_SONG_OUTRO_CUES],
    soundOnUrl: `${root}flipbooks/rudolph-the-red-nosed-reindeer/sound-on.webp`,
    soundOffUrl: `${root}flipbooks/rudolph-the-red-nosed-reindeer/sound-off.webp`,
    singalongNotePage: RUDOLPH_SINGALONG_NOTE_PAGE,
    singalongNoteText: RUDOLPH_SINGALONG_NOTE_TEXT,
    verselessBriefSpread: {
      left: RUDOLPH_VERSELESS_BRIEF_PDF_LEFT,
      right: RUDOLPH_VERSELESS_BRIEF_PDF_RIGHT,
      dwellMs: RUDOLPH_VERSELESS_BRIEF_MS,
    },
  };
}
