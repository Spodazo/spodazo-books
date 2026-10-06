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
export const SONG_NAV_FIRST_TOP = 53.6;
export const SONG_NAV_STEP = 3.2;

export const BE_THOU_SONG_NAV: SongNav = {
  songListPage: 3,
  entries: [
    { page: 4, top: 53.6, label: "01 Be Thou My Vision" },
    { page: 6, top: 56.8, label: "02 House of Many Mansions" },
    { page: 7, top: 60.0, label: "03 Horsemen's Praise" },
    { page: 8, top: 63.2, label: "04 Planted by the Stream" },
    { page: 10, top: 66.4, label: "05 Garment of Praise" },
    { page: 11, top: 69.6, label: "06 Grounded in Love" },
    { page: 12, top: 72.8, label: "07 Firm Foundation" },
    { page: 14, top: 76.0, label: "08 Grace for Grace" },
    { page: 15, top: 79.2, label: "09 Friend of Sinners" },
    { page: 16, top: 82.4, label: "10 All is Well" },
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
