import { useEffect, useMemo, useRef, useState } from "react";
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
  PAGE_COLOR_PALETTE,
  alignJustify,
  emptyStoryPage,
  ensureBookLayouts,
  newElementId,
  normalizeColor,
  pageFill,
  syncBookFromLayouts,
} from "@shared/page-layout";
import { characterUrlFor, visibleStoryPages } from "@shared/reader-pages";
import type { PageElement, PageLayout, PublicBook, TextAlign } from "@shared/types";
import { adminMe, fetchBook, fetchPlayerSetup, updateBook, uploadBookAsset } from "../lib/api";

function EditorText({
  text,
  placeholder,
  style,
}: {
  text: string;
  placeholder: string;
  style: React.CSSProperties;
}) {
  const raw = text || "";
  if (!raw) return <p style={style}>{placeholder}</p>;
  return (
    <div className="page-editor-text" style={style}>
      {raw.split(/\n{2,}/).map((para, index) => (
        <p key={index}>
          {para.split("\n").map((line, lineIndex) => (
            <span key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
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
  const stageRef = useRef<HTMLDivElement>(null);
  const [bookBox, setBookBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

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
      const ratio = finishedW / finishedH;
      const availW = stage.clientWidth;
      const availH = stage.clientHeight;
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
  }, [ready, book]);

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
        setBook(ensureBookLayouts(next, { coverUrl: next.coverUrl, characterUrl: characterUrlFor(next) }));
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
        textFont: synced.textFont,
        textColor: synced.textColor,
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

  const storyPages = useMemo(() => (book ? visibleStoryPages(book) : []), [book]);

  const screens: Screen[] = useMemo(() => {
    if (!book) return [];
    return [{ kind: "title" }, ...storyPages.map((page) => ({ kind: "page" as const, pageId: page.id })), { kind: "end" }];
  }, [book, storyPages]);

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
      x: 56,
      y: 18 + (layout.elements.filter((item) => item.type === "text").length % 4) * 10,
      w: 38,
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
    const pages = [...book.pages, page];
    persist({ ...book, pages });
    setIndex(visibleStoryPages({ ...book, pages }).length);
    setSelectedId(page.elements[0]?.id || "");
  }

  function removePage() {
    if (!book || !screen || screen.kind !== "page" || storyPages.length < 2) return;
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
    const onRight = layout.elements.some((item) => item.type === "image");
    const element: PageElement = {
      id: newElementId(),
      type: "image",
      x: onRight ? 56 : 0,
      y: 25,
      w: onRight ? 38 : 50,
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
  const selected = layout.elements.find((item) => item.id === selectedId);
  const selectedText = selected?.type === "text" ? selected : undefined;
  const bookFont = book.textFont || DEFAULT_TEXT_FONT;
  const bookInk = book.textColor || DEFAULT_TEXT_COLOR;
  const label = screen.kind === "title" ? "Title" : screen.kind === "end" ? "The end" : `Page ${storyPages.findIndex((page) => page.id === screen.pageId) + 1}`;

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
        <button type="button" disabled={screen.kind !== "page" || storyPages.length < 2} onClick={removePage}>Delete page</button>
        <button type="button" disabled={!selectedId} onClick={removeElement}>Delete item</button>
        {selectedId && layout.elements.find((item) => item.id === selectedId)?.type === "image" ? (
          <button type="button" onClick={() => { replaceId.current = selectedId; fileRef.current?.click(); }}>Replace picture</button>
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
            </label>
            <label className="page-editor-color">
              Text color
              <input
                type="color"
                value={normalizeColor(selectedText.color, "") || bookInk}
                onChange={(event) => patchElement(selectedText.id, { color: event.target.value })}
              />
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
            <button type="button" className="ghost" onClick={() => patchElement(selectedText.id, { color: "", fontFamily: "" })}>Use book type</button>
          </>
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
        {(selectedText ? TEXT_INK_PALETTE : PAGE_COLOR_PALETTE).map((color) => (
          <button
            key={color}
            type="button"
            className="page-editor-swatch"
            style={{ background: color }}
            aria-label={selectedText ? `Text color ${color}` : `Page color ${color}`}
            onClick={() => selectedText
              ? patchElement(selectedText.id, { color })
              : writeLayout(screen, { ...layout, background: color })}
          />
        ))}
      </div>
      <div className="page-editor-stage" ref={stageRef}>
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
                  element.imageUrl ? <img src={element.imageUrl} alt="" style={{ objectFit: element.fit === "contain" || element.id === "title-cover" || element.id === "end-art" ? "contain" : "cover" }} /> : <span className="page-editor-empty">Picture</span>
                ) : editingId === element.id ? (
                  <textarea
                    autoFocus
                    value={element.text || ""}
                    style={{
                      fontFamily: fontStack(element.fontFamily || bookFont),
                      fontSize: `${element.fontSize || 4}cqh`,
                      color: normalizeColor(element.color, "") || bookInk,
                      textAlign: element.align || "left",
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
                    }}
                  />
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
          <div className="page-editor-spine" aria-hidden="true" />
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
