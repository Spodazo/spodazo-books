import { RUDOLPH_LEGACY_SLUG, RUDOLPH_SLUG } from "./rudolph";

/** Static flipbook bundles shipped under client/public/flipbooks (exact exports, not Spodazo reader). */
export const BUNDLED_FLIPBOOKS = {
  [RUDOLPH_SLUG]: { dir: "rudolph-the-red-nosed-reindeer", pageCount: 20 },
  [RUDOLPH_LEGACY_SLUG]: { dir: "rudolph-the-red-nosed-reindeer", pageCount: 20 },
  "Be-Thou-My-Vision": { dir: "be-thou-my-vision", pageCount: 18 },
} as const;

export type BundledFlipbookSlug = keyof typeof BUNDLED_FLIPBOOKS;

function bundledFlipbook(slug: string) {
  return BUNDLED_FLIPBOOKS[slug as BundledFlipbookSlug];
}

export function isBundledFlipbookSlug(slug: string): slug is BundledFlipbookSlug {
  return slug in BUNDLED_FLIPBOOKS;
}

type BundlePageRef = {
  imageAsset?: string;
  fullPageAsset?: string;
  imageUrl?: string;
  fullPageUrl?: string;
};

function isStaticBundlePage(page: BundlePageRef): boolean {
  const url = `${page.imageUrl || ""} ${page.fullPageUrl || ""}`;
  if (url.includes("/flipbooks/")) return true;
  const asset = String(page.fullPageAsset || page.imageAsset || "").split("/").pop()?.split("?")[0] || "";
  return /^p-\d{2}\.(jpe?g|png|webp)$/i.test(asset);
}

/**
 * The static HTML flipbook is only for the shipped export.
 * An uploaded PDF on the same slug (Rudolph, Be Thou) opens that PDF instead.
 */
export function usesStaticBundledFlipbook(book: {
  slug?: string;
  pdf?: string;
  pdfUrl?: string;
  pages?: BundlePageRef[];
}): boolean {
  if (!book.slug || !isBundledFlipbookSlug(book.slug)) return false;
  const pages = book.pages || [];
  if (pages.length > 0 && pages.every((page) => isStaticBundlePage(page))) return true;
  if (pages.length > 0) return false;
  return !String(book.pdf || book.pdfUrl || "").trim();
}

function flipbookRoot(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** iframe `src` for a bundled flipbook, or empty when the app reader should mount. */
export function bundledFlipbookSrc(slug: string, baseUrl = "/", version = ""): string {
  const bundle = bundledFlipbook(slug);
  if (!bundle) return "";
  const src = `${flipbookRoot(baseUrl)}flipbooks/${bundle.dir}/index.html`;
  const build = String(version || "").trim();
  if (!build) return src;
  return `${src}?v=${encodeURIComponent(build)}`;
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

/** @deprecated Use bundledFlipbookPages(RUDOLPH_SLUG) */
export function rudolphFlipbookPages(baseUrl = "/"): BookPageLike[] {
  return bundledFlipbookPages(RUDOLPH_SLUG, baseUrl);
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
