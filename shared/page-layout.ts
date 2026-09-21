import type { Book, BookPage, PageElement, PageElementRole, PageLayout } from "./types";

export const DEFAULT_PAGE_BACKGROUND = "#efdda6";

export const PAGE_COLOR_PALETTE = [
  "#efdda6", "#fff8e4", "#f7e9c4", "#f0dfb3", "#ffffff", "#f4f1ea",
  "#f6d6c4", "#f2c4c4", "#e8c4d4", "#d4c4e8", "#c4d4f2", "#c4e8e4",
  "#c4e8c8", "#e4e8c4", "#e8d4b4", "#d4c4b4", "#203b2a", "#12213d",
  "#271911", "#221630", "#0d2a2e", "#102a1e", "#0d1117", "#3a2010",
  "#8b2d2d", "#b45309", "#285e45", "#1d4ed8", "#6d28d9", "#be185d",
  "#0f766e", "#ca8a04", "#334155", "#78716c", "#000000", "#ece8e0",
];

const ROLES = new Set<PageElementRole>(["title", "tagline", "author", "date", "body", "end"]);

export function newElementId(): string {
  return `el-${crypto.randomUUID()}`;
}

export function normalizeColor(raw?: string | null, fallback = ""): string {
  const value = String(raw || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
    }
    return value.toLowerCase();
  }
  return fallback;
}

export function clampPercent(raw: unknown, fallback: number, min = 0, max = 100): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function pageFill(pageBackground: string | undefined, bookBackground: string | undefined): string {
  return normalizeColor(pageBackground, "") || normalizeColor(bookBackground, DEFAULT_PAGE_BACKGROUND);
}

export function normalizeElement(raw: Partial<PageElement> | null | undefined, index: number): PageElement {
  const type = raw?.type === "image" ? "image" : "text";
  const role = raw?.role && ROLES.has(raw.role) ? raw.role : undefined;
  return {
    id: String(raw?.id || `el-${index + 1}`),
    type,
    x: clampPercent(raw?.x, 8),
    y: clampPercent(raw?.y, 8),
    w: clampPercent(raw?.w, type === "image" ? 40 : 84, 4, 100),
    h: clampPercent(raw?.h, type === "image" ? 40 : 18, 4, 100),
    z: Math.max(0, Math.round(Number(raw?.z) || index + 1)),
    text: type === "text" ? String(raw?.text || "") : undefined,
    imageAsset: type === "image" ? String(raw?.imageAsset || "") : undefined,
    imageUrl: type === "image" ? String(raw?.imageUrl || "") : undefined,
    fontSize: type === "text" ? clampPercent(raw?.fontSize, 4, 2, 16) : undefined,
    role,
  };
}

export function normalizeLayout(raw?: Partial<PageLayout> | PageElement[] | null): PageLayout {
  const record = Array.isArray(raw) ? { elements: raw } : raw || {};
  const elements = Array.isArray(record.elements) ? record.elements : [];
  return {
    elements: elements.map((item, index) => normalizeElement(item, index)),
    background: normalizeColor(record.background, ""),
  };
}

export function parseLayoutJson(raw?: string | null): PageLayout {
  try {
    return normalizeLayout(JSON.parse(raw || "{}") as Partial<PageLayout>);
  } catch {
    return { elements: [], background: "" };
  }
}

export function layoutToJson(layout: PageLayout): string {
  return JSON.stringify({
    background: layout.background || "",
    elements: layout.elements.map((item) => ({
      id: item.id,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z: item.z,
      text: item.text,
      imageAsset: item.imageAsset,
      fontSize: item.fontSize,
      role: item.role,
    })),
  });
}

export function hasLayout(layout?: PageLayout | null): boolean {
  return Boolean(layout?.elements?.length);
}

export function firstImageAsset(elements: PageElement[]): string {
  return elements.find((item) => item.type === "image" && item.imageAsset)?.imageAsset || "";
}

