import { clampPercent, hasLayout, normalizeElement, normalizeLayout, remapSpreadBoxToLeaf } from "./page-layout";
import { visibleStoryPages } from "./reader-pages";
import type { Book, PageElement, PageLayout } from "./types";

/** Width / height of a full-screen upright phone page in the flipbook (390×844 reference). */
export const PORTRAIT_PAGE_RATIO = 390 / 844;

export type PortraitFlipRole = "cover" | "title" | "spread" | "end";

export function isWillowBook(book: Pick<Book, "slug" | "title">): boolean {
  return /willow/i.test(String(book.slug || "")) || /willow/i.test(String(book.title || ""));
}

/** Full phone viewport height for a given content width. */
export function portraitPhoneViewportHeight(width: number): number {
  return width / PORTRAIT_PAGE_RATIO;
}

export function portraitFlipRole(layout: PageLayout, index: number): PortraitFlipRole {
  const role = layout.portraitRole;
  if (role === "cover" || role === "title" || role === "spread" || role === "end") return role;
  if (role === "leaf") return "spread";
  if (index === 0) return "cover";
  return "spread";
}

/** @deprecated use portraitFlipRole */
export function portraitPageKind(layout: PageLayout, index: number): "cover" | "leaf" {
  const role = portraitFlipRole(layout, index);
  return role === "cover" ? "cover" : "leaf";
}

export function mirrorElementSize(element: PageElement): "main" | "small" {
  if (element.id === "title-cover" || element.id === "end-art") return "main";
  return (Number(element.w) || 10) * (Number(element.h) || 10) >= 400 ? "main" : "small";
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

/** Portrait flipbook pages in reader order — one screen per flip, no leaf split. */
export function derivePortraitPages(book: Book): PageLayout[] {
  const pages: PageLayout[] = [];
  if (hasLayout(book.coverLayout)) {
    pages.push({
      elements: book.coverLayout.elements.map((el, index) => normalizeElement(el, index)),
      background: book.coverLayout.background || "",
      portraitRole: "cover",
    });
  }
  if (hasLayout(book.titleLayout)) {
    pages.push({
      elements: book.titleLayout.elements.map((el, index) => normalizeElement(el, index)),
      background: book.titleLayout.background || "",
      portraitRole: "title",
    });
  }
  visibleStoryPages(book).forEach((page, index) => {
    if (!hasLayout(page)) return;
    pages.push({
      elements: page.elements.map((el, elIndex) => normalizeElement(el, elIndex)),
      background: page.background || "",
      portraitRole: "spread",
    });
  });
  if (hasLayout(book.endLayout)) {
    pages.push({
      elements: book.endLayout.elements.map((el, index) => normalizeElement(el, index)),
      background: book.endLayout.background || "",
      portraitRole: "end",
    });
  }
  return pages.length ? pages : [{ elements: [], background: "", portraitRole: "spread" }];
}

/** Saved portrait pages for optional upright PDF tooling (not used by the flipbook reader). */
export function savedPortraitInnerPages(book: Book): PageLayout[] | null {
  if (!Array.isArray(book.portraitPages) || !book.portraitPages.length) return null;
  const normalized = book.portraitPages.map((layout) => normalizeLayout(layout));
  const coverAt = normalized.findIndex((layout, index) => portraitFlipRole(layout, index) === "cover");
  if (coverAt >= 0) return normalized.slice(coverAt + 1);
  return normalized;
}

/** Upright PDF preview pages — always derived from flipbook layouts (phone uses reader restack). */
export function portraitPagesFor(book: Book): PageLayout[] {
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
