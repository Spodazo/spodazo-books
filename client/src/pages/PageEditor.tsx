import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  BOOK_FONTS,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT,
  cursiveFonts,
  fontStack,
  googleFontsHref,
  straightFonts,
  TEXT_INK_PALETTE,
} from "@shared/book-fonts";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SPREAD_BACKGROUND,
  PAGE_COLOR_PALETTE,
  alignJustify,
  decodeElementClipboard,
  duplicateElement,
  ELEMENT_CLIPBOARD_MIME,
  emptyStoryPage,
  encodeElementClipboard,
  ensureBookLayouts,
  imageObjectFit,
  imageObjectPosition,
  LEAF_RATIO,
  newElementId,
  normalizeColor,
  pageFill,
  panImageFocus,
  publishedLabel,
  syncBookFromLayouts,
  titlePageEnabled,
} from "@shared/page-layout";
import { PAPER_TEXTURES, paperSurfaceStyle, paperSwatchStyle } from "@shared/paper";
import { characterUrlFor, visibleStoryPages } from "@shared/reader-pages";
import { DEFAULT_FRAME_COLOR, TEXT_FRAMES, frameClass, frameMarkup, normalizeFrame } from "@shared/text-frames";
import type { PageElement, PageLayout, PublicBook, TextAlign } from "@shared/types";
import EditorText from "../components/EditorText";
import { adminMe, fetchBook, fetchPlayerSetup, invalidateBookCache, updateBook, uploadBookAsset } from "../lib/api";

function samplePicture(page: HTMLElement, clientX: number, clientY: number) {
  const images = Array.prototype.slice.call(page.querySelectorAll("img")) as HTMLImageElement[];
  const hits = images.filter((img) => {
    const rect = img.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }).sort((a, b) => Number(getComputedStyle(a.parentElement || a).zIndex || 0) - Number(getComputedStyle(b.parentElement || b).zIndex || 0));
  const img = hits[hits.length - 1];
  if (!img || !img.naturalWidth || !img.naturalHeight) return "";
  const rect = img.getBoundingClientRect();
  const fit = getComputedStyle(img).objectFit === "contain" ? "contain" : "cover";
  const scale = fit === "contain"
    ? Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
    : Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const localX = clientX - rect.left - (rect.width - drawnW) / 2;
  const localY = clientY - rect.top - (rect.height - drawnH) / 2;
  if (localX < 0 || localY < 0 || localX > drawnW || localY > drawnH) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  try {
    ctx.drawImage(img, localX / scale, localY / scale, 1, 1, 0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    if (pixel[3] < 16) return "";
    return `#${[pixel[0], pixel[1], pixel[2]].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "";
  }
}

function storyText(item: PageElement) {
  return item.type === "text" && (item.role === "body" || !item.role);
}

function canDeleteStoryPage(book: PublicBook, pageId: string): boolean {
  const remaining = book.pages.filter((page) => page.id !== pageId);
  if (remaining.length === book.pages.length) return false;
  return visibleStoryPages({ ...book, pages: remaining }).length >= 1;
}

function storyScreenStart(book: PublicBook): number {
  return 2 + (titlePageEnabled(book) ? 1 : 0);
}

function screenLabel(screen: Screen, storyPages: { id: string }[]): string {
  if (screen.kind === "cover") return "Cover";
  if (screen.kind === "back") return "Back cover";
  if (screen.kind === "title") return "Title";
  if (screen.kind === "end") return "The end";
  const ord = storyPages.findIndex((page) => page.id === screen.pageId);
  return ord >= 0 ? `Page ${ord + 1}` : "Story page";
}

function storyScreenIndex(book: PublicBook, storyOrdinal: number): number {
  return storyScreenStart(book) + storyOrdinal;
}

function screensForBook(book: PublicBook): Screen[] {
  const storyPages = visibleStoryPages(book);
  const prefix: Screen[] = [{ kind: "cover" }, { kind: "back" }];
  if (titlePageEnabled(book)) prefix.push({ kind: "title" });
  return [...prefix, ...storyPages.map((page) => ({ kind: "page" as const, pageId: page.id })), { kind: "end" }];
}

function canDeleteCurrentScreen(book: PublicBook, screen: Screen): boolean {
  if (screen.kind === "title") return titlePageEnabled(book);
  if (screen.kind === "page") return canDeleteStoryPage(book, screen.pageId);
  return false;
}

function screenAtIndex(book: PublicBook, screenIndex: number): Screen | undefined {
  const list = screensForBook(book);
  if (!list.length) return undefined;
  return list[screenIndex] ?? list[list.length - 1];
}

function measureStoryHeight(text: string, widthPx: number, fontPx: number, family: string, framed: boolean) {
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:-9999px;top:0;width:${Math.max(40, widthPx)}px;visibility:hidden;`;
  const inner = document.createElement("div");
  inner.className = "page-editor-text";
  inner.style.fontFamily = family;
  inner.style.fontSize = `${fontPx}px`;
  inner.style.width = "100%";
  inner.style.textAlign = "center";
  if (framed) inner.style.padding = "8%";
  const paras = (text || " ").split(/\n{2,}/);
  paras.forEach((para) => {
    const p = document.createElement("p");
    para.split("\n").forEach((line, lineIndex) => {
      if (lineIndex > 0) p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode(line || " "));
    });
    inner.appendChild(p);
  });
  host.appendChild(inner);
  document.body.appendChild(host);
  const height = inner.scrollHeight;
  host.remove();
  return height;
}

function placeStoryText(elements: PageElement[], fontSize: number, pageW: number, pageH: number, bookFont: string) {
  const bodies = elements.filter(storyText);
  if (!bodies.length || pageW < 40 || pageH < 40) {
    return elements.map((item) => (storyText(item) ? { ...item, fontSize, align: "center" as const } : item));
  }
  const artOnLeft = elements.some((item) => item.type === "image" && item.x < 40 && item.w >= 30 && item.x + item.w <= 55);
  const area = artOnLeft
    ? { left: 54, right: 94, top: 8, bottom: 92 }
    : { left: 8, right: 92, top: 8, bottom: 92 };
  const maxW = area.right - area.left;
  const maxH = area.bottom - area.top;
  const gap = 3;
  const fitted = bodies.map((item) => {
    const family = fontStack(item.fontFamily || bookFont);
    const framed = Boolean(item.frame);
    let w = Math.min(maxW, Math.max(28, item.w));
    const heightFor = (width: number) => {
      const px = measureStoryHeight(item.text || "", pageW * (width / 100), pageH * (fontSize / 100), family, framed);
      return Math.min(maxH, (px / pageH) * 100 + 3);
    };
    let h = heightFor(w);
    while (h >= maxH - 0.5 && w < maxW) {
      w = Math.min(maxW, w + 4);
      h = heightFor(w);
    }
    return { item, w, h };
  });
  const total = fitted.reduce((sum, box) => sum + box.h, 0) + gap * Math.max(0, fitted.length - 1);
  let y = area.top + Math.max(0, (maxH - Math.min(maxH, total)) / 2);
  const placed = new Map<string, PageElement>();
  fitted.forEach((box) => {
    const h = Math.min(box.h, Math.max(8, area.bottom - y));
    const x = area.left + (maxW - box.w) / 2;
    placed.set(box.item.id, {
      ...box.item,
      fontSize,
      align: "center",
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: Math.round(box.w * 10) / 10,
      h: Math.round(h * 10) / 10,
    });
    y += h + gap;
  });
  return elements.map((item) => placed.get(item.id) || item);
}

function FontSelect({
  value,
  onChange,
  allowBook,
}: {
  value: string;
  onChange: (value: string) => void;
  allowBook?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {allowBook ? <option value="">Same as book</option> : null}
      <optgroup label="Straight">
        {straightFonts().map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: fontStack(font.id) }}>{font.label}</option>
        ))}
      </optgroup>
      <optgroup label="Cursive">
        {cursiveFonts().map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: fontStack(font.id) }}>{font.label}</option>
        ))}
      </optgroup>
    </select>
  );
}