export function textForRole(elements: PageElement[], role: PageElementRole): string {
  return elements
    .filter((item) => item.type === "text" && item.role === role)
    .map((item) => String(item.text || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function bodyParagraphs(elements: PageElement[]): string[] {
  const body = elements
    .filter((item) => item.type === "text" && (item.role === "body" || !item.role))
    .map((item) => String(item.text || "").trim())
    .filter(Boolean);
  return body.length ? body : [];
}

function textEl(partial: Partial<PageElement> & { text: string }): PageElement {
  return normalizeElement({ type: "text", ...partial }, 0);
}

function imageEl(partial: Partial<PageElement>): PageElement {
  return normalizeElement({ type: "image", ...partial }, 0);
}

export function defaultTitleLayout(book: Pick<Book, "title" | "tagline" | "author" | "date" | "cover">, coverUrl = ""): PageLayout {
  const elements: PageElement[] = [];
  const hasArt = Boolean(book.cover || coverUrl);
  const textX = hasArt ? 52 : 10;
  const textW = hasArt ? 42 : 80;
  if (hasArt) {
    elements.push(imageEl({ id: "title-cover", x: 6, y: 10, w: 42, h: 80, z: 1, imageAsset: book.cover, imageUrl: coverUrl }));
  }
  if (book.title) elements.push(textEl({ id: "title-title", x: textX, y: 16, w: textW, h: 22, z: 2, text: book.title, role: "title", fontSize: 6 }));
  if (book.tagline) elements.push(textEl({ id: "title-tagline", x: textX, y: 42, w: textW, h: 16, z: 3, text: book.tagline, role: "tagline", fontSize: 3.2 }));
  if (book.author) elements.push(textEl({ id: "title-author", x: textX, y: 68, w: textW, h: 10, z: 4, text: book.author, role: "author", fontSize: 3 }));
  if (book.date) elements.push(textEl({ id: "title-date", x: textX, y: 80, w: textW, h: 8, z: 5, text: book.date, role: "date", fontSize: 2.6 }));
  return { elements, background: "" };
}

export function defaultEndLayout(coverAsset = "", coverUrl = "", characterUrl = ""): PageLayout {
  const src = characterUrl || coverUrl;
  const asset = characterUrl ? "" : coverAsset;
  const elements: PageElement[] = [];
  if (src || asset) {
    elements.push(imageEl({ id: "end-art", x: 6, y: 10, w: 42, h: 80, z: 1, imageAsset: asset, imageUrl: src }));
  }
  elements.push(textEl({ id: "end-title", x: 52, y: 32, w: 42, h: 18, z: 2, text: "THE END", role: "end", fontSize: 6 }));
  return { elements, background: "" };
}

export function defaultStoryElements(page: BookPage): PageElement[] {
  const image = page.imageAsset || page.fullPageAsset;
  const elements: PageElement[] = [];
  if (image || page.imageUrl || page.fullPageUrl) {
    elements.push(imageEl({
      id: `${page.id}-art`,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      imageAsset: image,
      imageUrl: page.imageUrl || page.fullPageUrl,
    }));
  }
  const text = page.paragraphs.join("\n\n").trim();
  if (text && page.kind !== "facsimile") {
    elements.push(textEl({
      id: `${page.id}-text`,
      x: 6,
      y: page.position === "top" ? 8 : 68,
      w: 88,
      h: 26,
      z: 2,
      text,
      role: "body",
      fontSize: 3.4,
    }));
  }
  return elements;
}

export function ensurePageElements(page: BookPage): BookPage {
  if (page.elements.length) return page;
  return { ...page, elements: defaultStoryElements(page) };
}

export function ensureBookLayouts<T extends Book>(book: T, extras?: { coverUrl?: string; characterUrl?: string }): T {
  const pages = book.pages.map(ensurePageElements);
  return {
    ...book,
    pageBackground: normalizeColor(book.pageBackground, DEFAULT_PAGE_BACKGROUND),
    titleLayout: hasLayout(book.titleLayout)
      ? book.titleLayout
      : defaultTitleLayout(book, extras?.coverUrl || ""),
    endLayout: hasLayout(book.endLayout)
      ? book.endLayout
      : defaultEndLayout(book.cover, extras?.coverUrl || "", extras?.characterUrl || ""),
    pages,
  };
}

export function syncBookFromLayouts<T extends Book>(book: T): T {
  const title = textForRole(book.titleLayout.elements, "title") || book.title;
  const tagline = textForRole(book.titleLayout.elements, "tagline");
  const author = textForRole(book.titleLayout.elements, "author");
  const date = textForRole(book.titleLayout.elements, "date");
  const cover = firstImageAsset(book.titleLayout.elements) || firstImageAsset(book.pages[0]?.elements || []) || book.cover;
  return {
    ...book,
    title,
    tagline: tagline || book.tagline,
    author: author || book.author,
    date: date || book.date,
    cover,
    pages: book.pages.map((page, index) => {
      const image = firstImageAsset(page.elements) || page.imageAsset;
      const paragraphs = bodyParagraphs(page.elements);
      return {
        ...page,
        sourcePage: index + 1,
        title: page.title || paragraphs[0]?.slice(0, 40) || `Page ${index + 1}`,
        paragraphs: paragraphs.length ? paragraphs : page.paragraphs,
        imageAsset: image,
        fullPageAsset: image || page.fullPageAsset,
      };
    }),
  };
}

export function emptyStoryPage(index: number): BookPage {
  return {
    id: `page-${crypto.randomUUID()}`,
    sourcePage: index + 1,
    kind: "story",
    title: "New page",
    paragraphs: [],
    imageAsset: "",
    fullPageAsset: "",
    imageUrl: "",
    fullPageUrl: "",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [
      textEl({ id: newElementId(), x: 8, y: 70, w: 84, h: 22, z: 2, text: "New page", role: "body", fontSize: 3.6 }),
    ],
    background: "",
  };
}
