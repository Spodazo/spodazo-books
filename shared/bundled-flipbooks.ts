/** Static flipbook bundles shipped under client/public/flipbooks (exact exports, not Spodazo reader). */
export const BUNDLED_FLIPBOOKS = {
  "Rudolph-The-Red-Nosed-Reindeer": { dir: "rudolph-the-red-nosed-reindeer", pageCount: 20 },
  "Be-Thou-My-Vision": { dir: "be-thou-my-vision", pageCount: 18 },
} as const;

export type BundledFlipbookSlug = keyof typeof BUNDLED_FLIPBOOKS;

function bundledFlipbook(slug: string) {
  return BUNDLED_FLIPBOOKS[slug as BundledFlipbookSlug];
}

export function isBundledFlipbookSlug(slug: string): slug is BundledFlipbookSlug {
  return slug in BUNDLED_FLIPBOOKS;
}

function flipbookRoot(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** iframe `src` for a bundled flipbook, or empty when the app reader should mount. */
export function bundledFlipbookSrc(slug: string, baseUrl = "/"): string {
  const bundle = bundledFlipbook(slug);
  if (!bundle) return "";
  return `${flipbookRoot(baseUrl)}flipbooks/${bundle.dir}/index.html`;
}

export function runtimeBundledFlipbookSrc(dir: string, baseUrl = "/"): string {
  const name = String(dir || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!name) return "";
  return `${flipbookRoot(baseUrl)}media/bundled-flipbooks/${name}/index.html`;
}

export function bundledFlipbookSrcForBook(
  book: { slug?: string; bundledFlipbookDir?: string },
  baseUrl = "/",
): string {
  const staticSrc = bundledFlipbookSrc(String(book.slug || ""), baseUrl);
  if (staticSrc) return staticSrc;
  return runtimeBundledFlipbookSrc(book.bundledFlipbookDir || "", baseUrl);
}

export function bundledFlipbookCoverUrl(slug: string, baseUrl = "/"): string {
  const bundle = bundledFlipbook(slug);
  if (!bundle) return "";
  return `${flipbookRoot(baseUrl)}flipbooks/${bundle.dir}/pages/p-01.jpg`;
}

export function bundledFlipbookPages(slug: string, baseUrl = "/"): BookPageLike[] {
  const bundle = bundledFlipbook(slug);
  if (!bundle) return [];
  const root = flipbookRoot(baseUrl);
  const prefix = `${root}flipbooks/${bundle.dir}/pages/`;
  const pages: BookPageLike[] = [];
  for (let i = 1; i <= bundle.pageCount; i++) {
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

/** @deprecated Use bundledFlipbookPages("Rudolph-The-Red-Nosed-Reindeer") */
export function rudolphFlipbookPages(baseUrl = "/"): BookPageLike[] {
  return bundledFlipbookPages("Rudolph-The-Red-Nosed-Reindeer", baseUrl);
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