type Screen =
  | { kind: "cover" }
  | { kind: "back" }
  | { kind: "title" }
  | { kind: "page"; pageId: string }
  | { kind: "end" };

type DragState = {
  id: string;
  mode: "move" | "resize" | "crop";
  startX: number;
  startY: number;
  orig: PageElement;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
}

function pastedRole(source: PageElement, screen: Screen): PageElement["role"] {
  if (source.role === "body" || source.role === "end" || source.role === "back") return source.role;
  if (screen.kind === "end") return "end";
  if (screen.kind === "back") return "back";
  return "body";
}

const UNDO_LIMIT = 50;

function cloneBook(book: PublicBook): PublicBook {
  return JSON.parse(JSON.stringify(book)) as PublicBook;
}

export default function PageEditorPage() {
  const [, params] = useRoute("/admin/edit/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const [book, setBook] = useState<PublicBook | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState("Saved");
  const [canUndo, setCanUndo] = useState(false);
  const [credits, setCredits] = useState("");
  const [copyright, setCopyright] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef("");
  const saveTimer = useRef<number>();
  const bookRef = useRef<PublicBook | null>(null);
  const drag = useRef<DragState | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [bookBox, setBookBox] = useState({ width: 0, height: 0 });
  const [picking, setPicking] = useState<"" | "text" | "frame" | "shape" | "page" | "ink">("");
  const [cropping, setCropping] = useState(false);
  const clipboardRef = useRef<{ element: PageElement; plain: string } | null>(null);
  const pasteNudge = useRef(0);
  const screenRef = useRef<Screen | undefined>(undefined);
  const indexRef = useRef(0);
  const selectedIdRef = useRef("");
  const copyRef = useRef<(event?: ClipboardEvent) => void>(() => {});
  const pasteRef = useRef<(event: ClipboardEvent) => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const undoStack = useRef<PublicBook[]>([]);
  const restoringRef = useRef(false);
  const deferUndoRef = useRef(false);

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    if (!book || !ready) return;
    undoStack.current = [cloneBook(book)];
    setCanUndo(false);
  }, [book?.id, ready]);

  useEffect(() => {
    const href = googleFontsHref(BOOK_FONTS.map((font) => font.id));
    let link = document.getElementById("book-editor-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "book-editor-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const finishedW = Math.max(320, window.innerWidth - 40);
      const finishedH = Math.max(240, window.innerHeight - 40);
      const singleLeaf = index === 0 || index === 1;
      const ratio = singleLeaf ? LEAF_RATIO : finishedW / finishedH;
      const styles = getComputedStyle(stage);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availW = Math.max(160, stage.clientWidth - padX);
      const availH = Math.max(120, stage.clientHeight - padY);
      let width = availW;
      let height = width / ratio;
      if (height > availH) {
        height = availH;
        width = height * ratio;
      }
      setBookBox({ width, height });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [ready, book, index]);

  useEffect(() => {
    let cancelled = false;
    adminMe()
      .then(async (me) => {
        if (!me.admin) {
          setLocation("/admin");
          return;
        }
        invalidateBookCache(slug);
        const [next, setup] = await Promise.all([fetchBook(slug), fetchPlayerSetup()]);
        if (cancelled) return;
        const loaded = ensureBookLayouts(next, { coverUrl: next.coverUrl, characterUrl: characterUrlFor(next) });
        setBook(loaded);
        setIndex(
          visibleStoryPages(loaded).length
            ? storyScreenStart(loaded)
            : titlePageEnabled(loaded)
              ? 2
              : 0,
        );
        setCredits(setup.credits);
        setCopyright(setup.copyright);
        setLogoUrl(setup.logoUrl);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, setLocation]);

  function pushUndoSnapshot() {
    const current = bookRef.current;
    if (!current || restoringRef.current) return;
    const stack = undoStack.current;
    const snap = cloneBook(current);
    const top = stack[stack.length - 1];
    if (top && JSON.stringify(top) === JSON.stringify(snap)) return;
    stack.push(snap);
    if (stack.length > UNDO_LIMIT) stack.shift();
    setCanUndo(stack.length >= 2);
  }

  function bookSavePayload(synced: PublicBook): Record<string, unknown> {
    const cover = synced.coverLayout.elements.find((item) => item.type === "image" && (item.imageAsset || item.imageUrl));
    const coverUrl = cover?.imageAsset
      ? `/media/images/${encodeURIComponent(cover.imageAsset)}`
      : cover?.imageUrl || synced.coverUrl;
    return {
      title: synced.title,
      tagline: synced.tagline,
      author: synced.author,
      date: synced.date,
      coverUrl,
      pages: synced.pages,
      pageBackground: synced.pageBackground,
      pageTexture: synced.pageTexture,
      spreadBackground: synced.spreadBackground,
      textFont: synced.textFont,
      textColor: synced.textColor,
      titleLayout: synced.titleLayout,
      coverLayout: synced.coverLayout,
      backCoverLayout: synced.backCoverLayout,
      endLayout: synced.endLayout,
      showTitlePage: synced.showTitlePage !== false,
    };
  }

  function saveBookNow(synced: PublicBook) {
    window.clearTimeout(saveTimer.current);
    setStatus("Saving…");
    return updateBook(synced.id, bookSavePayload(synced))
      .then((saved) => {
        const latest = bookRef.current;
        if (!latest || latest.id !== saved.id) return;
        if (saved.pages.length !== latest.pages.length) {
          setError(`Save did not stick: server still has ${saved.pages.length} pages (editor has ${latest.pages.length}). Try again or refresh.`);
          setStatus("");
          return;
        }
        setStatus("Saved");
      })
      .catch((err: Error) => {
        setStatus("");
        setError(err.message);
      });
  }

  function persist(next: PublicBook, options?: { recordUndo?: boolean; saveNow?: boolean }) {
    const record = options?.recordUndo !== false && !restoringRef.current && !drag.current;
    if (record) pushUndoSnapshot();
    const synced = syncBookFromLayouts(next);
    bookRef.current = synced;
    setBook(synced);
    window.clearTimeout(saveTimer.current);
    if (options?.saveNow) {
      void saveBookNow(synced);
      return;
    }
    setStatus("Saving…");
    saveTimer.current = window.setTimeout(() => {
      const latest = bookRef.current;
      if (!latest || latest.id !== synced.id) return;
      void saveBookNow(latest);
    }, 700);
  }

  const storyPages = useMemo(() => (book ? visibleStoryPages(book) : []), [book]);

  const screens: Screen[] = useMemo(() => (book ? screensForBook(book) : []), [book, storyPages]);

  const screen = screens[index] ?? screens[Math.max(0, screens.length - 1)];

  useEffect(() => {
    if (index >= screens.length && screens.length) {
      setIndex(screens.length - 1);
    }
  }, [index, screens.length]);

  function layoutOf(target: Screen | undefined): PageLayout {
    const current = bookRef.current;
    if (!current || !target) return { elements: [], background: "" };
    if (target.kind === "cover") return current.coverLayout;
    if (target.kind === "back") return current.backCoverLayout;
    if (target.kind === "title") return current.titleLayout;
    if (target.kind === "end") return current.endLayout;
    return current.pages.find((page) => page.id === target.pageId) || { elements: [], background: "" };
  }

  function writeLayout(target: Screen, layout: PageLayout, options?: { recordUndo?: boolean }) {
    const current = bookRef.current;
    if (!current) return;
    if (target.kind === "cover") persist({ ...current, coverLayout: layout }, options);
    else if (target.kind === "back") persist({ ...current, backCoverLayout: layout }, options);
    else if (target.kind === "title") persist({ ...current, titleLayout: layout }, options);
    else if (target.kind === "end") persist({ ...current, endLayout: layout }, options);
    else {
      persist({
        ...current,
        pages: current.pages.map((page) => (page.id === target.pageId ? { ...page, ...layout, elements: layout.elements } : page)),
      }, options);
    }
  }

  function patchElement(id: string, patch: Partial<PageElement>, options?: { recordUndo?: boolean }) {
    if (!screen) return;
    const layout = layoutOf(screen);
    writeLayout(screen, {
      ...layout,
      elements: layout.elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }, options);
  }

  function undo() {
    const stack = undoStack.current;
    if (stack.length < 2) return;
    stack.pop();
    const prev = stack[stack.length - 1];
    if (!prev) return;
    restoringRef.current = true;
    const synced = syncBookFromLayouts(prev);
    bookRef.current = synced;
    setBook(synced);
    setCanUndo(stack.length >= 2);
    setSelectedId("");
    setEditingId("");
    setStatus("Undone");
    restoringRef.current = false;
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    void saveBookNow(synced);
  }

  function applyStorySize(fontSize: number) {
    const current = bookRef.current;
    if (!current) return;
    const pageBox = pageRef.current;
    const pageW = pageBox?.clientWidth || bookBox.width;
    const pageH = pageBox?.clientHeight || bookBox.height;
    persist({
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        elements: placeStoryText(page.elements, fontSize, pageW, pageH, current.textFont || DEFAULT_TEXT_FONT),
      })),
    });
  }

  function addShape(shape: "rectangle" | "circle") {
    if (!screen) return;
    const layout = layoutOf(screen);
    const element: PageElement = {
      id: newElementId(),
      type: "shape",
      shape,
      x: 58,
      y: 28,
      w: shape === "circle" ? 26 : 32,
      h: shape === "circle" ? 26 : 18,
      z: layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      color: "#ffffff",
      opacity: 70,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
  }

  function arrange(direction: "front" | "forward" | "back" | "backward") {
    if (!screen || !selectedId) return;
    const layout = layoutOf(screen);
    const items = layout.elements.slice().sort((a, b) => a.z - b.z);
    const at = items.findIndex((item) => item.id === selectedId);
    if (at < 0) return;
    if (direction === "front") {
      const [item] = items.splice(at, 1);
      items.push(item);
    } else if (direction === "back") {
      const [item] = items.splice(at, 1);
      items.unshift(item);
    } else if (direction === "forward" && at < items.length - 1) {
      const next = items[at + 1];
      items[at + 1] = items[at];
      items[at] = next;
    } else if (direction === "backward" && at > 0) {
      const previous = items[at - 1];
      items[at - 1] = items[at];
      items[at] = previous;
    } else return;
    writeLayout(screen, { ...layout, elements: items.map((item, index) => ({ ...item, z: index + 1 })) });
  }

  function coverFont(role: "title" | "tagline" | "author") {
    return book?.coverLayout.elements.find((item) => item.role === role)?.fontFamily || "";
  }

  function setCoverFont(role: "title" | "tagline" | "author", fontFamily: string) {
    if (!book || screen?.kind !== "cover") return;
    const layout = book.coverLayout;
    writeLayout(screen, {
      ...layout,
      elements: layout.elements.map((item) => (item.role === role ? { ...item, fontFamily } : item)),
    });
  }

  function addText() {
    if (!screen) return;
    const layout = layoutOf(screen);
    const element: PageElement = {
      id: newElementId(),
      type: "text",
      x: 56,
      y: 18 + (layout.elements.filter((item) => item.type === "text").length % 4) * 10,
      w: 38,
      h: 16,
      z: 40 + layout.elements.filter((item) => item.type === "text").length,
      text: "New wording",
      role: screen.kind === "end" ? "end" : screen.kind === "back" ? "back" : "body",
      fontSize: 3.6,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
  }

  function addPage() {
    const current = bookRef.current;
    if (!current) return;
    const page = emptyStoryPage(current.pages.length);
    const pages = [...current.pages, page];
    persist({ ...current, pages });
    const nextStory = visibleStoryPages({ ...current, pages });
    setIndex(storyScreenIndex(current, Math.max(0, nextStory.length - 1)));
    setSelectedId(page.elements[0]?.id || "");
  }

  function removePage() {
    const current = bookRef.current;
    if (!current) return;
    const target = screenAtIndex(current, indexRef.current);
    if (!target) return;
    const storyNow = visibleStoryPages(current);
    if (target.kind === "title") {
      if (!window.confirm("Remove the title page from this book? (Cover and story pages stay.)")) return;
      setError("");
      const nextBook = {
        ...current,
        showTitlePage: false,
        titleLayout: { elements: [], background: "" },
      };
      persist(nextBook, { saveNow: true });
      setSelectedId("");
      setEditingId("");
      setIndex(storyNow.length ? storyScreenStart(nextBook) : 1);
      setStatus("Title page removed");
      return;
    }
    if (target.kind !== "page") {
      setError("");
      setStatus("Pick Title or a story page (Page 1, 2, …) in the Screen menu, then Delete page.");
      return;
    }
    const pageId = target.pageId;
    if (!canDeleteStoryPage(current, pageId)) {
      setError("Keep at least one story page in the book.");
      return;
    }
    const pages = current.pages.filter((page) => page.id !== pageId);
    if (pages.length === current.pages.length) {
      setError("That page could not be found in the book data.");
      return;
    }
    const deleteLabel = screenLabel(target, storyNow);
    if (!window.confirm(`Remove “${deleteLabel}” from this book?`)) return;
    setError("");
    const deletedOrd = storyNow.findIndex((page) => page.id === pageId);
    const nextStoryPages = visibleStoryPages(syncBookFromLayouts({ ...current, pages }));
    const nextOrd = deletedOrd >= 0 ? Math.min(deletedOrd, nextStoryPages.length - 1) : 0;
    persist({ ...current, pages }, { saveNow: true });
    setSelectedId("");
    setEditingId("");
    setIndex(storyScreenIndex(current, nextOrd));
    setStatus(`Removed ${deleteLabel}`);
  }

  function removeElement() {
    if (!screen || !selectedId) return;
    const layout = layoutOf(screen);
    writeLayout(screen, { ...layout, elements: layout.elements.filter((item) => item.id !== selectedId) });
    setSelectedId("");
    setEditingId("");
  }

  async function onPickFile(file: File) {
    const uploaded = await uploadBookAsset(file, file.name);
    if (replaceId.current && screen) {
      patchElement(replaceId.current, { imageAsset: uploaded.filename, imageUrl: uploaded.url, focusX: 50, focusY: 50 });
      replaceId.current = "";
      return;
    }
    if (!screen) return;
    const layout = layoutOf(screen);
    const onRight = layout.elements.some((item) => item.type === "image");
    const element: PageElement = {
      id: newElementId(),
      type: "image",
      x: onRight ? 56 : 0,
      y: 25,
      w: onRight ? 38 : 50,
      h: 50,
      z: 1 + layout.elements.filter((item) => item.type === "image").length,
      imageAsset: uploaded.filename,
      imageUrl: uploaded.url,
      fit: "cover",
      focusX: 50,
      focusY: 50,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
  }

  function applySample(color: string) {
    if (!book || !screen || !color) return;
    const current = layoutOf(screen).elements.find((item) => item.id === selectedId);
    if (picking === "text" && current) patchElement(current.id, { color });
    else if (picking === "frame" && current) patchElement(current.id, { frameColor: color });
    else if (picking === "shape" && current) patchElement(current.id, { color });
    else if (picking === "page") writeLayout(screen, { ...layoutOf(screen), background: color });
    else if (picking === "ink") {
      const current = bookRef.current;
      if (current) persist({ ...current, textColor: color });
    }
    setPicking("");
    setStatus("Matched");
  }

  function onPointerDown(event: React.PointerEvent, element: PageElement, mode: "move" | "resize") {
    if (picking) {
      event.preventDefault();
      event.stopPropagation();
      const page = pageRef.current;
      const color = page ? samplePicture(page, event.clientX, event.clientY) : "";
      if (color) applySample(color);
      else setStatus("Click the picture");
      return;
    }
    if (editingId === element.id && mode === "move") return;
    event.preventDefault();
    event.stopPropagation();
    const cropThis = cropping && element.type === "image" && element.id === selectedId && mode === "move";
    if (!cropThis && element.id !== selectedId) setCropping(false);
    setSelectedId(element.id);
    setEditingId("");
    const page = pageRef.current;
    if (!page) return;
    pushUndoSnapshot();
    drag.current = {
      id: element.id,
      mode: cropThis ? "crop" : mode,
      startX: event.clientX,
      startY: event.clientY,
      orig: { ...element, fit: cropThis ? "cover" : element.fit },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    const page = pageRef.current;
    if (!state || !page) return;
    const rect = page.getBoundingClientRect();
    const dx = ((event.clientX - state.startX) / rect.width) * 100;
    const dy = ((event.clientY - state.startY) / rect.height) * 100;
    if (state.mode === "crop") {
      patchElement(state.id, { fit: "cover", ...panImageFocus(state.orig, dx, dy) }, { recordUndo: false });
      return;
    }
    if (state.mode === "move") {
      patchElement(state.id, {
        x: Math.min(100 - state.orig.w, Math.max(0, state.orig.x + dx)),
        y: Math.min(100 - state.orig.h, Math.max(0, state.orig.y + dy)),
      }, { recordUndo: false });
      return;
    }
    const next = {
      w: Math.min(100 - state.orig.x, Math.max(state.orig.type === "image" ? 1 : 8, state.orig.w + dx)),
      h: Math.min(100 - state.orig.y, Math.max(state.orig.type === "image" ? 1 : 8, state.orig.h + dy)),
    };
    patchElement(state.id, state.orig.type === "image" ? { ...next, fit: "cover" } : next, { recordUndo: false });
  }

  function onPointerUp() {
    drag.current = null;
  }

  bookRef.current = book;
  screenRef.current = screen;
  indexRef.current = index;
  selectedIdRef.current = selectedId;

  function copySelection(event?: ClipboardEvent) {
    const current = bookRef.current;
    const target = screenRef.current;
    const id = selectedIdRef.current;
    if (!current || !target || !id) return;
    const layout = target.kind === "cover" ? current.coverLayout
      : target.kind === "back" ? current.backCoverLayout
        : target.kind === "title" ? current.titleLayout
          : target.kind === "end" ? current.endLayout
            : current.pages.find((page) => page.id === target.pageId) || { elements: [], background: "" };
    const element = layout.elements.find((item) => item.id === id);
    if (!element) return;
    const encoded = encodeElementClipboard(element);
    const plain = element.type === "text" ? (element.text || "") : encoded;
    clipboardRef.current = { element: { ...element }, plain };
    pasteNudge.current = 0;
    if (event) {
      event.preventDefault();
      event.clipboardData?.setData("text/plain", plain);
      event.clipboardData?.setData(ELEMENT_CLIPBOARD_MIME, encoded);
    } else {
      void navigator.clipboard?.writeText(plain).catch(() => {});
    }
    setStatus("Copied");
  }

  function insertCopied(source: PageElement) {
    if (!book || !screen) return;
    const layout = layoutOf(screen);
    pasteNudge.current += 1;
    const element = duplicateElement(source, layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1, 3 * pasteNudge.current);
    element.role = source.type === "text" ? pastedRole(source, screen) : undefined;
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
    setEditingId("");
    setCropping(false);
    setStatus("Pasted");
  }

  function insertText(text: string) {
    if (!book || !screen) return;
    const layout = layoutOf(screen);
    const current = layout.elements.find((item) => item.id === selectedId);
    if (current?.type === "text") {
      patchElement(current.id, { text });
      setStatus("Pasted");
      return;
    }
    const element: PageElement = {
      id: newElementId(),
      type: "text",
      x: 56,
      y: 18,
      w: 38,
      h: 16,
      z: layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      text,
      role: screen.kind === "end" ? "end" : screen.kind === "back" ? "back" : "body",
      fontSize: 3.6,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
    setEditingId("");
    setStatus("Pasted");
  }

  async function pasteFromButton() {
    try {
      const text = await navigator.clipboard.readText();
      const decoded = decodeElementClipboard(text);
      if (decoded) {
        insertCopied(decoded);
        return;
      }
      if (clipboardRef.current && text === clipboardRef.current.plain) {
        insertCopied(clipboardRef.current.element);
        return;
      }
      if (text.trim()) {
        insertText(text.replace(/\r\n/g, "\n"));
        return;
      }
    } catch {
      if (clipboardRef.current) {
        insertCopied(clipboardRef.current.element);
        return;
      }
    }
    setStatus("Copy an item first");
  }

  function pasteSelection(event: ClipboardEvent) {
    if (isTypingTarget(event.target)) return;
    const plain = event.clipboardData?.getData("text/plain") || "";
    const custom = event.clipboardData?.getData(ELEMENT_CLIPBOARD_MIME) || "";
    const decoded = decodeElementClipboard(custom) || decodeElementClipboard(plain);
    const remembered = clipboardRef.current && plain === clipboardRef.current.plain ? clipboardRef.current.element : null;
    const source = decoded || remembered;
    if (source) {
      event.preventDefault();
      insertCopied(source);
      return;
    }
    const text = plain.replace(/\r\n/g, "\n");
    if (!text.trim()) return;
    event.preventDefault();
    insertText(text);
  }

  copyRef.current = copySelection;
  pasteRef.current = pasteSelection;
  undoRef.current = undo;

  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (isTypingTarget(event.target)) return;
      copyRef.current(event);
    }
    function onPaste(event: ClipboardEvent) {
      pasteRef.current(event);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        undoRef.current();
      }
    }
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    setCropping(false);
  }, [selectedId, index]);

  if (!ready) return <main className="page-editor"><p className="page-editor-status">Loading…</p></main>;
  if (error && !book) {
    return (
      <main className="page-editor">
        <p className="error">{error}</p>
        <Link href="/admin">Back to Admin</Link>
      </main>
    );
  }
  if (!book || !screen) return null;

  const layout = layoutOf(screen);
  const fill = pageFill(layout.background, book.pageBackground);
  const selected = layout.elements.find((item) => item.id === selectedId);
  const selectedText = selected?.type === "text" ? selected : undefined;
  const bookFont = book.textFont || DEFAULT_TEXT_FONT;
  const bookInk = book.textColor || DEFAULT_TEXT_COLOR;
  const label = screenLabel(screen, storyPages);

  return (
    <main className="page-editor">
      <header className="page-editor-bar">
        <Link href="/admin" className="ghost">Close</Link>
        <button type="button" className="ghost" disabled={index === 0} onClick={() => { setIndex(index - 1); setSelectedId(""); setEditingId(""); }}>Previous</button>
        <strong>{book.title}</strong>
        <span>Flipbook display</span>
        <label className="page-editor-screen">
          Screen
          <select
            value={index}
            onChange={(event) => {
              setIndex(Number(event.target.value));
              setSelectedId("");
              setEditingId("");
            }}
          >
            {screens.map((item, screenIndex) => (
              <option key={`${item.kind}-${item.kind === "page" ? item.pageId : screenIndex}`} value={screenIndex}>
                {screenLabel(item, storyPages)}
              </option>
            ))}
          </select>
        </label>
        <span>{label} of {screens.length}</span>
        <button type="button" className="ghost" disabled={index === screens.length - 1} onClick={() => { setIndex(index + 1); setSelectedId(""); setEditingId(""); }}>Next</button>
        <span className="page-editor-status">{status}</span>
      </header>
      <div className="page-editor-tools">
        <button type="button" onClick={addText}>Add wording</button>
        <button type="button" onClick={() => addShape("rectangle")}>Rectangle</button>
        <button type="button" onClick={() => addShape("circle")}>Circle</button>
        <button type="button" onClick={() => { replaceId.current = ""; fileRef.current?.click(); }}>Add picture</button>
        <button type="button" onClick={addPage}>Add page</button>
        <button
          type="button"
          className={!canDeleteCurrentScreen(book, screen) ? "muted-tool" : undefined}
          onClick={removePage}
          title={
            screen.kind === "title"
              ? "Remove the title page from the flipbook and reader."
              : screen.kind === "page"
                ? (!canDeleteStoryPage(book, screen.pageId)
                  ? "Keep at least one story page in the book."
                  : "Remove this story page from the book.")
                : "Open Title or a story page (Page 1, 2, …) in the Screen menu first."
          }
        >
          Delete page
        </button>
        <button type="button" disabled={!selectedId} onClick={removeElement}>Delete item</button>
        <button type="button" disabled={!selectedId} onClick={() => copyRef.current()}>Copy</button>
        <button type="button" onClick={() => { void pasteFromButton(); }}>Paste</button>
        <button type="button" disabled={!canUndo} onClick={() => undo()}>Undo</button>
        {selectedId ? (
          <div className="page-editor-align" role="group" aria-label="Arrange">
            <button type="button" onClick={() => arrange("front")}>In front</button>
            <button type="button" onClick={() => arrange("forward")}>Forward</button>
            <button type="button" onClick={() => arrange("backward")}>Backward</button>
            <button type="button" onClick={() => arrange("back")}>Back</button>
          </div>
        ) : null}
        {screen.kind === "back" ? <span className="hint">Print only. This cover is not shown in the online book.</span> : null}
        {screen.kind === "cover" ? (
          <>
            <label className="page-editor-font">
              Title font
              <FontSelect allowBook value={coverFont("title")} onChange={(fontFamily) => setCoverFont("title", fontFamily)} />
            </label>
            <label className="page-editor-font">
              Subtitle font
              <FontSelect allowBook value={coverFont("tagline")} onChange={(fontFamily) => setCoverFont("tagline", fontFamily)} />
            </label>
            <label className="page-editor-font">
              Author font
              <FontSelect allowBook value={coverFont("author")} onChange={(fontFamily) => setCoverFont("author", fontFamily)} />
            </label>
          </>
        ) : null}
        {selected?.type === "image" ? (
          <>
            <button type="button" className={imageObjectFit(selected) === "cover" ? "active" : ""} onClick={() => patchElement(selected.id, { fit: "cover" })}>Fill frame</button>
            <button type="button" className={selected.fit === "contain" ? "active" : ""} onClick={() => { setCropping(false); patchElement(selected.id, { fit: "contain" }); }}>Show whole</button>
            <button
              type="button"
              className={cropping ? "active" : ""}
              onClick={() => {
                if (!cropping) patchElement(selected.id, { fit: "cover" });
                setCropping(!cropping);
              }}
            >Crop</button>
            <button type="button" onClick={() => { replaceId.current = selectedId; fileRef.current?.click(); }}>Replace picture</button>
            <label className="page-editor-size">
              Fade
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={selected.opacity ?? 100}
                onChange={(event) => patchElement(selected.id, { opacity: Number(event.target.value) })}
              />
              <span>{Math.round(selected.opacity ?? 100)}%</span>
            </label>
          </>
        ) : null}
        {cropping ? <span className="hint">Drag the picture to choose the crop. It keeps its shape and fills the frame.</span> : null}
        {selected?.type === "shape" ? (
          <>
            <label className="page-editor-color">
              Shape color
              <input type="color" value={normalizeColor(selected.color, "") || "#ffffff"} onChange={(event) => patchElement(selected.id, { color: event.target.value })} />
              <button type="button" className={picking === "shape" ? "active" : "ghost"} onClick={() => setPicking(picking === "shape" ? "" : "shape")}>{picking === "shape" ? "Click the picture" : "Match picture"}</button>
            </label>
            <label className="page-editor-size">
              Fade
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={selected.opacity ?? 100}
                onChange={(event) => patchElement(selected.id, { opacity: Number(event.target.value) })}
              />
              <span>{Math.round(selected.opacity ?? 100)}%</span>
            </label>
          </>
        ) : null}
        <label className="page-editor-font">
          Book font
          <FontSelect value={bookFont} onChange={(textFont) => persist({ ...book, textFont })} />
        </label>
        <label className="page-editor-color">
          Book ink
          <input type="color" value={bookInk} onChange={(event) => persist({ ...book, textColor: event.target.value })} />
        </label>
        {selectedText ? (
          <>
            <label className="page-editor-font">
              This wording
              <FontSelect allowBook value={selectedText.fontFamily || ""} onChange={(fontFamily) => patchElement(selectedText.id, { fontFamily })} />
            </label>
            <label className="page-editor-size">
              Size
              <input
                type="range"
                min="2"
                max="14"
                step="0.2"
                value={selectedText.fontSize || 4}
                onChange={(event) => patchElement(selectedText.id, { fontSize: Number(event.target.value) })}
              />
              <span>{Number(selectedText.fontSize || 4).toFixed(1)}</span>
              {(selectedText.role === "body" || !selectedText.role) ? (
                <button type="button" className="ghost" onClick={() => applyStorySize(selectedText.fontSize || 4)}>All pages</button>
              ) : null}
            </label>
            <label className="page-editor-color">
              Text color
              <input
                type="color"
                value={normalizeColor(selectedText.color, "") || bookInk}
                onChange={(event) => patchElement(selectedText.id, { color: event.target.value })}
              />
              <button type="button" className={picking === "text" ? "active" : "ghost"} onClick={() => setPicking(picking === "text" ? "" : "text")}>{picking === "text" ? "Click the picture" : "Match picture"}</button>
            </label>
            <div className="page-editor-align" role="group" aria-label="Alignment">
              {(["left", "center", "right"] as TextAlign[]).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={(selectedText.align || "left") === align ? "active" : ""}
                  aria-pressed={(selectedText.align || "left") === align}
                  onClick={() => patchElement(selectedText.id, { align })}
                >{align[0].toUpperCase() + align.slice(1)}</button>
              ))}
            </div>
            <label className="page-editor-font">
              Frame
              <select
                value={selectedText.frame || ""}
                onChange={(event) => patchElement(selectedText.id, { frame: event.target.value })}
              >
                {TEXT_FRAMES.filter((frame) => frame.kind === "none").map((frame) => (
                  <option key={frame.id || "none"} value={frame.id}>{frame.label}</option>
                ))}
                <optgroup label="Straight">
                  {TEXT_FRAMES.filter((frame) => frame.kind === "straight").map((frame) => (
                    <option key={frame.id} value={frame.id}>{frame.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Decorative">
                  {TEXT_FRAMES.filter((frame) => frame.kind === "decorative").map((frame) => (
                    <option key={frame.id} value={frame.id}>{frame.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {normalizeFrame(selectedText.frame) ? (
              <label className="page-editor-color">
                Frame color
                <input
                  type="color"
                  value={normalizeColor(selectedText.frameColor, "") || bookInk}
                  onChange={(event) => patchElement(selectedText.id, { frameColor: event.target.value })}
                />
                <button type="button" className={picking === "frame" ? "active" : "ghost"} onClick={() => setPicking(picking === "frame" ? "" : "frame")}>{picking === "frame" ? "Click the picture" : "Match picture"}</button>
              </label>
            ) : null}
            <button type="button" className="ghost" onClick={() => patchElement(selectedText.id, { color: "", fontFamily: "" })}>Use book type</button>
          </>
        ) : null}
        <div className="page-editor-paper">
          <span>Page background</span>
          <div className="page-editor-papers" role="group" aria-label="Page background">
            <button
              type="button"
              className={!book.pageTexture ? "active" : ""}
              aria-pressed={!book.pageTexture}
              aria-label="Plain"
              title="Plain"
              style={{ backgroundColor: fill }}
              onClick={() => persist({ ...book, pageTexture: "" })}
            />
            {PAPER_TEXTURES.map((texture) => (
              <button
                key={texture.id}
                type="button"
                className={book.pageTexture === texture.id ? "active" : ""}
                aria-pressed={book.pageTexture === texture.id}
                aria-label={texture.label}
                title={texture.label}
                style={paperSwatchStyle(fill, texture.id)}
                onClick={() => persist({ ...book, pageTexture: texture.id })}
              />
            ))}
          </div>
          <span className="page-editor-paper-name">{PAPER_TEXTURES.find((texture) => texture.id === book.pageTexture)?.label || "Plain"}</span>
        </div>
        <label className="page-editor-color">
          Book color
          <input type="color" value={book.pageBackground || DEFAULT_PAGE_BACKGROUND} onChange={(event) => persist({ ...book, pageBackground: event.target.value })} />
        </label>
        <label className="page-editor-color">
          Around the book
          <input type="color" value={book.spreadBackground || DEFAULT_SPREAD_BACKGROUND} onChange={(event) => persist({ ...book, spreadBackground: event.target.value })} />
        </label>
        <label className="page-editor-color">
          This page
          <input
            type="color"
            value={layout.background || book.pageBackground || DEFAULT_PAGE_BACKGROUND}
            onChange={(event) => writeLayout(screen, { ...layout, background: event.target.value })}
          />
          <button type="button" className={picking === "page" ? "active" : "ghost"} onClick={() => setPicking(picking === "page" ? "" : "page")}>{picking === "page" ? "Click the picture" : "Match picture"}</button>
        </label>
        <button type="button" className="ghost" onClick={() => writeLayout(screen, { ...layout, background: "" })}>Use book color</button>
      </div>
      <div className="page-editor-swatches" role="list">
        {(selectedText ? TEXT_INK_PALETTE : PAGE_COLOR_PALETTE).map((color) => (
          <button
            key={color}
            type="button"
            className="page-editor-swatch"
            style={{ background: color }}
            aria-label={selectedText ? `Text color ${color}` : `Page color ${color}`}
            onClick={() => selectedText
              ? patchElement(selectedText.id, { color })
              : selected?.type === "shape"
                ? patchElement(selected.id, { color })
                : writeLayout(screen, { ...layout, background: color })}
          />
        ))}
      </div>
      <div className="page-editor-stage" ref={stageRef} style={{ background: book.spreadBackground || DEFAULT_SPREAD_BACKGROUND }}>
        <div
          className="page-editor-book"
          style={bookBox.width ? {
            width: bookBox.width,
            height: bookBox.height,
            ["--spine-w" as string]: `${Math.max(36, bookBox.width * (84 / Math.max(320, window.innerWidth - 40)))}px`,
          } : undefined}
        >
          <div
            ref={pageRef}
            className={`page-editor-page${picking ? " picking" : ""}`}
            style={paperSurfaceStyle(fill, book.pageTexture)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onMouseDown={() => { setSelectedId(""); setEditingId(""); }}
          >
            {layout.elements.slice().sort((a, b) => a.z - b.z).map((element) => (
              <div
                key={element.id}
                className={`page-editor-el${selectedId === element.id ? " selected" : ""}${element.type === "image" ? " image" : ""}${cropping && selectedId === element.id && element.type === "image" ? " cropping" : ""}${element.type === "text" ? ` ${frameClass(element.frame)}` : ""}`}
                style={{
                  left: `${element.x}%`,
                  top: `${element.y}%`,
                  width: `${element.w}%`,
                  height: `${element.h}%`,
                  zIndex: element.z,
                  ["--frame" as string]: element.type === "text"
                    ? (normalizeColor(element.frameColor, "") || bookInk || DEFAULT_FRAME_COLOR)
                    : undefined,
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => onPointerDown(event, element, "move")}
                onDoubleClick={() => {
                  if (element.type === "text") setEditingId(element.id);
                }}
              >
                {element.type === "text" && frameMarkup(element.frame, element.w / element.h) ? (
                  <span className="page-editor-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
                ) : null}
                {element.type === "shape" ? (
                  <div style={{ width: "100%", height: "100%", background: normalizeColor(element.color, "") || "#ffffff", opacity: (element.opacity ?? 100) / 100, borderRadius: element.shape === "circle" ? "50%" : "2%" }} />
                ) : element.type === "image" ? (
                    element.imageUrl ? <img src={element.imageUrl} alt="" style={{ objectFit: imageObjectFit(element), objectPosition: imageObjectPosition(element), opacity: (element.opacity ?? 100) / 100, background: "transparent" }} /> : <span className="page-editor-empty">Picture</span>
                ) : editingId === element.id ? (
                  <textarea
                    autoFocus
                    value={element.text || ""}
                    style={{
                      fontFamily: fontStack(element.fontFamily || bookFont),
                      fontSize: `${element.fontSize || 4}cqh`,
                      color: normalizeColor(element.color, "") || bookInk,
                      textAlign: element.align || "left",
                      whiteSpace: element.id === "back-title" ? "nowrap" : undefined,
                    }}
                    onChange={(event) => patchElement(element.id, { text: event.target.value })}
                    onKeyDown={(event) => event.stopPropagation()}
                    onBlur={() => setEditingId("")}
                  />
                ) : (
                  <EditorText
                    text={element.text || ""}
                    placeholder="Double-click to type"
                    style={{
                      fontFamily: fontStack(element.fontFamily || bookFont),
                      fontSize: `${element.fontSize || 4}cqh`,
                      color: normalizeColor(element.color, "") || bookInk,
                      textAlign: element.align || "left",
                      alignItems: alignJustify(element.align),
                      whiteSpace: element.id === "back-title" ? "nowrap" : undefined,
                    }}
                  />
                )}
                {selectedId === element.id ? (
                  <button type="button" className="page-editor-handle" aria-label="Resize" onPointerDown={(event) => onPointerDown(event, element, "resize")} />
                ) : null}
              </div>
            ))}
            {(screen.kind === "end" || screen.kind === "back") && (logoUrl || credits || copyright || book.date) ? (
              <footer className={`page-editor-legal${screen.kind === "back" ? " leaf" : ""}`}>
                {logoUrl ? <img className="page-editor-logo" src={logoUrl} alt="Spodazo Books" /> : null}
                {publishedLabel(book.date) ? <p>{publishedLabel(book.date)}</p> : null}
                {credits ? <p>{credits}</p> : null}
                {copyright ? <p>{copyright}</p> : null}
              </footer>
            ) : null}
          </div>
          {screen.kind === "cover" || screen.kind === "back" ? null : <div className="page-editor-spine" aria-hidden="true" />}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void onPickFile(file).catch((err: Error) => setError(err.message));
      }} />
      {error ? <p className="error page-editor-error">{error}</p> : null}
    </main>
  );
}
