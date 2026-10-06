import { defaultSpreads, parseSongNav, type SongNav } from "./song-nav";

export const A4_PORTRAIT_RATIO = 297 / 210;

export type BundledSongbookHtmlInput = {
  title: string;
  imageCount: number;
  ratio?: number;
  songNav?: SongNav | unknown;
  spreads?: number[][];
  zoomScriptSrc?: string;
  extraLinkPage?: boolean;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateBundledSongbookHtml(template: string, input: BundledSongbookHtmlInput): string {
  const imageCount = Math.max(1, Math.floor(input.imageCount));
  const extra = Boolean(input.extraLinkPage);
  const total = extra ? imageCount + 1 : imageCount;
  const ratio = Number.isFinite(input.ratio) && Number(input.ratio) > 0 ? Number(input.ratio) : A4_PORTRAIT_RATIO;
  const spreads = input.spreads?.length ? input.spreads : defaultSpreads(imageCount);
  const songNav = parseSongNav(input.songNav);
  const title = escapeHtml(String(input.title || "Songbook").trim() || "Songbook");
  const zoom = String(input.zoomScriptSrc || "../mobile-view-zoom.js");
  return template
    .replaceAll("%%TITLE%%", title)
    .replaceAll("%%ZOOM_SRC%%", zoom)
    .replaceAll("%%IMAGES%%", String(imageCount))
    .replaceAll("%%TOTAL%%", String(total))
    .replaceAll("%%RATIO%%", String(ratio))
    .replaceAll("%%SP%%", JSON.stringify(spreads))
    .replaceAll("%%SONG_LIST_PAGE%%", String(songNav.songListPage || 0))
    .replaceAll("%%SONG_NAV%%", JSON.stringify(songNav.entries));
}

export function pageFileName(index: number): string {
  return `p-${String(index).padStart(2, "0")}.jpg`;
}
