import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  DEFAULT_PAGE_BACKGROUND,
  PAGE_COLOR_PALETTE,
  emptyStoryPage,
  ensureBookLayouts,
  newElementId,
  pageFill,
  syncBookFromLayouts,
} from "@shared/page-layout";
import type { PageElement, PageLayout, PublicBook } from "@shared/types";
import { adminMe, fetchBook, fetchPlayerSetup, updateBook, uploadBookAsset } from "../lib/api";

type Screen =
  | { kind: "title" }
  | { kind: "page"; pageId: string }
  | { kind: "end" };

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  orig: PageElement;
};

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
  const [credits, setCredits] = useState("");
  const [copyright, setCopyright] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef("");
  const saveTimer = useRef<number>();
  const bookRef = useRef<PublicBook | null>(null);
  const drag = useRef<DragState | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    let cancelled = false;
    adminMe()
      .then(async (me) => {
        if (!me.admin) {
          setLocation("/admin");
          return;
        }
        const [next, setup] = await Promise.all([fetchBook(slug), fetchPlayerSetup()]);
        if (cancelled) return;
        const characterUrl = /willow/i.test(next.slug) || /willow/i.test(next.title) ? "/media/images/willow-character.webp" : "";
        setBook(ensureBookLayouts(next, { coverUrl: next.coverUrl, characterUrl }));
        setCredits(setup.credits);
        setCopyright(setup.copyright);
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

  function persist(next: PublicBook) {
    const synced = syncBookFromLayouts(next);
    setBook(synced);
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void updateBook(synced.id, {
        title: synced.title,
        tagline: synced.tagline,
        author: synced.author,
        date: synced.date,
        coverUrl: synced.titleLayout.elements.find((item) => item.type === "image")?.imageUrl || synced.coverUrl,
        pages: synced.pages,
        pageBackground: synced.pageBackground,
        titleLayout: synced.titleLayout,
        endLayout: synced.endLayout,
      })
        .then((saved) => {
          const latest = bookRef.current;
          if (!latest || latest.id !== saved.id) return;
          setStatus("Saved");
        })
        .catch((err: Error) => {
          setStatus("");
          setError(err.message);
        });
    }, 700);
  }

  const screens: Screen[] = useMemo(() => {
    if (!book) return [];
    return [{ kind: "title" }, ...book.pages.map((page) => ({ kind: "page" as const, pageId: page.id })), { kind: "end" }];
  }, [book]);

  const screen = screens[index];

  function layoutOf(target: Screen | undefined): PageLayout {
    if (!book || !target) return { elements: [], background: "" };
    if (target.kind === "title") return book.titleLayout;
    if (target.kind === "end") return book.endLayout;
    return book.pages.find((page) => page.id === target.pageId) || { elements: [], background: "" };
  }

  function writeLayout(target: Screen, layout: PageLayout) {
    if (!book) return;
    if (target.kind === "title") persist({ ...book, titleLayout: layout });
    else if (target.kind === "end") persist({ ...book, endLayout: layout });
    else {
      persist({
        ...book,
        pages: book.pages.map((page) => (page.id === target.pageId ? { ...page, ...layout, elements: layout.elements } : page)),
      });
    }
  }

  function patchElement(id: string, patch: Partial<PageElement>) {
    if (!screen) return;
    const layout = layoutOf(screen);
    writeLayout(screen, {
      ...layout,
      elements: layout.elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function addText() {
    if (!screen) return;
    const layout = layoutOf(screen);
    const element: PageElement = {
      id: newElementId(),
      type: "text",
      x: 10,
      y: 20 + (layout.elements.length % 5) * 8,
      w: 70,
      h: 16,
      z: layout.elements.length + 1,
      text: "New wording",
      role: screen.kind === "end" ? "end" : "body",
      fontSize: 3.6,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
  }

  function addPage() {
    if (!book) return;
    const page = emptyStoryPage(book.pages.length);
    persist({ ...book, pages: [...book.pages, page] });
    setIndex(book.pages.length + 1);
    setSelectedId(page.elements[0]?.id || "");
  }

  function removePage() {
    if (!book || !screen || screen.kind !== "page" || book.pages.length < 2) return;
    const pages = book.pages.filter((page) => page.id !== screen.pageId);
    persist({ ...book, pages });
    setIndex(Math.max(0, index - 1));
    setSelectedId("");
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
      patchElement(replaceId.current, { imageAsset: uploaded.filename, imageUrl: uploaded.url });
      replaceId.current = "";
      return;
    }
    if (!screen) return;
    const layout = layoutOf(screen);
    const element: PageElement = {
      id: newElementId(),
      type: "image",
      x: 20,
      y: 18,
      w: 40,
      h: 50,
      z: layout.elements.length + 1,
      imageAsset: uploaded.filename,
      imageUrl: uploaded.url,
    };
    writeLayout(screen, { ...layout, elements: [...layout.elements, element] });
    setSelectedId(element.id);
  }

  function onPointerDown(event: React.PointerEvent, element: PageElement, mode: "move" | "resize") {
    if (editingId === element.id && mode === "move") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    setEditingId("");
    const page = pageRef.current;
    if (!page) return;
    drag.current = {
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      orig: { ...element },
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
    if (state.mode === "move") {
      patchElement(state.id, {
        x: Math.min(100 - state.orig.w, Math.max(0, state.orig.x + dx)),
        y: Math.min(100 - state.orig.h, Math.max(0, state.orig.y + dy)),
      });
      return;
    }
    patchElement(state.id, {
      w: Math.min(100 - state.orig.x, Math.max(8, state.orig.w + dx)),
      h: Math.min(100 - state.orig.y, Math.max(8, state.orig.h + dy)),
    });
  }

  function onPointerUp() {
    drag.current = null;
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
  if (!book || !screen) return null;

  const layout = layoutOf(screen);
  const fill = pageFill(layout.background, book.pageBackground);
  const label = screen.kind === "title" ? "Title" : screen.kind === "end" ? "The end" : `Page ${book.pages.findIndex((page) => page.id === screen.pageId) + 1}`;

  return (
    <main className="page-editor">
      <header className="page-editor-bar">
        <Link href="/admin" className="ghost">Close</Link>
        <button type="button" className="ghost" disabled={index === 0} onClick={() => { setIndex(index - 1); setSelectedId(""); setEditingId(""); }}>Previous</button>
        <strong>{book.title}</strong>
        <span>{label} of {screens.length}</span>
        <button type="button" className="ghost" disabled={index === screens.length - 1} onClick={() => { setIndex(index + 1); setSelectedId(""); setEditingId(""); }}>Next</button>
        <span className="page-editor-status">{status}</span>
      </header>
      <div className="page-editor-tools">
        <button type="button" onClick={addText}>Add wording</button>
        <button type="button" onClick={() => { replaceId.current = ""; fileRef.current?.click(); }}>Add picture</button>
        <button type="button" onClick={addPage}>Add page</button>
        <button type="button" disabled={screen.kind !== "page" || book.pages.length < 2} onClick={removePage}>Delete page</button>
        <button type="button" disabled={!selectedId} onClick={removeElement}>Delete item</button>
        {selectedId && layout.elements.find((item) => item.id === selectedId)?.type === "image" ? (
          <button type="button" onClick={() => { replaceId.current = selectedId; fileRef.current?.click(); }}>Replace picture</button>
        ) : null}
        <label className="page-editor-color">
          Book background
          <input type="color" value={book.pageBackground || DEFAULT_PAGE_BACKGROUND} onChange={(event) => persist({ ...book, pageBackground: event.target.value })} />
        </label>
        <label className="page-editor-color">
          This page
          <input
            type="color"
            value={layout.background || book.pageBackground || DEFAULT_PAGE_BACKGROUND}
            onChange={(event) => writeLayout(screen, { ...layout, background: event.target.value })}
          />
        </label>
        <button type="button" className="ghost" onClick={() => writeLayout(screen, { ...layout, background: "" })}>Use book color</button>
      </div>
      <div className="page-editor-swatches" role="list">
        {PAGE_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="page-editor-swatch"
            style={{ background: color }}
            aria-label={`Page color ${color}`}
            onClick={() => writeLayout(screen, { ...layout, background: color })}
          />
        ))}
      </div>
      <div className="page-editor-stage">
        <div
          ref={pageRef}
          className="page-editor-page"
          style={{ background: fill }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseDown={() => { setSelectedId(""); setEditingId(""); }}
        >
          {layout.elements.slice().sort((a, b) => a.z - b.z).map((element) => (
            <div
              key={element.id}
              className={`page-editor-el${selectedId === element.id ? " selected" : ""}`}
              style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, zIndex: element.z }}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => onPointerDown(event, element, "move")}
              onDoubleClick={() => {
                if (element.type === "text") setEditingId(element.id);
              }}
            >
              {element.type === "image" ? (
                element.imageUrl ? <img src={element.imageUrl} alt="" /> : <span className="page-editor-empty">Picture</span>
              ) : editingId === element.id ? (
                <textarea
                  autoFocus
                  value={element.text || ""}
                  onChange={(event) => patchElement(element.id, { text: event.target.value })}
                  onBlur={() => setEditingId("")}
                />
              ) : (
                <p style={{ fontSize: `${element.fontSize || 4}cqh` }}>{element.text || "Double-click to type"}</p>
              )}
              {selectedId === element.id ? (
                <button type="button" className="page-editor-handle" aria-label="Resize" onPointerDown={(event) => onPointerDown(event, element, "resize")} />
              ) : null}
            </div>
          ))}
          {screen.kind === "end" && (credits || copyright) ? (
            <footer className="page-editor-legal">
              {credits ? <p>{credits}</p> : null}
              {copyright ? <p>{copyright}</p> : null}
            </footer>
          ) : null}
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
