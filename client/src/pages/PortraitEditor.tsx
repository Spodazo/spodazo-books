import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  BOOK_FONTS,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT,
  cursiveFonts,
  fontStack,
  googleFontsHref,
  straightFonts,
} from "@shared/book-fonts";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SPREAD_BACKGROUND,
  PAGE_COLOR_PALETTE,
  decodeElementClipboard,
  duplicateElement,
  ELEMENT_CLIPBOARD_MIME,
  encodeElementClipboard,
  imageObjectFit,
  imageObjectPosition,
  newElementId,
  normalizeColor,
  pageFill,
  ensureBookLayouts,
} from "@shared/page-layout";
import { PAPER_TEXTURES, paperSwatchStyle } from "@shared/paper";
import { paletteById } from "@shared/palettes";
import {
  PORTRAIT_PAGE_RATIO,
  mergePortraitPagesIntoBook,
  portraitFlipRole,
  portraitPagesForEditor,
  portraitPhoneViewportHeight,
} from "@shared/portrait-pages";
import { characterUrlFor } from "@shared/reader-pages";
import type { PageElement, PageLayout, PublicBook, TextAlign } from "@shared/types";
import PortraitMobileMirror from "../components/PortraitMobileMirror";
import { adminMe, fetchBook, updateBook, uploadBookAsset } from "../lib/api";

const WINDOW = 4;
const UNDO_LIMIT = 50;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
}

function cloneBook(book: PublicBook): PublicBook {
  return JSON.parse(JSON.stringify(book)) as PublicBook;
}

