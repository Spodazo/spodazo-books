export type SongNavEntry = {
  page: number;
  top: number;
  label: string;
};

export type SongNav = {
  songListPage: number;
  entries: SongNavEntry[];
};

/** Be Thou Forward list: first row and gap between printed titles. */
export const SONG_NAV_FIRST_TOP = 53.3;
export const SONG_NAV_STEP = 2.22;
/** Cover long titles such as "House of Many Mansions" (~62% across). */
export const SONG_HOT_LEFT = 7;
export const SONG_HOT_WIDTH = 56;
export const SONG_HOT_LAST_HEIGHT = 2.4;

export const BE_THOU_SONG_NAV: SongNav = {
  songListPage: 3,
  entries: [
    { page: 4, top: 53.3, label: "01 Be Thou My Vision" },
    { page: 6, top: 55.5, label: "02 House of Many Mansions" },
    { page: 7, top: 57.7, label: "03 Horsemen's Praise" },
    { page: 8, top: 60.0, label: "04 Planted by the Stream" },
    { page: 10, top: 62.2, label: "05 Garment of Praise" },
    { page: 11, top: 64.4, label: "06 Grounded in Love" },
    { page: 12, top: 66.6, label: "07 Firm Foundation" },
    { page: 14, top: 68.8, label: "08 Grace for Grace" },
    { page: 15, top: 71.1, label: "09 Friend of Sinners" },
    { page: 16, top: 73.3, label: "10 All is Well" },
  ],
};

export function emptySongNav(): SongNav {
  return { songListPage: 0, entries: [] };
}

export function applyUniformSongSpacing(
  entries: SongNavEntry[],
  firstTop = SONG_NAV_FIRST_TOP,
  step = SONG_NAV_STEP,
): SongNavEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    top: Math.round((firstTop + index * step) * 10) / 10,
  }));
}

export function defaultSpreads(imageCount: number): number[][] {
  const count = Math.max(0, Math.floor(imageCount));
  const spreads: number[][] = [[0, count >= 1 ? 1 : 0]];
  let i = 2;
  while (i <= count) {
    if (i === count) {
      spreads.push([i, 0]);
      break;
    }
    spreads.push([i, i + 1]);
    i += 2;
  }
  return spreads;
}

/** Hit box from this title down to the next, so the list has no dead gaps. */
export function songHotspotBand(
  entries: SongNavEntry[],
  index: number,
): { top: number; height: number } {
  const song = entries[index];
  if (!song) return { top: 0, height: 0 };
  const next = entries[index + 1];
  const bottom = next ? next.top : song.top + SONG_HOT_LAST_HEIGHT;
  return { top: song.top, height: Math.max(0.8, Math.round((bottom - song.top) * 10) / 10) };
}

/**
 * Open a song with that page on the left. If the next leaf is another song,
 * leave the right side empty so the previous/next title is not the first thing seen.
 */
export function songJumpPair(
  page: number,
  imageCount: number,
  songStartPages: number[],
): [number, number] {
  const n = Math.floor(Number(page) || 0);
  if (n < 1) return [0, 0];
  const right = n + 1;
  if (right > imageCount || songStartPages.includes(right)) return [n, 0];
  return [n, right];
}

export function parseSongNav(raw: unknown): SongNav {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const songListPage = Math.max(0, Math.floor(Number(obj.songListPage) || 0));
  const list = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: SongNavEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const page = Math.floor(Number(row.page) || 0);
    const top = Number(row.top);
    const label = String(row.label || "").trim();
    if (page < 1 || !Number.isFinite(top)) continue;
    entries.push({ page, top, label: label || `Page ${page}` });
  }
  return { songListPage, entries };
}
