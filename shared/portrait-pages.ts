import { clampPercent, hasLayout, normalizeElement, normalizeLayout, remapSpreadBoxToLeaf } from "./page-layout";
import { visibleStoryPages } from "./reader-pages";
import type { Book, PageElement, PageLayout } from "./types";

/** Width / height of a full-screen upright phone page in the flipbook (390×844 reference). */
export const PORTRAIT_PAGE_RATIO = 390 / 844;

/** Space under the cover leaf for the flipbook note (matches reader.css). */
export const PORTRAIT_COVER_HINT_REM = 4.75;

export const PORTRAIT_COVER_HINT_TEXT = "Please turn your phone for our flipbook version";

export function isWillowBook(book: Pick<Book, "slug" | "title">): boolean {
  return /willow/i.test(String(book.slug || "")) || /willow/i.test(String(book.title || ""));
}

export function portraitCoverHintPx(rootFontSizePx = 16): number {
  return PORTRAIT_COVER_HINT_REM * rootFontSizePx;
}

/** Full phone viewport height for a given content width. */
export function portraitPhoneViewportHeight(width: number): number {
  return width / PORTRAIT_PAGE_RATIO;
}

/** Cover leaf height inside the phone viewport (flipbook cover page). */
export function portraitCoverLeafHeight(width: number, rootFontSizePx = 16): number {
  return Math.max(120, portraitPhoneViewportHeight(width) - portraitCoverHintPx(rootFontSizePx));
}

export function portraitPageKind(layout: PageLayout, index: number): "cover" | "leaf" {
  if (layout.portraitRole === "cover") return "cover";
  if (layout.portraitRole === "leaf") return "leaf";
  return index === 0 ? "cover" : "leaf";
}

function containBox(box: { x: number; y: number; w: number; h: number }) {
  let { x, y, w, h } = box;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > 100) w = 100 - x;
  if (y + h > 100) h = 100 - y;
  if (w < 1 || h < 1) return null;
  return {
    x: Math.round(clampPercent(x, 0) * 10) / 10,
    y: Math.round(clampPercent(y, 0) * 10) / 10,
    w: Math.round(clampPercent(w, 10, 1, 100) * 10) / 10,
    h: Math.round(clampPercent(h, 10, 1, 100) * 10) / 10,
  };
}

/** Place one spread element on a single upright page. Full-bleed art stays on the left page. */
export function portraitLeafBox(
  box: { x: number; y: number; w: number; h: number },
  side: "left" | "right",
): { x: number; y: number; w: number; h: number } | null {
  const bleed = box.x <= 2 && box.w >= 95;
  if (bleed) {
    if (side === "right") return null;
    return { x: 0, y: 0, w: 100, h: 100 };
  }
  const mapped = remapSpreadBoxToLeaf(box, side);
  if (!mapped) return null;
  return containBox(mapped);
}

function leafElements(layout: PageLayout, side: "left" | "right", key: string): PageElement[] {
  return layout.elements.flatMap((element, index) => {
    const box = portraitLeafBox(element, side);
    if (!box) return [];
    return [normalizeElement({ ...element, ...box, id: `${key}-${element.id}-${side[0]}` }, index)];
  });
}

function splitSpread(layout: PageLayout, key: string): PageLayout[] {
  const pages: PageLayout[] = [];
  (["left", "right"] as const).forEach((side) => {
    const elements = leafElements(layout, side, key);
    if (elements.length) pages.push({ elements, background: layout.background || "", portraitRole: "leaf" });
  });
  return pages;
}

function spreadToPortraitPages(layout: PageLayout, key: string, willow: boolean): PageLayout[] {
  if (willow) {
    return [{ elements: layout.elements.map((el, index) => normalizeElement(el, index)), background: layout.background || "", portraitRole: "leaf" }];
  }
  return splitSpread(layout, key);
}

/** Starting upright pages in the same order as the portrait flipbook (cover, then leaves). */
export function derivePortraitPages(book: Book): PageLayout[] {
  const willow = isWillowBook(book);
  const pages: PageLayout[] = [];
  if (hasLayout(book.coverLayout)) {
    pages.push({
      elements: book.coverLayout.elements.map((el, index) => normalizeElement(el, index)),
      background: book.coverLayout.background || "",
      portraitRole: "cover",
    });
  }
  const sources: Array<{ key: string; layout: PageLayout }> = [];
  if (hasLayout(book.titleLayout)) sources.push({ key: "title", layout: book.titleLayout });
  visibleStoryPages(book).forEach((page, index) => {
    if (hasLayout(page)) {
      sources.push({
        key: page.id || `page-${index + 1}`,
        layout: { elements: page.elements, background: page.background },
      });
    }
  });
  if (hasLayout(book.endLayout)) sources.push({ key: "end", layout: book.endLayout });
  sources.forEach((source) => {
    pages.push(...spreadToPortraitPages(source.layout, source.key, willow));
  });
  return pages.length ? pages : [{ elements: [], background: "", portraitRole: "leaf" }];
}

/** Inner portrait pages saved for mobile (everything after the cover). */
export function savedPortraitInnerPages(book: Book): PageLayout[] | null {
  if (!Array.isArray(book.portraitPages) || !book.portraitPages.length) return null;
  const normalized = book.portraitPages.map((layout) => normalizeLayout(layout));
  const coverAt = normalized.findIndex((layout, index) => portraitPageKind(layout, index) === "cover");
  if (coverAt >= 0) return normalized.slice(coverAt + 1);
  return normalized;
}

/** Saved portrait pages win. Until then, derive from the flipbook. */
export function portraitPagesFor(book: Book): PageLayout[] {
  if (Array.isArray(book.portraitPages)) return book.portraitPages.map((layout) => normalizeLayout(layout));
  return derivePortraitPages(book);
}

export function parsePortraitPages(raw?: string | null): PageLayout[] | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => normalizeLayout(item as PageLayout));
  } catch {
    return null;
  }
}
