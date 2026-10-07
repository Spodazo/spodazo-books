import { isBundledFlipbookSlug } from "./bundled-flipbooks";
import { isOneLeafPdfPage } from "./page-layout";
import { facsimilePageLinks } from "./pdf-index-links";

export { facsimilePageLinks } from "./pdf-index-links";

/** A4 portrait height/width — same leaf ratio as Be Thou My Vision. */
export const FACSIMILE_A4_RATIO = 842.16 / 595.44;

export const FLIPBOOK_NAVY = {
  ground: "#021b3f",
  groundEdge: "#000d24",
  paper: "#022a58",
  gold: "#f1c27d",
} as const;

const STORY_DESK_DEFAULTS = new Set(["#bd9a61", "#efdda6", "#f0dfb3", "#203b2a"]);

function hexColor(raw?: string | null): string {
  const value = String(raw || "").trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(value) ? value : "";
}

function isStoryDeskDefault(color?: string | null): boolean {
  return !hexColor(color) || STORY_DESK_DEFAULTS.has(hexColor(color));
}

export function isFacsimileFlipbookListItem(book: { slug?: string; pdf?: string; pdfUrl?: string }): boolean {
  if (book.slug && isBundledFlipbookSlug(book.slug)) return false;
  return Boolean(String(book.pdfUrl || book.pdf || "").trim());
}

/** Uploaded PDF books use the Be Thou My Vision engine; bundled static books keep their own HTML. */
export function shouldUseFacsimileFlipbook(book: {
  slug?: string;
  pdf?: string;
  pdfUrl?: string;
  pages?: Array<{ kind?: string; imageAsset?: string; fullPageAsset?: string }>;
}): boolean {
  if (!isFacsimileFlipbookListItem(book)) return false;
  const pages = book.pages;
  if (!pages?.length) return true;
  return pages.every((page) =>
    page.kind === "facsimile" &&
    isOneLeafPdfPage({
      kind: "facsimile",
      imageAsset: page.imageAsset || "",
      fullPageAsset: page.fullPageAsset || "",
    }),
  );
}

/** Cover on the right, then paired leaves, last even page alone on the left — same as Be Thou My Vision. */
export function facsimileSpreads(pageCount: number): [number, number][] {
  const n = Math.max(0, Math.floor(Number(pageCount) || 0));
  if (n < 1) return [];
  const spreads: [number, number][] = [[0, 1]];
  for (let i = 2; i <= n; i += 2) {
    spreads.push([i, i + 1 <= n ? i + 1 : 0]);
  }
  return spreads;
}

export function facsimileFlipbookTheme(book: {
  spreadBackground?: string;
  pageBackground?: string;
  textColor?: string;
}): { ground: string; groundEdge: string; paper: string; gold: string } {
  return {
    ground: isStoryDeskDefault(book.spreadBackground) ? FLIPBOOK_NAVY.ground : hexColor(book.spreadBackground),
    groundEdge: FLIPBOOK_NAVY.groundEdge,
    paper: isStoryDeskDefault(book.pageBackground) ? FLIPBOOK_NAVY.paper : hexColor(book.pageBackground),
    gold: isStoryDeskDefault(book.textColor) ? FLIPBOOK_NAVY.gold : hexColor(book.textColor),
  };
}

export function facsimilePageUrls(pages: Array<{ fullPageUrl?: string; imageUrl?: string }>): string[] {
  return pages
    .map((page) => String(page.fullPageUrl || page.imageUrl || "").trim())
    .filter(Boolean);
}
