/** Bundled Rudolph flipbook sing-along (matches images p-04 … p-19). */
export const RUDOLPH_SONG_AUDIO_ASSET = "rudolph-the-red-nosed-reindeer.mp3";
export const RUDOLPH_SONG_AUDIO_URL = `/media/audio/${RUDOLPH_SONG_AUDIO_ASSET}`;

/** First story page in the export (image p-04, verse “Up on the silver hills…”). */
export const RUDOLPH_SONG_FIRST_PAGE = 4;
/** “The End” spread (image p-19) once the last sung line begins. */
export const RUDOLPH_SONG_END_PAGE = 19;
/** Back cover while the instrumental outro plays. */
export const RUDOLPH_SONG_OUTRO_PAGE = 20;

/**
 * Seconds into the recording when each flipbook image should appear.
 * Index 0 → image 4, … index 14 → image 18, index 15 → image 19 (The End).
 * Timings were matched to `Rudloph the Red Nosed Reindeer-BEST.mp3`.
 */
export const RUDOLPH_SONG_IMAGE_CUES: readonly number[] = [
  15, 39, 87, 125, 160, 186, 210, 223, 247, 289, 318, 345, 378, 412, 446, 468,
];

/** Last sung words (“…sweet good night”) finish; outro may continue on later pages. */
export const RUDOLPH_SONG_LAST_WORD_AT = 478;
export const RUDOLPH_SONG_DURATION = 492;

export function rudolphSongCueForImage(imageNumber: number): number | undefined {
  if (imageNumber < RUDOLPH_SONG_FIRST_PAGE || imageNumber > RUDOLPH_SONG_END_PAGE) return undefined;
  return RUDOLPH_SONG_IMAGE_CUES[imageNumber - RUDOLPH_SONG_FIRST_PAGE];
}

export function rudolphSongImageForTime(seconds: number): number {
  let best = 0;
  for (let image = RUDOLPH_SONG_FIRST_PAGE; image <= RUDOLPH_SONG_END_PAGE; image += 1) {
    const cue = rudolphSongCueForImage(image);
    if (cue == null) continue;
    const lead = image === RUDOLPH_SONG_END_PAGE ? 0 : 0.35;
    if (seconds + lead >= cue) best = image;
  }
  if (seconds >= RUDOLPH_SONG_LAST_WORD_AT && seconds < RUDOLPH_SONG_DURATION) {
    return Math.max(best, RUDOLPH_SONG_OUTRO_PAGE);
  }
  return best;
}