function pastedRole(source: PageElement, pageIndex: number, pages: PageLayout[]): PageElement["role"] | undefined {
  if (source.type !== "text") return undefined;
  if (source.role === "body" || source.role === "end" || source.role === "back") return source.role;
  const pageRole = portraitFlipRole(pages[pageIndex] || { elements: [] }, pageIndex);
  if (pageRole === "end") return "end";
  if (pageRole === "title" && source.role) return source.role;
  return "body";
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

type DragState = {
  id: string;
  from: number;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  orig: PageElement;
};

export default function PortraitEditorPage() {
  const [, params] = useRoute("/admin/portrait/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const [book, setBook] = useState<PublicBook | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState(0);
  const [focus, setFocus] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState("Saved");
  const [canUndo, setCanUndo] = useState(false);
  const [pageBox, setPageBox] = useState({ width: 180, phoneHeight: 390 });
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef("");
  const saveTimer = useRef<number>();
  const bookRef = useRef<PublicBook | null>(null);
  const startRef = useRef(0);
  const drag = useRef<DragState | null>(null);
  const dragMoved = useRef(false);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<PublicBook[]>([]);
  const restoringRef = useRef(false);
  const deferUndoRef = useRef(false);
  const clipboardRef = useRef<{ element: PageElement; plain: string } | null>(null);
  const pasteNudge = useRef(0);
  const selectedIdRef = useRef("");
  const focusIndexRef = useRef(0);
  const copyRef = useRef<(event?: ClipboardEvent) => void>(() => {});
  const pasteRef = useRef<(event: ClipboardEvent) => void>(() => {});
  const undoRef = useRef<() => void>(() => {});

  useEffect(() => {
    bookRef.current = book;
  }, [book]);
  useEffect(() => {
    startRef.current = start;
  }, [start]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    focusIndexRef.current = focus;
  }, [focus]);
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
      const styles = getComputedStyle(stage);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availW = Math.max(240, stage.clientWidth - padX);
      const availH = Math.max(180, stage.clientHeight - padY - 36);
      const gap = 16;
      let width = (availW - gap * (WINDOW - 1)) / WINDOW;
      let phoneHeight = portraitPhoneViewportHeight(width);
      if (phoneHeight > availH) {
        phoneHeight = availH;
        width = phoneHeight * PORTRAIT_PAGE_RATIO;
      }
      setPageBox({ width, phoneHeight });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [ready, book]);

  useEffect(() => {
    let cancelled = false;
    adminMe()
      .then(async (me) => {
        if (!me.admin) {
          setLocation("/admin");
          return;
        }
        const next = await fetchBook(slug);
        if (cancelled) return;
        const designed = ensureBookLayouts(next, { coverUrl: next.coverUrl, characterUrl: characterUrlFor(next) });
        const portraitPages = portraitPagesForEditor(designed);
        setBook({ ...designed, portraitPages });
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

  function applyBook(next: PublicBook) {
    const pages = next.portraitPages || [];
    const merged = mergePortraitPagesIntoBook(next, pages);
    bookRef.current = merged;
    setBook(merged);
    return merged;
  }

  function queueSave(next: PublicBook) {
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const pages = next.portraitPages || [];
      const merged = mergePortraitPagesIntoBook(next, pages);
      void updateBook(next.id, {
        portraitPages: pages,
        coverLayout: merged.coverLayout,
        titleLayout: merged.titleLayout,
        endLayout: merged.endLayout,
        pages: merged.pages,
        pageBackground: next.pageBackground,
        pageTexture: next.pageTexture,
        spreadBackground: next.spreadBackground,
        textFont: next.textFont,
        textColor: next.textColor,
      })
        .then(() => {
          if (bookRef.current?.id === next.id) setStatus("Saved");
        })
        .catch((err: Error) => {
          setStatus("");
          setError(err.message);
        });
    }, 700);
  }

  function commit(next: PublicBook, options?: { recordUndo?: boolean }) {
    const record = options?.recordUndo !== false && !restoringRef.current && !drag.current;
    if (record) pushUndoSnapshot();
    const merged = applyBook(next);
    queueSave(merged);
  }

  function updatePages(mutator: (pages: PageLayout[]) => PageLayout[], options?: { recordUndo?: boolean }) {
    const current = bookRef.current;
    if (!current) return;
    const record = options?.recordUndo ?? (!drag.current && !deferUndoRef.current);
    if (record) pushUndoSnapshot();
    const pages = mutator(current.portraitPages || []);
    const merged = applyBook({ ...current, portraitPages: pages });
    if (record) queueSave(merged);
  }

  function undo() {
    const stack = undoStack.current;
    if (stack.length < 2) return;
    stack.pop();
    const prev = stack[stack.length - 1];
    if (!prev) return;
    restoringRef.current = true;
    const merged = applyBook(prev);
    queueSave(merged);
    restoringRef.current = false;
    setCanUndo(stack.length >= 2);
    setSelectedId("");
    setEditingId("");
    setStatus("Undone");
  }

  function copySelection(event?: ClipboardEvent) {
    const current = bookRef.current;
    const id = selectedIdRef.current;
    const pageIndex = focusIndexRef.current;
    if (!current || !id) return;
    const layout = current.portraitPages?.[pageIndex];
    const element = layout?.elements.find((item) => item.id === id);
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
    const current = bookRef.current;
    const pageIndex = focusIndexRef.current;
    if (!current) return;
    const layout = current.portraitPages?.[pageIndex];
    if (!layout) return;
    pushUndoSnapshot();
    pasteNudge.current += 1;
    const pages = current.portraitPages || [];
    const element = duplicateElement(source, layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1, 3 * pasteNudge.current);
    element.role = pastedRole(source, pageIndex, pages);
    const nextPages = pages.map((page, index) => (
      index === pageIndex ? { ...page, elements: [...page.elements, element] } : page
    ));
    const merged = applyBook({ ...current, portraitPages: nextPages });
    queueSave(merged);
    setSelectedId(element.id);
    setEditingId("");
    setStatus("Pasted");
  }

  function insertText(text: string) {
    const current = bookRef.current;
    const pageIndex = focusIndexRef.current;
    if (!current) return;
    const pages = current.portraitPages || [];
    const layout = pages[pageIndex];
    if (!layout) return;
    const selected = layout.elements.find((item) => item.id === selectedIdRef.current);
    if (selected?.type === "text") {
      pushUndoSnapshot();
      place(pageIndex, pageIndex, selected.id, { text }, { recordUndo: false });
      if (bookRef.current) queueSave(bookRef.current);
      setStatus("Pasted");
      return;
    }
    pushUndoSnapshot();
    const element: PageElement = {
      id: newElementId(),
      type: "text",
      x: 10,
      y: 12,
      w: 80,
      h: 16,
      z: layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      text,
      role: portraitFlipRole(layout, pageIndex) === "end" ? "end" : "body",
      fontSize: 4,
      align: "left",
    };
    const nextPages = pages.map((page, index) => (
      index === pageIndex ? { ...page, elements: [...page.elements, element] } : page
    ));
    const merged = applyBook({ ...current, portraitPages: nextPages });
    queueSave(merged);
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
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        undoRef.current();
        return;
      }
      if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        void pasteFromButton();
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

  function place(from: number, to: number, id: string, patch: Partial<PageElement>, options?: { recordUndo?: boolean }) {
    updatePages((pages) => {
      const source = pages[from];
      const element = source?.elements.find((item) => item.id === id);
      if (!element) return pages;
      const next = { ...element, ...patch };
      if (from === to) {
        return pages.map((page, index) => (
          index === from ? { ...page, elements: page.elements.map((item) => (item.id === id ? next : item)) } : page
        ));
      }
      return pages.map((page, index) => {
        if (index === from) return { ...page, elements: page.elements.filter((item) => item.id !== id) };
        if (index === to) return { ...page, elements: [...page.elements, next] };
        return page;
      });
    }, options);
  }

  function beginDeferredEdit() {
    if (!deferUndoRef.current) {
      pushUndoSnapshot();
      deferUndoRef.current = true;
    }
  }

  function endDeferredEdit() {
    if (!deferUndoRef.current) return;
    deferUndoRef.current = false;
    const current = bookRef.current;
    if (current) queueSave(current);
  }

  const pages = book?.portraitPages || [];
  const lastStart = Math.max(0, pages.length - 1);
  const windowStart = Math.min(start, lastStart);
  const visible = pages.slice(windowStart, windowStart + WINDOW);

  function reveal(index: number) {
    setStart((current) => {
      if (index < current) return index;
      if (index >= current + WINDOW) return Math.max(0, index - WINDOW + 1);
      return current;
    });
  }

  function pageNearest(clientX: number, clientY: number, fallback: number) {
    const begin = startRef.current;
    const total = bookRef.current?.portraitPages?.length || 0;
    let best = fallback;
    let bestDist = Infinity;
    for (let index = begin; index < begin + WINDOW && index < total; index += 1) {
      const node = pageRefs.current[index];
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    }
    return best;
  }

  function onDrag(event: PointerEvent) {
    const state = drag.current;
    if (!state) return;
    if (!dragMoved.current) {
      pushUndoSnapshot();
      dragMoved.current = true;
    }
    if (state.mode === "resize") {
      const page = pageRefs.current[state.from];
      if (!page) return;
      const rect = page.getBoundingClientRect();
      const dx = ((event.clientX - state.startX) / rect.width) * 100;
      const dy = ((event.clientY - state.startY) / rect.height) * 100;
      const min = state.orig.type === "image" ? 1 : 8;
      place(state.from, state.from, state.id, {
        w: Math.min(100 - state.orig.x, Math.max(min, state.orig.w + dx)),
        h: Math.min(100 - state.orig.y, Math.max(min, state.orig.h + dy)),
      });
      return;
    }
    const target = pageNearest(event.clientX, event.clientY, state.from);
    const page = pageRefs.current[target];
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const current = bookRef.current?.portraitPages?.[state.from]?.elements.find((item) => item.id === state.id);
    const w = current?.w ?? state.orig.w;
    const h = current?.h ?? state.orig.h;
    const x = Math.min(100 - w, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100 - state.offsetX));
    const y = Math.min(100 - h, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100 - state.offsetY));
    place(state.from, target, state.id, { x, y });
    state.from = target;
  }

  function onVisualPointerDown(event: React.PointerEvent, pageIndex: number, layout: PageLayout) {
    const target = event.target as HTMLElement;
    if (target.closest(".portrait-edit-hit") || target.closest(".page-editor-handle")) return;
    const marked = target.closest("[data-id]");
    if (!marked?.closest(".portrait-mirror-visual")) return;
    const id = marked.getAttribute("data-id");
    const element = layout.elements.find((item) => item.id === id);
    if (!element) return;
    onPointerDown(event, pageIndex, element, "move");
  }

  function onPointerDown(event: React.PointerEvent, pageIndex: number, element: PageElement, mode: "move" | "resize") {
    if (editingId === element.id && mode === "move") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    setFocus(pageIndex);
    setEditingId("");
    const page = pageRefs.current[pageIndex];
    if (!page) return;
    const rect = page.getBoundingClientRect();
    dragMoved.current = false;
    drag.current = {
      id: element.id,
      from: pageIndex,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: ((event.clientX - rect.left) / rect.width) * 100 - element.x,
      offsetY: ((event.clientY - rect.top) / rect.height) * 100 - element.y,
      orig: { ...element },
    };
    const move = (ev: PointerEvent) => onDrag(ev);
    const up = () => {
      const current = bookRef.current;
      drag.current = null;
      if (dragMoved.current && current) queueSave(current);
      dragMoved.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function selectedAt() {
    if (!selectedId) return null;
    for (let index = 0; index < pages.length; index += 1) {
      const element = pages[index].elements.find((item) => item.id === selectedId);
      if (element) return { index, element };
    }
    return null;
  }

  const selected = selectedAt();
  const selectedText = selected?.element.type === "text" ? selected.element : undefined;
  const focusIndex = Math.min(focus, Math.max(0, pages.length - 1));

  function patchSelected(patch: Partial<PageElement>) {
    if (!selected) return;
    place(selected.index, selected.index, selected.element.id, patch);
  }

  function addText() {
    const layout = pages[focusIndex];
    if (!layout) return;
    const element: PageElement = {
      id: newElementId(),
      type: "text",
      x: 10,
      y: 12 + (layout.elements.filter((item) => item.type === "text").length % 4) * 8,
      w: 80,
      h: 16,
      z: layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      text: "New wording",
      role: "body",
      fontSize: 4,
      align: "center",
    };
    updatePages((list) => list.map((page, index) => (
      index === focusIndex ? { ...page, elements: [...page.elements, element] } : page
    )));
    setSelectedId(element.id);
    reveal(focusIndex);
  }

  function addShape(shape: "rectangle" | "circle") {
    const layout = pages[focusIndex];
    if (!layout) return;
    const element: PageElement = {
      id: newElementId(),
      type: "shape",
      shape,
      x: 30,
      y: 30,
      w: shape === "circle" ? 28 : 40,
      h: shape === "circle" ? 22 : 16,
      z: layout.elements.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      color: "#ffffff",
      opacity: 70,
    };
    updatePages((list) => list.map((page, index) => (
      index === focusIndex ? { ...page, elements: [...page.elements, element] } : page
    )));
    setSelectedId(element.id);
  }

  function addPage() {
    const at = focusIndex + 1;
    updatePages((list) => {
      const next = list.slice();
      next.splice(at, 0, { elements: [], background: "" });
      return next;
    });
    setFocus(at);
    setSelectedId("");
    reveal(at);
  }

  function removePage() {
    if (pages.length < 2) return;
    updatePages((list) => list.filter((_, index) => index !== focusIndex));
    const next = Math.max(0, focusIndex - 1);
    setFocus(next);
    setSelectedId("");
    reveal(next);
  }

  function removeElement() {
    if (!selected) return;
    updatePages((list) => list.map((page, index) => (
      index === selected.index ? { ...page, elements: page.elements.filter((item) => item.id !== selected.element.id) } : page
    )));
    setSelectedId("");
    setEditingId("");
  }

  async function onPickFile(file: File) {
    const uploaded = await uploadBookAsset(file, file.name);
    if (replaceId.current && selected) {
      place(selected.index, selected.index, replaceId.current, { imageAsset: uploaded.filename, imageUrl: uploaded.url, focusX: 50, focusY: 50 });
      replaceId.current = "";
      return;
    }
    const layout = pages[focusIndex];
    if (!layout) return;
    const element: PageElement = {
      id: newElementId(),
      type: "image",
      x: 8,
      y: 8,
      w: 84,
      h: 70,
      z: 1 + layout.elements.filter((item) => item.type === "image").length,
      imageAsset: uploaded.filename,
      imageUrl: uploaded.url,
      fit: "cover",
      focusX: 50,
      focusY: 50,
    };
    updatePages((list) => list.map((page, index) => (
      index === focusIndex ? { ...page, elements: [...page.elements, element] } : page
    )));
    setSelectedId(element.id);
  }

  if (!ready) return <main className="page-editor"><p className="page-editor-status">Loading…</p></main>;
  if (error && !book) {
    return (
      <main className="page-editor">
        <p className="error">{error}</p>
        <Link href="/admin">Back to Admin</Link>
      </main>
    );
  }
  if (!book) return null;

  const bookFont = book.textFont || DEFAULT_TEXT_FONT;
  const bookInk = book.textColor || DEFAULT_TEXT_COLOR;
  const palette = paletteById(book.color);
  const focusLayout = pages[focusIndex] || { elements: [], background: "" };
  const fill = pageFill(focusLayout.background, book.pageBackground);
  const previewStyle = {
    ["--title-bg" as string]: palette.bg,
    ["--title-ink" as string]: palette.text,
    ["--title-outline" as string]: palette.accent,
  };

  return (
    <main className="page-editor">
      <header className="page-editor-bar">
        <Link href="/admin" className="ghost">Close</Link>
        <Link href={`/admin/edit/${slug}`} className="ghost">Edit Flipbook Display</Link>
        <button type="button" className="ghost" disabled={windowStart === 0} onClick={() => setStart(Math.max(0, windowStart - 1))}>Previous</button>
        <strong>{book.title}</strong>
        <span>Portrait mobile display</span>
        <span>Pages {visible.length ? windowStart + 1 : 0}–{windowStart + visible.length} of {pages.length}</span>
        <button type="button" className="ghost" disabled={windowStart + WINDOW >= pages.length} onClick={() => setStart(windowStart + 1)}>Next</button>
        <span className="page-editor-status">{status}</span>
      </header>
      <div className="page-editor-tools">
        <button type="button" onClick={addText}>Add wording</button>
        <button type="button" onClick={() => addShape("rectangle")}>Rectangle</button>
        <button type="button" onClick={() => addShape("circle")}>Circle</button>
        <button type="button" onClick={() => { replaceId.current = ""; fileRef.current?.click(); }}>Add picture</button>
        <button type="button" onClick={addPage}>Add page</button>
        <button type="button" disabled={pages.length < 2} onClick={removePage}>Delete page</button>
        <button type="button" disabled={!selected} onClick={removeElement}>Delete item</button>
        <button type="button" disabled={!selected} onClick={() => copySelection()}>Copy</button>
        <button type="button" onClick={() => { void pasteFromButton(); }}>Paste</button>
        <button type="button" disabled={!canUndo} onClick={() => undo()}>Undo</button>
        <span className="hint">Click any item on the preview to select it, or use the spread boxes underneath. Double-click wording to edit. ⌘C / ⌘V / ⌘Z</span>
        {selected?.element.type === "image" ? (
          <>
            <button type="button" className={imageObjectFit(selected.element) === "cover" ? "active" : ""} onClick={() => patchSelected({ fit: "cover" })}>Fill frame</button>
            <button type="button" className={selected.element.fit === "contain" ? "active" : ""} onClick={() => patchSelected({ fit: "contain" })}>Show whole</button>
            <button type="button" onClick={() => { replaceId.current = selected.element.id; fileRef.current?.click(); }}>Replace picture</button>
          </>
        ) : null}
        <label className="page-editor-font">
          Book font
          <FontSelect value={bookFont} onChange={(textFont) => commit({ ...book, textFont })} />
        </label>
        <label className="page-editor-color">
          Book ink
          <input type="color" value={bookInk} onChange={(event) => commit({ ...book, textColor: event.target.value })} />
        </label>
        {selectedText ? (
          <>
            <label className="page-editor-font">
              This wording
              <FontSelect allowBook value={selectedText.fontFamily || ""} onChange={(fontFamily) => patchSelected({ fontFamily })} />
            </label>
            <label className="page-editor-size">
              Size
              <input
                type="range"
                min="2"
                max="14"
                step="0.2"
                value={selectedText.fontSize || 4}
                onChange={(event) => patchSelected({ fontSize: Number(event.target.value) })}
              />
              <span>{Number(selectedText.fontSize || 4).toFixed(1)}</span>
            </label>
            <label className="page-editor-color">
              Text color
              <input
                type="color"
                value={normalizeColor(selectedText.color, "") || bookInk}
                onChange={(event) => patchSelected({ color: event.target.value })}
              />
            </label>
            <div className="page-editor-align" role="group" aria-label="Alignment">
              {(["left", "center", "right"] as TextAlign[]).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={(selectedText.align || "left") === align ? "active" : ""}
                  onClick={() => patchSelected({ align })}
                >{align[0].toUpperCase() + align.slice(1)}</button>
              ))}
            </div>
          </>
        ) : null}
        <div className="page-editor-paper">
          <span>Page background</span>
          <div className="page-editor-papers" role="group" aria-label="Page background">
            <button
              type="button"
              className={!book.pageTexture ? "active" : ""}
              aria-label="Plain"
              style={{ backgroundColor: fill }}
              onClick={() => commit({ ...book, pageTexture: "" })}
            />
            {PAPER_TEXTURES.map((texture) => (
              <button
                key={texture.id}
                type="button"
                className={book.pageTexture === texture.id ? "active" : ""}
                aria-label={texture.label}
                title={texture.label}
                style={paperSwatchStyle(fill, texture.id)}
                onClick={() => commit({ ...book, pageTexture: texture.id })}
              />
            ))}
          </div>
        </div>
        <label className="page-editor-color">
          This page
          <input
            type="color"
            value={focusLayout.background || book.pageBackground || DEFAULT_PAGE_BACKGROUND}
            onChange={(event) => updatePages((list) => list.map((page, index) => (
              index === focusIndex ? { ...page, background: event.target.value } : page
            )))}
          />
        </label>
      </div>
      <div className="page-editor-swatches" role="list">
        {PAGE_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="page-editor-swatch"
            style={{ background: color }}
            aria-label={selectedText ? `Text color ${color}` : `Page color ${color}`}
            onClick={() => {
              if (selectedText) patchSelected({ color });
              else if (selected?.element.type === "shape") patchSelected({ color });
              else updatePages((list) => list.map((page, index) => (index === focusIndex ? { ...page, background: color } : page)));
            }}
          />
        ))}
      </div>
      <div className="page-editor-stage" ref={stageRef} style={{ background: book.spreadBackground || DEFAULT_SPREAD_BACKGROUND }}>
        <div className="portrait-row">
          {visible.map((layout, offset) => {
            const index = windowStart + offset;
            const flipRole = portraitFlipRole(layout, index);
            const roleLabel = flipRole === "cover" ? "Cover" : flipRole === "title" ? "Title" : flipRole === "end" ? "End" : `Page ${index + 1}`;
            return (
              <figure key={index} className={`portrait-slot${index === focusIndex ? " active" : ""}`}>
                <div
                  ref={(node) => { pageRefs.current[index] = node; }}
                  className="portrait-editor-preview mobile portrait-phone-frame"
                  style={{ ...previewStyle, width: pageBox.width, height: pageBox.phoneHeight }}
                  onMouseDown={() => { setSelectedId(""); setEditingId(""); setFocus(index); }}
                  onPointerDownCapture={(event) => onVisualPointerDown(event, index, layout)}
                  onDoubleClickCapture={(event) => {
                    const target = event.target as HTMLElement;
                    const id = target.closest("[data-id]")?.getAttribute("data-id");
                    const element = id ? layout.elements.find((item) => item.id === id) : undefined;
                    if (element?.type === "text") setEditingId(element.id);
                  }}
                >
                  <div className="portrait-edit-layer">
                    {layout.elements.map((element) => (
                      <div
                        key={element.id}
                        className={`page-editor-el portrait-edit-hit${selectedId === element.id ? " selected" : ""}`}
                        style={{
                          left: `${element.x}%`,
                          top: `${element.y}%`,
                          width: `${element.w}%`,
                          height: `${element.h}%`,
                          zIndex: element.z,
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => onPointerDown(event, index, element, "move")}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          if (element.type === "text") setEditingId(element.id);
                        }}
                      >
                        {editingId === element.id && element.type === "text" ? (
                          <textarea
                            autoFocus
                            value={element.text || ""}
                            style={{
                              width: "100%",
                              height: "100%",
                              fontFamily: fontStack(element.fontFamily || bookFont),
                              fontSize: `${element.fontSize || 4}cqh`,
                              color: normalizeColor(element.color, "") || bookInk,
                              textAlign: element.align || "left",
                            }}
                            onFocus={beginDeferredEdit}
                            onChange={(event) => place(index, index, element.id, { text: event.target.value }, { recordUndo: false })}
                            onKeyDown={(event) => event.stopPropagation()}
                            onBlur={() => {
                              endDeferredEdit();
                              setEditingId("");
                            }}
                          />
                        ) : null}
                        {selectedId === element.id ? (
                          <button type="button" className="page-editor-handle" aria-label="Resize" onPointerDown={(event) => onPointerDown(event, index, element, "resize")} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <PortraitMobileMirror
                    layout={layout}
                    role={flipRole}
                    book={book}
                    width={pageBox.width}
                    height={pageBox.phoneHeight}
                  />
                </div>
                <figcaption>{roleLabel}</figcaption>
              </figure>
            );
          })}
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
