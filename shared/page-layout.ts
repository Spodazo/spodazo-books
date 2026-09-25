import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, normalizeFont } from "./book-fonts";
import { normalizePaperTexture } from "./paper";
import { normalizeFrame } from "./text-frames";
import type { Book, BookPage, PageElement, PageElementRole, PageLayout, TextAlign } from "./types";

const ALIGNS = new Set<TextAlign>(["left", "center", "right"]);

export function normalizeAlign(raw?: string | null, role?: PageElementRole): TextAlign {
  if (raw && ALIGNS.has(raw as TextAlign)) return raw as TextAlign;
  return role && role !== "body" ? "center" : "left";
}

export function alignJustify(align?: string | null): "flex-start" | "center" | "flex-end" {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

export const DEFAULT_PAGE_BACKGROUND = "#efdda6";
/** The board behind the pages. Existing books keep this tan until it is changed. */
export const DEFAULT_SPREAD_BACKGROUND = "#bd9a61";

/** One leaf of the open book. The spread is 8:5, so a single leaf is 4:5. */
export const LEAF_RATIO = 0.8;

export const PAGE_COLOR_PALETTE = [
  "#efdda6", "#fff8e4", "#f7e9c4", "#f0dfb3", "#ffffff", "#f4f1ea",
  "#f6d6c4", "#f2c4c4", "#e8c4d4", "#d4c4e8", "#c4d4f2", "#c4e8e4",
  "#c4e8c8", "#e4e8c4", "#e8d4b4", "#d4c4b4", "#203b2a", "#12213d",
  "#271911", "#221630", "#0d2a2e", "#102a1e", "#0d1117", "#3a2010",
  "#8b2d2d", "#b45309", "#285e45", "#1d4ed8", "#6d28d9", "#be185d",
  "#0f766e", "#ca8a04", "#334155", "#78716c", "#000000", "#ece8e0",
];

const ROLES = new Set<PageElementRole>(["title", "tagline", "author", "date", "body", "end", "back"]);

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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function publishedLabel(date?: string | null): string {
  const raw = String(date || "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!iso) return `Published ${raw}`;
  const day = Number(iso[3]);
  const month = MONTHS[Number(iso[2]) - 1];
  if (!month || day < 1 || day > 31) return `Published ${raw}`;
  return `Published ${day} ${month} ${iso[1]}`;
}

export function pageFill(pageBackground: string | undefined, bookBackground: string | undefined): string {
  return normalizeColor(pageBackground, "") || normalizeColor(bookBackground, DEFAULT_PAGE_BACKGROUND);
}

export function normalizeElement(raw: Partial<PageElement> | null | undefined, index: number): PageElement {
  const type = raw?.type === "image" ? "image" : raw?.type === "shape" ? "shape" : "text";
  const role = raw?.role && ROLES.has(raw.role) ? raw.role : undefined;
  return {
    id: String(raw?.id || `el-${index + 1}`),
    type,
    x: clampPercent(raw?.x, 8),
    y: clampPercent(raw?.y, 8),
    w: clampPercent(raw?.w, type === "image" ? 40 : 84, type === "image" ? 1 : 4, 100),
    h: clampPercent(raw?.h, type === "image" ? 40 : 18, type === "image" ? 1 : 4, 100),
    z: Math.max(0, Math.round(Number(raw?.z) || index + 1)),
    shape: type === "shape" && raw?.shape === "circle" ? "circle" : type === "shape" ? "rectangle" : undefined,
    text: type === "text" ? String(raw?.text || "") : undefined,
    imageAsset: type === "image" ? String(raw?.imageAsset || "") : undefined,
    imageUrl: type === "image" ? String(raw?.imageUrl || "") : undefined,
    fit: type === "image" && raw?.fit === "contain" ? "contain" : type === "image" ? "cover" : undefined,
    focusX: type === "image" ? clampPercent(raw?.focusX, 50) : undefined,
    focusY: type === "image" ? clampPercent(raw?.focusY, 50) : undefined,
    opacity: type === "image" || type === "shape" ? clampPercent(raw?.opacity, 100, 10, 100) : undefined,
    fontSize: type === "text" ? clampPercent(raw?.fontSize, 4, 2, 16) : undefined,
    fontFamily: type === "text" ? normalizeFont(raw?.fontFamily) : undefined,
    color: type === "text" || type === "shape" ? normalizeColor(raw?.color, "") : undefined,
    align: type === "text" ? normalizeAlign(raw?.align, role) : undefined,
    frame: type === "text" ? normalizeFrame(raw?.frame) : undefined,
    frameColor: type === "text" ? normalizeColor(raw?.frameColor, "") : undefined,
    role,
  };
}

export const ELEMENT_CLIPBOARD_MIME = "application/x-spodazo-element";

export function imageObjectFit(element: { fit?: string | null }): "cover" | "contain" {
  return element.fit === "contain" ? "contain" : "cover";
}

export function imageObjectPosition(element: { focusX?: number | null; focusY?: number | null }): string {
  return `${clampPercent(element.focusX, 50)}% ${clampPercent(element.focusY, 50)}%`;
}

/** Dragging the picture right or down reveals the opposite edge, same as object-position. */
export function panImageFocus(
  origin: { focusX?: number; focusY?: number; w: number; h: number },
  dx: number,
  dy: number,
): { focusX: number; focusY: number } {
  const spanX = Math.max(1, origin.w);
  const spanY = Math.max(1, origin.h);
  const focusX = clampPercent((origin.focusX ?? 50) - (dx / spanX) * 100, 50);
  const focusY = clampPercent((origin.focusY ?? 50) - (dy / spanY) * 100, 50);
  return {
    focusX: Math.round(focusX * 10) / 10,
    focusY: Math.round(focusY * 10) / 10,
  };
}

export function encodeElementClipboard(element: PageElement): string {
  return JSON.stringify({ spodazoElement: 1, element });
}

export function decodeElementClipboard(raw: string): PageElement | null {
  const text = String(raw || "").trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as { spodazoElement?: number; element?: Partial<PageElement> };
    if (parsed?.spodazoElement !== 1 || !parsed.element || typeof parsed.element !== "object") return null;
    return normalizeElement(parsed.element, 0);
  } catch {
    return null;
  }
}

export function duplicateElement(element: PageElement, z: number, offset = 3): PageElement {
  const next = normalizeElement({ ...element, id: newElementId() }, 0);
  const maxX = Math.max(0, 100 - next.w);
  const maxY = Math.max(0, 100 - next.h);
  return {
    ...next,
    x: clampPercent(next.x + offset, next.x, 0, maxX),
    y: clampPercent(next.y + offset, next.y, 0, maxY),
    z,
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
      shape: item.shape,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z: item.z,
      text: item.text,
      imageAsset: item.imageAsset,
      imageUrl: item.imageAsset ? undefined : item.imageUrl,
      fontSize: item.fontSize,
      fit: item.fit,
      focusX: item.focusX,
      focusY: item.focusY,
      opacity: item.opacity,
      fontFamily: item.fontFamily,
      color: item.color,
      align: item.align,
      frame: item.frame,
      frameColor: item.frameColor,
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

export function elementTextHtml(text: string, escape: (value: string) => string): string {
  const raw = String(text || "");
  if (!raw) return "<p></p>";
  return raw
    .split(/\n{2,}/)
    .map((para) => `<p>${escape(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
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

function oneLine(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function defaultBackCoverLayout(book: Pick<Book, "title" | "tagline" | "cover">, coverUrl = ""): PageLayout {
  const elements: PageElement[] = [];
  if (book.cover || coverUrl) {
    elements.push(imageEl({ id: "back-art", x: 20, y: 40, w: 60, h: 20, z: 1, imageAsset: book.cover, imageUrl: coverUrl, fit: "contain" }));
  }
  if (book.title) {
    elements.push(textEl({
      id: "back-title",
      x: 4,
      y: 62,
      w: 92,
      h: 4,
      z: 2,
      text: oneLine(book.title),
      role: "title",
      align: "center",
      fontSize: 2,
      fontFamily: DEFAULT_TEXT_FONT,
    }));
  }
  return { elements, background: "" };
}

function tidyBackCoverLayout(layout: PageLayout, book: Pick<Book, "title">): PageLayout {
  const next = normalizeLayout(layout);
  if (!next.elements.some((item) => item.id === "back-title" || item.id === "back-tagline")) return next;
  const title = oneLine(next.elements.find((item) => item.id === "back-title")?.text || book.title);
  return {
    ...next,
    elements: next.elements
      .filter((item) => item.id !== "back-tagline" && item.role !== "tagline")
      .map((item) => (
        item.id === "back-title"
          ? { ...item, text: title, x: 4, y: 62, w: 92, h: 4, align: "center" as const, fontFamily: item.fontFamily || DEFAULT_TEXT_FONT }
          : item
      )),
  };
}

export function defaultCoverLayout(book: Pick<Book, "title" | "tagline" | "author" | "cover">, coverUrl = ""): PageLayout {
  const elements: PageElement[] = [];
  if (book.cover || coverUrl) {
    elements.push(imageEl({ id: "cover-art", x: 6, y: 4, w: 88, h: 58, z: 1, imageAsset: book.cover, imageUrl: coverUrl, fit: "contain" }));
  }
  if (book.title) elements.push(textEl({ id: "cover-title", x: 8, y: 64, w: 84, h: 14, z: 2, text: book.title, role: "title", align: "center", fontSize: 5 }));
  if (book.tagline) elements.push(textEl({ id: "cover-tagline", x: 10, y: 79, w: 80, h: 8, z: 3, text: book.tagline, role: "tagline", align: "center", fontSize: 2.4 }));
  if (book.author) elements.push(textEl({ id: "cover-author", x: 10, y: 88, w: 80, h: 7, z: 4, text: book.author, role: "author", align: "center", fontSize: 2.2 }));
  return { elements, background: "" };
}

export function defaultTitleLayout(book: Pick<Book, "title" | "tagline" | "author" | "date" | "cover">, coverUrl = ""): PageLayout {
  const elements: PageElement[] = [];
  const hasArt = Boolean(book.cover || coverUrl);
  const textX = hasArt ? 52 : 10;
  const textW = hasArt ? 42 : 80;
  if (hasArt) {
    elements.push(imageEl({ id: "title-cover", x: 6, y: 10, w: 42, h: 80, z: 1, imageAsset: book.cover, imageUrl: coverUrl, fit: "contain" }));
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
    elements.push(imageEl({ id: "end-art", x: 6, y: 10, w: 42, h: 80, z: 1, imageAsset: asset, imageUrl: src, fit: "contain" }));
  }
  elements.push(textEl({ id: "end-title", x: 52, y: 32, w: 42, h: 18, z: 2, text: "THE END", role: "end", fontSize: 6 }));
  return { elements, background: "" };
}

export function isLegacySingleLeafLayout(elements: PageElement[]): boolean {
  const images = elements.filter((item) => item.type === "image");
  const texts = elements.filter((item) => item.type === "text");
  if (images.length > 1 || texts.length > 2) return false;
  const overlayText = texts.every((item) => item.w >= 70 && (item.y >= 55 || item.y <= 22));
  if (images.length === 1) {
    const image = images[0];
    if (image.fit === "contain") return false;
    const fullPage = image.x <= 2 && image.y <= 2 && image.w >= 95 && image.h >= 95;
    return fullPage && overlayText;
  }
  return texts.length >= 1 && overlayText;
}

export function isOneLeafPdfPage(page: Pick<BookPage, "kind" | "imageAsset" | "fullPageAsset">): boolean {
  if (page.kind === "facsimile") return true;
  const image = String(page.imageAsset || page.fullPageAsset || "");
  const full = String(page.fullPageAsset || page.imageAsset || "");
  return Boolean(image) && image === full && /^page-\d+/i.test(image);
}

export function defaultStoryElements(page: BookPage): PageElement[] {
  const image = page.kind === "facsimile"
    ? (page.fullPageAsset || page.imageAsset)
    : (page.imageAsset || page.fullPageAsset);
  const elements: PageElement[] = [];
  const hasImage = Boolean(image || page.imageUrl || page.fullPageUrl);
  const oneLeaf = isOneLeafPdfPage(page);
  if (hasImage) {
    elements.push(imageEl({
      id: `${page.id}-art`,
      x: 0,
      y: 0,
      w: oneLeaf ? 50 : 50,
      h: 100,
      z: 1,
      imageAsset: image,
      imageUrl: page.kind === "facsimile" ? (page.fullPageUrl || page.imageUrl) : (page.imageUrl || page.fullPageUrl),
      fit: oneLeaf ? "contain" : undefined,
    }));
  }
  const text = page.paragraphs.join("\n\n").trim();
  if (text && page.kind !== "facsimile") {
    elements.push(textEl({
      id: `${page.id}-text`,
      x: 56,
      y: 18,
      w: 38,
      h: 64,
      z: 2,
      text,
      role: "body",
      fontSize: 3.4,
    }));
  }
  return elements;
}

export function ensurePageElements(page: BookPage): BookPage {
  if (isOneLeafPdfPage(page)) {
    return { ...page, kind: "facsimile", elements: [] };
  }
  if (page.elements.length && !isLegacySingleLeafLayout(page.elements)) {
    return { ...page, elements: page.elements.map((item, index) => normalizeElement(item, index)) };
  }
  const paragraphs = bodyParagraphs(page.elements);
  return {
    ...page,
    elements: defaultStoryElements(paragraphs.length ? { ...page, paragraphs } : page),
  };
}

function withEndArt(layout: PageLayout, coverAsset: string, coverUrl: string, characterUrl: string): PageLayout {
  const next = normalizeLayout(layout);
  const src = characterUrl || coverUrl;
  const image = next.elements.find((item) => item.type === "image");
  if (image) {
    if (image.imageUrl || image.imageAsset) {
      return { ...next, elements: next.elements.map((item) => (item.type === "image" && !item.fit ? { ...item, fit: "contain" } : item)) };
    }
    return {
      ...next,
      elements: next.elements.map((item) => (
        item.id === image.id ? { ...item, imageAsset: characterUrl ? "" : coverAsset, imageUrl: src, fit: "contain" } : item
      )),
    };
  }
  if (!src && !coverAsset) return next;
  const art = imageEl({ id: "end-art", x: 6, y: 10, w: 42, h: 80, z: 1, imageAsset: characterUrl ? "" : coverAsset, imageUrl: src, fit: "contain" });
  return { ...next, elements: [art, ...next.elements] };
}

export function ensureBookLayouts<T extends Book>(book: T, extras?: { coverUrl?: string; characterUrl?: string }): T {
  const pages = book.pages.map(ensurePageElements);
  const coverUrl = extras?.coverUrl || "";
  const characterUrl = extras?.characterUrl || "";
  return {
    ...book,
    pageBackground: normalizeColor(book.pageBackground, DEFAULT_PAGE_BACKGROUND),
    pageTexture: normalizePaperTexture(book.pageTexture),
    spreadBackground: normalizeColor(book.spreadBackground, DEFAULT_SPREAD_BACKGROUND),
    textFont: normalizeFont(book.textFont, DEFAULT_TEXT_FONT),
    textColor: normalizeColor(book.textColor, DEFAULT_TEXT_COLOR),
    titleLayout: hasLayout(book.titleLayout)
      ? normalizeLayout(book.titleLayout)
      : defaultTitleLayout(book, coverUrl),
    coverLayout: hasLayout(book.coverLayout)
      ? normalizeLayout(book.coverLayout)
      : defaultCoverLayout(book, coverUrl),
    backCoverLayout: tidyBackCoverLayout(
      hasLayout(book.backCoverLayout) ? book.backCoverLayout : defaultBackCoverLayout(book, coverUrl),
      book,
    ),
    endLayout: withEndArt(
      hasLayout(book.endLayout) ? book.endLayout : defaultEndLayout(book.cover, coverUrl, characterUrl),
      book.cover,
      coverUrl,
      characterUrl,
    ),
    pages,
  };
}

export function syncBookFromLayouts<T extends Book>(book: T): T {
  const title = textForRole(book.titleLayout.elements, "title") || book.title;
  const tagline = textForRole(book.titleLayout.elements, "tagline");
  const author = textForRole(book.titleLayout.elements, "author");
  const date = textForRole(book.titleLayout.elements, "date");
  const cover = firstImageAsset(book.coverLayout?.elements || []) || firstImageAsset(book.titleLayout.elements) || firstImageAsset(book.pages[0]?.elements || []) || book.cover;
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
      textEl({ id: newElementId(), x: 56, y: 18, w: 38, h: 64, z: 2, text: "New page", role: "body", fontSize: 3.6 }),
    ],
    background: "",
  };
}
