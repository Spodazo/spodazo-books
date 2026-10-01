/** Static flipbook bundles shipped under client/public/flipbooks (exact exports, not Spodazo reader). */
const RUDOLPH_SLUG = "Rudolph-The-Red-Nosed-Reindeer";
const RUDOLPH_BASE = "/flipbooks/rudolph-the-red-nosed-reindeer/";

export function isBundledFlipbookSlug(slug: string): boolean {
  return slug === RUDOLPH_SLUG;
}

/** iframe `src` for a bundled flipbook, or empty when the app reader should mount. */
export function bundledFlipbookSrc(slug: string, baseUrl = "/"): string {
  if (!isBundledFlipbookSlug(slug)) return "";
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${root}flipbooks/rudolph-the-red-nosed-reindeer/index.html`;
}

export function bundledFlipbookCoverUrl(slug: string, baseUrl = "/"): string {
  if (!isBundledFlipbookSlug(slug)) return "";
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${root}flipbooks/rudolph-the-red-nosed-reindeer/pages/p-01.jpg`;
}

export function rudolphFlipbookPages(baseUrl = "/"): BookPageLike[] {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const prefix = `${root}flipbooks/rudolph-the-red-nosed-reindeer/pages/`;
  const pages: BookPageLike[] = [];
  for (let i = 1; i <= 20; i++) {
    const file = `p-${String(i).padStart(2, "0")}.jpg`;
    const url = `${prefix}${file}`;
    pages.push({
      id: `page-${i}`,
      sourcePage: i,
      kind: "facsimile",
      title: `Page ${i}`,
      paragraphs: [],
      imageAsset: file,
      fullPageAsset: file,
      imageUrl: url,
      fullPageUrl: url,
      position: "bottom",
      focalPoint: "50% 50%",
      elements: [],
      background: "",
    });
  }
  return pages;
}

type BookPageLike = {
  id: string;
  sourcePage: number;
  kind: "facsimile";
  title: string;
  paragraphs: [];
  imageAsset: string;
  fullPageAsset: string;
  imageUrl: string;
  fullPageUrl: string;
  position: "bottom";
  focalPoint: string;
  elements: [];
  background: string;
};
