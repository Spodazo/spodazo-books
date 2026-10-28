/** Rudolph v3 PDF sing-along (28 leaves). Story pages 1–19 map to PDF pages 6–24. */
export const RUDOLPH_SONG_AUDIO_ASSET = "rudolph-the-red-nosed-reindeer.mp3";
export const RUDOLPH_SONG_AUDIO_URL = `/media/audio/${RUDOLPH_SONG_AUDIO_ASSET}?v=20261028b`;

export const RUDOLPH_PDF_PAGE_COUNT = 28;
/** Printed story page 1 (“Up on the silver hills…”) is PDF page 6. */
export const RUDOLPH_STORY_PAGE_OFFSET = 5;

/** Music begins on the first interior leaf (PDF page 2), as the cover turns. */
export const RUDOLPH_MUSIC_START_PDF_PAGE = 2;
/** Preface is PDF page 5. It holds the longest share of the introduction. */
export const RUDOLPH_PREFACE_PDF_PAGE = 5;
export const RUDOLPH_SONG_FIRST_PDF_PAGE = 1 + RUDOLPH_STORY_PAGE_OFFSET;
/** Printed story page 19 (final verse) is PDF page 24. */
export const RUDOLPH_SONG_LAST_PDF_PAGE = 19 + RUDOLPH_STORY_PAGE_OFFSET;
/**
 * Numbered page 12 stays on screen until the held “all” has finished.
 * That note runs about nine seconds, ending near 242.5s. The turn is locked to 243s.
 */
export const RUDOLPH_PAGE12_HOLD_PDF_PAGE = 12 + RUDOLPH_STORY_PAGE_OFFSET;
export const RUDOLPH_PAGE12_HOLD_UNTIL = 243;

/** Outro leaves after the song (PDF pages 25–28). The boy at the window is PDF page 27; 28 is the back cover. */
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
 * Seconds when each PDF page from the first interior leaf (2) through the last lyric leaf (24) should appear.
 * Timed to Rudolph-the-red-nosed-reindeer.mp3: the introduction holds longest on the preface,
 * numbered page 1 arrives with the first verse. Numbered page 12 stays through the nine-second “all.”
 */
export const RUDOLPH_SONG_PAGE_CUES: readonly number[] = [
  0, 2.2, 5.8, 10, 22.96, 43.8, 75.94, 103.58, 105.08, 123.65, 125.67, 145.64, 167.08, 178.68, 196.72, 217.72, 243.35, 251.08, 273.28, 295.52, 316.88, 337.04, 359.28,
];

/** Seconds when the last sung words finish. The End, the cast, and the boy at the window follow. */
export const RUDOLPH_SONG_LAST_WORD_AT = 383.12;
/** The last 2 seconds fade out, then 2 seconds of silence. The back cover turns as the fade reaches silence. */
export const RUDOLPH_SONG_DURATION = 396.92;

/** Outro turns. The back cover (28) arrives as the fade reaches silence. */
export const RUDOLPH_SONG_OUTRO_CUES: readonly [number, number][] = [
  [382.12, 25],
  [386.2, 26],
  [390, 27],
  [393.92, 28],
];

export function rudolphSongCueForPdfPage(pdfPage: number): number | undefined {
  if (pdfPage < RUDOLPH_MUSIC_START_PDF_PAGE || pdfPage > RUDOLPH_SONG_LAST_PDF_PAGE) return undefined;
  return RUDOLPH_SONG_PAGE_CUES[pdfPage - RUDOLPH_MUSIC_START_PDF_PAGE];
}

/** @deprecated Use rudolphSongCueForPdfPage */
export function rudolphSongCueForImage(imageNumber: number): number | undefined {
  return rudolphSongCueForPdfPage(imageNumber);
}

export function rudolphSongPdfPageForTime(seconds: number): number {
  let best = 0;
  for (let page = RUDOLPH_MUSIC_START_PDF_PAGE; page <= RUDOLPH_SONG_LAST_PDF_PAGE; page += 1) {
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
export const RUDOLPH_SINGALONG_NOTE_TEXT = "";

export type RudolphVerselessBriefSpread = {
  left: number;
  right: number;
  dwellMs: number;
  /** Wait until the song reaches this PDF page before starting the dwell timer. */
  startAfterPdfPage?: number;
};

/** Art pages now follow the recording cues, so nothing is skipped on a timer. */
export const RUDOLPH_VERSELESS_BRIEF_SPREADS: readonly RudolphVerselessBriefSpread[] = [];

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
  verselessBriefSpreads: RudolphVerselessBriefSpread[];
  /** While this PDF page is visible, song-follow will not turn forward before `until` seconds. */
  pageHold: { pdfPage: number; until: number };
};

/** Payload for facsimile / bundled flipbook engines. */
export function rudolphSingAlongConfig(baseUrl = "/"): RudolphSingAlongConfig {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return {
    audio: RUDOLPH_SONG_AUDIO_URL,
    firstPage: RUDOLPH_MUSIC_START_PDF_PAGE,
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
    verselessBriefSpreads: [...RUDOLPH_VERSELESS_BRIEF_SPREADS],
    pageHold: { pdfPage: RUDOLPH_PAGE12_HOLD_PDF_PAGE, until: RUDOLPH_PAGE12_HOLD_UNTIL },
  };
}
