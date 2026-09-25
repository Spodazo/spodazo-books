import { clampPercent, hasLayout, normalizeElement, normalizeLayout, remapSpreadBoxToLeaf } from "./page-layout";
import { visibleStoryPages } from "./reader-pages";
import type { Book, PageElement, PageLayout } from "./types";

/** Width / height of one upright phone page. Same shape as a single book leaf. */
export const PORTRAIT_PAGE_RATIO = 0.8;

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
    if (elements.length) pages.push({ elements, background: layout.background || "" });
  });
  return pages;
}

/** Starting upright pages, split from the flipbook so each phone page is one leaf. */
export function derivePortraitPages(book: Book): PageLayout[] {
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
  const pages = sources.flatMap((source) => splitSpread(source.layout, source.key));
  return pages.length ? pages : [{ elements: [], background: "" }];
}

/** Saved portrait pages win. Until then, the phone uses the split flipbook. */
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
