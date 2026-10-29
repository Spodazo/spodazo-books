import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { homeCoverSrc } from "@shared/home-cover";
import { PALETTES, paletteById } from "@shared/palettes";
import {
  audienceLabel,
  isBookAudiencePreset,
  normalizeAudience,
} from "@shared/audience";
import { DEFAULT_CURATOR, DEFAULT_PLAYER_SETUP, publicCurator } from "@shared/seed-data";
import type { BookListItem, BookPage, Curator, PlayerSetup, PublicBook } from "@shared/types";
import {
  adminLogin,
  adminLogout,
  adminMe,
  createBook,
  importPdfOnServer,
  replaceBookPdf,
  fetchBook,
  fetchBooks,
  invalidateBookCache,
  fetchCurator,
  fetchPlayerSetup,
  recoverCuratorPassword,
  reorderBooks,
  updateBook,
  updateCurator,
  updatePlayerSetup,
  uploadBookAsset,
  verifyCuratorPassword,
} from "../lib/api";
import { writeCachedBooks, writeCachedSetup, clearHomeClientCache } from "../lib/homeCache";
import { applyPalette } from "../lib/palette";
import { applySiteIcons } from "../lib/siteIcons";
import { downloadBookletPdf, downloadStandardBookPdf } from "../flipbook/download-book-pdf";
import { bookletSheetSizeMm } from "../lib/booklet";

type CoverRect = { id: string; left: number; top: number; right: number; bottom: number };

function nearestCoverId(x: number, y: number, rects: CoverRect[]): string {
  let bestId = "";
  let best = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const dx = x - (rect.left + rect.right) / 2;
    const dy = y - (rect.top + rect.bottom) / 2;
    const dist = dx * dx + dy * dy;
    if (dist < best) {
      best = dist;
      bestId = rect.id;
    }
  }
  return bestId;
}

type Imported = {
  book: {
    schemaVersion: 1;
    title: string;
    tagline?: string;
    author?: string;
    date?: string;
    pdfUrl: string;
    pages: BookPage[];
  };
  serverPrepared: true;
  dispose: () => void;
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [error, setError] = useState("");
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [selected, setSelected] = useState<PublicBook | null>(null);
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup>(DEFAULT_PLAYER_SETUP);
  const [curator, setCurator] = useState<Curator>(publicCurator(DEFAULT_CURATOR));
  const [curatorOpen, setCuratorOpen] = useState(false);
  const [curatorRecover, setCuratorRecover] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const booksRef = useRef(books);
  booksRef.current = books;
  const rowRef = useRef<HTMLDivElement>(null);
  const skipClick = useRef(false);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    overId: string;
    origin: BookListItem[];
    rects: CoverRect[];
  } | null>(null);
  const [dragUi, setDragUi] = useState<{ id: string; dx: number; dy: number; overId: string } | null>(null);

  async function saveOrder(next: BookListItem[], previous: BookListItem[]) {
    setReorderBusy(true);
    setError("");
    booksRef.current = next;
    setBooks(next);
    try {
      const saved = await reorderBooks(next.map((book) => book.id));
      booksRef.current = saved;
      setBooks(saved);
      writeCachedBooks(saved);
    } catch (err) {
      booksRef.current = previous;
      setBooks(previous);
      setError(err instanceof Error ? err.message : "Could not reorder books");
    } finally {
      setReorderBusy(false);
    }
  }

  function libraryShelfBooks(list = booksRef.current): BookListItem[] {
    return list.filter((book) => !book.archived);
  }

  async function moveBook(index: number, delta: -1 | 1) {
    if (archivedView || reorderBusy) return;
    const current = libraryShelfBooks();
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    const next = current.slice();
    [next[index], next[target]] = [next[target], next[index]];
    await saveOrder(next, current);
  }

  function onCoverPointerDown(event: ReactPointerEvent<HTMLDivElement>, book: BookListItem) {
    skipClick.current = false;
    const shelf = libraryShelfBooks();
    if (archivedView || shelf.length < 2 || reorderBusy || event.button !== 0) return;
    const nodes = rowRef.current?.querySelectorAll<HTMLElement>("[data-book-id]") ?? [];
    dragRef.current = {
      id: book.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      overId: book.id,
      origin: shelf.slice(),
      rects: Array.from(nodes).map((node) => {
        const rect = node.getBoundingClientRect();
        return { id: node.dataset.bookId || "", left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }),
    };
  }

  function onCoverPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.active = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* The drag still follows the pointer when capture is unavailable. */
      }
    }
    drag.overId = nearestCoverId(event.clientX, event.clientY, drag.rects) || drag.id;
    setDragUi({ id: drag.id, dx, dy, overId: drag.overId });
  }

  function onCoverPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragUi(null);
    if (!drag.active) return;
    skipClick.current = true;
    if (drag.overId === drag.id) return;
    const previous = drag.origin;
    const next = previous.slice();
    const from = next.findIndex((item) => item.id === drag.id);
    const to = next.findIndex((item) => item.id === drag.overId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void saveOrder(next, previous);
  }

  function onCoverPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragUi(null);
  }

  async function refresh() {
    const list = await fetchBooks();
    setBooks(list);
    if (selected) setSelected(await fetchBook(selected.slug));
  }

  useEffect(() => {
    applySiteIcons(playerSetup);
  }, [playerSetup]);

  useEffect(() => {
    adminMe()
      .then(async (me) => {
        setAuthed(me.admin);
        if (me.admin) {
          await refresh();
          const next = await fetchPlayerSetup();
          setPlayerSetup(next);
          setCurator(await fetchCurator());
          applyPalette(next.collectionColor);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setReady(true));
  }, []);

  const activeBooks = books.filter((book) => !book.archived);
  const archivedBooks = books.filter((book) => book.archived);
  const shelfBooks = archivedView ? archivedBooks : activeBooks;

  if (!ready) return <main className="admin"><p>Loading…</p></main>;

  if (!authed) {
    return (
      <main className="admin">
        <h1>{playerSetup.appName} Admin</h1>
        <p>The public library stays open. This password unlocks adding books, covers, and site colors.</p>
        {recoverOpen ? (
          <LostPasswordForm
            needRecoveryKey
            onRecovered={async () => {
              setRecoverOpen(false);
              setAuthed(true);
              await refresh();
              const next = await fetchPlayerSetup();
              setPlayerSetup(next);
              setCurator(await fetchCurator());
              applyPalette(next.collectionColor);
            }}
            onCancel={() => {
              setError("");
              setRecoverOpen(false);
            }}
          />
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              try {
                await adminLogin(password);
                setAuthed(true);
                await refresh();
                const next = await fetchPlayerSetup();
                setPlayerSetup(next);
                setCurator(await fetchCurator());
                applyPalette(next.collectionColor);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Login failed");
              }
            }}
          >
            <PasswordField id="password" label="Admin password" autoComplete="current-password" value={password} onChange={setPassword} required />
            <button type="button" className="lost-password" onClick={() => { setError(""); setRecoverOpen(true); }}>
              Lost Password?
            </button>
            <div className="form-actions">
              <button type="submit">Sign in</button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </form>
        )}
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="admin-top">
        <h1>{playerSetup.appName} Admin</h1>
        <div className="admin-top-actions">
          <a href="/" className="ghost">View site</a>
          <button className="ghost" onClick={async () => { await adminLogout(); setAuthed(false); }}>Sign out</button>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}

      <section className="card curator-card">
        <div>
          <h2>Curator</h2>
          <dl className="curator-fields">
            <div><dt>First Name</dt><dd>{curator.firstName || "—"}</dd></div>
            <div><dt>Last Name</dt><dd>{curator.lastName || "—"}</dd></div>
            <div><dt>Email</dt><dd>{curator.email || "—"}</dd></div>
          </dl>
        </div>
        <button type="button" onClick={() => { setCuratorRecover(false); setCuratorOpen(true); }}>Edit</button>
      </section>
      {curatorOpen ? (
        <AdminDialog title="Curator" onClose={() => { setCuratorOpen(false); setCuratorRecover(false); }}>
          <CuratorEditor
            curator={curator}
            startRecover={curatorRecover}
            onSaved={(next) => { setCurator(next); setCuratorOpen(false); setCuratorRecover(false); }}
            onCancel={() => { setCuratorOpen(false); setCuratorRecover(false); }}
          />
        </AdminDialog>
      ) : null}

      <section className="card player-setup-card">
        <div>
          <h2>Site Setup</h2>
          <p className="hint">Logo, favicon, app name, theme, credits, and library colors.</p>
        </div>
        <button type="button" onClick={() => setSetupOpen(true)}>Edit</button>
      </section>
      {setupOpen ? (
        <AdminDialog title="Site Setup" onClose={() => { applyPalette(playerSetup.collectionColor); setSetupOpen(false); }}>
          <PlayerSetupForm
            setup={playerSetup}
            onSaved={(next) => {
              setPlayerSetup(next);
              writeCachedSetup(next);
              applySiteIcons(next);
              applyPalette(next.collectionColor);
              setSetupOpen(false);
            }}
            onCleared={(next) => { setPlayerSetup(next); writeCachedSetup(next); }}
            onCancel={() => setSetupOpen(false)}
          />
        </AdminDialog>
      ) : null}

      <section className="card">
        <div className="admin-top">
          <h2>{archivedView ? "Archived Books" : "Books"}</h2>
          <div className="admin-top-actions">
            {archivedView ? (
              <button type="button" className="ghost" onClick={() => { setArchivedView(false); setSelected(null); }}>
                Active library
              </button>
            ) : archivedBooks.length ? (
              <button type="button" className="ghost" onClick={() => { setArchivedView(true); setSelected(null); }}>
                Archived Books
              </button>
            ) : null}
            {!archivedView ? (
              <button type="button" onClick={() => setImportOpen(true)}>Add book from PDF</button>
            ) : null}
          </div>
        </div>
        {archivedView ? (
          <p className="hint">Archived books stay in Admin but leave the public library. Open one to restore it.</p>
        ) : shelfBooks.length > 1 ? (
          <p className="hint">Drag a book to set library order (left to right on the home page).</p>
        ) : null}
        {!shelfBooks.length ? (
          <p className="hint">{archivedView ? "No archived books yet." : "No books in the library yet."}</p>
        ) : null}
        <div className="album-cover-row" ref={rowRef}>
          {shelfBooks.map((book, index) => {
            const dragging = dragUi?.id === book.id;
            const dropTarget = Boolean(dragUi && dragUi.overId === book.id && dragUi.id !== book.id);
            const cover = homeCoverSrc(book);
            return (
              <div
                key={book.id}
                data-book-id={book.id}
                role="button"
                tabIndex={0}
                aria-label={book.title}
                className={`album-cover-item${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop-target" : ""}`}
                style={dragging ? { transform: `translate(${dragUi.dx}px, ${dragUi.dy}px)` } : undefined}
                onPointerDown={(event) => onCoverPointerDown(event, book)}
                onPointerMove={onCoverPointerMove}
                onPointerUp={onCoverPointerUp}
                onPointerCancel={onCoverPointerCancel}
                onClick={() => {
                  if (skipClick.current) {
                    skipClick.current = false;
                    return;
                  }
                  void fetchBook(book.slug).then(setSelected);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void fetchBook(book.slug).then(setSelected);
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    void moveBook(index, -1);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    void moveBook(index, 1);
                  }
                }}
              >
                <div className={`album-cover-tile${selected?.id === book.id ? " selected" : ""}`}>
                  {cover ? <img src={cover} alt="" draggable={false} /> : <span className="album-cover-empty" />}
                  {book.archived ? <span className="hidden-badge">Archived</span> : null}
                  {!book.archived && book.hidden ? <span className="hidden-badge">Hidden</span> : null}
                </div>
                <p className="album-cover-title">{book.title}</p>
                <p className="hint">{audienceLabel(book.audience)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {selected ? (
        <BookEditor
          book={selected}
          onSaved={async (next) => {
            invalidateBookCache(next.slug);
            clearHomeClientCache();
            setSelected(next);
            const list = await fetchBooks();
            setBooks(list);
            writeCachedBooks(list);
          }}
          archivedView={archivedView}
          onShowArchived={() => { setArchivedView(true); setSelected(null); }}
          onLibraryChange={async () => {
            setSelected(null);
            invalidateBookCache();
            clearHomeClientCache();
            const list = await fetchBooks();
            setBooks(list);
            writeCachedBooks(list);
          }}
        />
      ) : null}

      {importOpen ? (
        <AdminDialog title="Add book from PDF" onClose={() => setImportOpen(false)}>
          <ImportBookForm
            onSaved={async (book) => {
              setImportOpen(false);
              setBooks(await fetchBooks());
              setSelected(book);
            }}
            onCancel={() => setImportOpen(false)}
          />
        </AdminDialog>
      ) : null}

    </main>
  );
}

function audienceEditorState(raw: string) {
  const normalized = normalizeAudience(raw);
  const useCustom = !isBookAudiencePreset(normalized);
  return {
    preset: useCustom ? "__custom__" as const : normalized,
    customLabel: useCustom ? audienceLabel(normalized) : "",
    useCustom,
  };
}

function audienceEditorValue(preset: string, customLabel: string, useCustom: boolean): string {
  return normalizeAudience(useCustom ? customLabel : preset);
}

function AudienceFields({
  preset,
  customLabel,
  useCustom,
  disabled,
  onPresetChange,
  onCustomLabelChange,
  onUseCustomChange,
}: {
  preset: string;
  customLabel: string;
  useCustom: boolean;
  disabled?: boolean;
  onPresetChange: (value: string) => void;
  onCustomLabelChange: (value: string) => void;
  onUseCustomChange: (value: boolean) => void;
}) {
  return (
    <>
      <label>Audience</label>
      <select
        value={useCustom ? "__custom__" : preset}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "__custom__") {
            onUseCustomChange(true);
            return;
          }
          onUseCustomChange(false);
          onPresetChange(value);
        }}
      >
        <option value="children">Children</option>
        <option value="adults">Adults</option>
        <option value="__custom__">Custom…</option>
      </select>
      {useCustom ? (
        <>
          <label>Custom audience</label>
          <input
            value={customLabel}
            disabled={disabled}
            placeholder="e.g. Family reading"
            onChange={(event) => onCustomLabelChange(event.target.value)}
          />
        </>
      ) : null}
      <p className="hint">Choose Children, Adults, or enter a custom section name. Click Save to apply.</p>
    </>
  );
}

function ImportBookForm({
  onSaved,
  onCancel,
}: {
  onSaved: (book: PublicBook) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState<Imported | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [audiencePreset, setAudiencePreset] = useState("children");
  const [audienceCustom, setAudienceCustom] = useState("");
  const [audienceCustomOpen, setAudienceCustomOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => imported?.dispose(), [imported]);

  async function load(file: File) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    setBusy(true);
    setStatus("Importing…");
    try {
      if (controller.signal.aborted) throw new DOMException("Import cancelled", "AbortError");
      setStatus("Uploading PDF to the server…");
      const result = await importPdfOnServer(file);
      if (controller.signal.aborted) throw new DOMException("Import cancelled", "AbortError");
      imported?.dispose();
      setImported({
        book: {
          ...result.book,
          tagline: "",
          author: "",
          date: "",
        },
        serverPrepared: true,
        dispose: () => {},
      });
      setPageIndex(0);
      const linkCount = result.book.pages.reduce((total, item) => total + (item.links?.length || 0), 0);
      setStatus(
        linkCount
          ? `${result.book.pages.length} pages ready, with ${linkCount} contents links. Review the wording, then save.`
          : `${result.book.pages.length} pages ready. Review the wording, then save.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const page = imported?.book.pages[pageIndex];

  return (
    <div>
      <label>PDF file</label>
      <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) void load(file);
      }} />
      <p className="hint">{status || "Each PDF page becomes one leaf. Song lists and contents pages become tappable, like Be Thou My Vision. Import runs on the server so Safari and dock icons work reliably."}</p>
      {imported && page ? (
        <>
          <label>Book title</label>
          <input value={imported.book.title} onChange={(event) => { imported.book.title = event.target.value; setImported({ ...imported }); }} />
          <label>Subtitle</label>
          <input value={imported.book.tagline || ""} onChange={(event) => { imported.book.tagline = event.target.value; setImported({ ...imported }); }} />
          <label>Author</label>
          <input value={imported.book.author || ""} onChange={(event) => { imported.book.author = event.target.value; setImported({ ...imported }); }} />
          <label>Date</label>
          <input value={imported.book.date || ""} onChange={(event) => { imported.book.date = event.target.value; setImported({ ...imported }); }} />
          <AudienceFields
            preset={audiencePreset}
            customLabel={audienceCustom}
            useCustom={audienceCustomOpen}
            disabled={busy}
            onPresetChange={setAudiencePreset}
            onCustomLabelChange={setAudienceCustom}
            onUseCustomChange={setAudienceCustomOpen}
          />
          <label>Page</label>
          <select value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))}>
            {imported.book.pages.map((item, index) => (
              <option key={item.id} value={index}>{index + 1}. {item.title}</option>
            ))}
          </select>
          <p className="hint">This PDF page is kept as one leaf. Check the title if wording was found.</p>
          <label>Page title</label>
          <input value={page.title} onChange={(event) => { page.title = event.target.value; setImported({ ...imported }); }} />
          <label>Story text</label>
          <textarea value={page.paragraphs.join("\n\n")} onChange={(event) => {
            page.paragraphs = event.target.value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
            setImported({ ...imported });
          }} />
          <label>Text position</label>
          <select value={page.position} onChange={(event) => { page.position = event.target.value as BookPage["position"]; setImported({ ...imported }); }}>
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
          <label>Image focal point</label>
          <select value={page.focalPoint} onChange={(event) => { page.focalPoint = event.target.value; setImported({ ...imported }); }}>
            <option value="50% 50%">Centre</option>
            <option value="25% 50%">Left</option>
            <option value="75% 50%">Right</option>
            <option value="50% 25%">Top</option>
            <option value="50% 75%">Bottom</option>
          </select>
        </>
      ) : null}
      <div className="form-actions">
        <button
          type="button"
          disabled={!imported || busy}
          onClick={async () => {
            if (!imported) return;
            setBusy(true);
            setError("");
            try {
              const saved = await createBook({
                title: imported.book.title,
                tagline: imported.book.tagline,
                author: imported.book.author,
                date: imported.book.date,
                slug: /willow/i.test(imported.book.title)
                  ? "Willows-Big-Forest-Adventure"
                  : /rudolph/i.test(imported.book.title)
                    ? "Rudolph"
                    : /be thou my vision/i.test(imported.book.title)
                      ? "Be-Thou-My-Vision"
                      : undefined,
                pdfUrl: imported.book.pdfUrl,
                coverUrl: imported.book.pages[0]?.imageUrl,
                pageTemplate: "one-up",
                pageBackground: "#022a58",
                spreadBackground: "#021b3f",
                pageTexture: "felt",
                textFont: "Lexend",
                textColor: "#f1c27d",
                coverLayout: {
                  background: "#021b3f",
                  elements: [
                    {
                      id: "cover-art",
                      type: "image",
                      x: 0,
                      y: 0,
                      w: 100,
                      h: 100,
                      z: 1,
                      imageAsset: imported.book.pages[0]?.imageAsset,
                      imageUrl: imported.book.pages[0]?.imageUrl,
                      fit: "contain",
                      focusX: 50,
                      focusY: 50,
                      opacity: 100,
                    },
                  ],
                },
                pages: imported.book.pages,
                audience: audienceEditorValue(audiencePreset, audienceCustom, audienceCustomOpen),
                published: true,
                hidden: false,
              });
              imported.dispose();
              await onSaved(saved);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save book"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function BookEditor({
  book,
  onSaved,
  archivedView,
  onShowArchived,
  onLibraryChange,
}: {
  book: PublicBook;
  onSaved: (book: PublicBook) => Promise<void>;
  archivedView: boolean;
  onShowArchived: () => void;
  onLibraryChange: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [tagline, setTagline] = useState(book.tagline);
  const [author, setAuthor] = useState(book.author || "");
  const [date, setDate] = useState(book.date || "");
  const [coverUrl, setCoverUrl] = useState(book.coverUrl);
  const [hidden, setHidden] = useState(book.hidden);
  const initialAudience = audienceEditorState(book.audience || "children");
  const [audiencePreset, setAudiencePreset] = useState(initialAudience.preset);
  const [audienceCustom, setAudienceCustom] = useState(initialAudience.customLabel);
  const [audienceCustomOpen, setAudienceCustomOpen] = useState(initialAudience.useCustom);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"standard" | "booklet" | "">("");
  const [bookletWidthMm, setBookletWidthMm] = useState("148");
  const [revisedBusy, setRevisedBusy] = useState(false);
  const [revisedNote, setRevisedNote] = useState("");
  const revisedPdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(book.title);
    setTagline(book.tagline);
    setAuthor(book.author || "");
    setDate(book.date || "");
    setCoverUrl(book.coverUrl);
    setHidden(book.hidden);
    const nextAudience = audienceEditorState(book.audience || "children");
    setAudiencePreset(nextAudience.preset);
    setAudienceCustom(nextAudience.customLabel);
    setAudienceCustomOpen(nextAudience.useCustom);
  }, [book.id]);

  const audience = audienceEditorValue(audiencePreset, audienceCustom, audienceCustomOpen);

  return (
    <section className="card">
      <h2>{book.title}</h2>
      <label>Title</label>
      <input value={title} onChange={(event) => setTitle(event.target.value)} />
      <label>Subtitle</label>
      <input value={tagline} onChange={(event) => setTagline(event.target.value)} />
      <label>Book Cover</label>
      <p className="hint">This picture appears on the title page.</p>
      {coverUrl ? <img className="book-cover-preview" src={coverUrl} alt="" /> : null}
      <input
        type="file"
        accept="image/*"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          try {
            const uploaded = await uploadBookAsset(file, file.name);
            setCoverUrl(uploaded.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Cover upload failed");
          }
        }}
      />
      <label>Author</label>
      <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Author name" />
      <label>Date</label>
      <input value={date} onChange={(event) => setDate(event.target.value)} placeholder="2026" />
      <AudienceFields
        preset={audiencePreset}
        customLabel={audienceCustom}
        useCustom={audienceCustomOpen}
        onPresetChange={setAudiencePreset}
        onCustomLabelChange={setAudienceCustom}
        onUseCustomChange={setAudienceCustomOpen}
      />
      <label>
        <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
        Hide from the public library
      </label>
      <p className="hint">{book.pageCount} pages. Slug: /{book.slug}</p>
      <div className="form-actions">
        <button
          type="button"
          disabled={revisedBusy}
          onClick={() => revisedPdfRef.current?.click()}
        >
          {revisedBusy ? "Replacing…" : "Upload a revised PDF"}
        </button>
        <input
          ref={revisedPdfRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            if (!confirm(`Replace the pages of “${book.title.replace(/\n/g, " ")}” with this PDF? The address /${book.slug} stays the same.`)) return;
            setRevisedBusy(true);
            setError("");
            setRevisedNote("Saving the new pages. This can take a minute.");
            try {
              const saved = await replaceBookPdf(book.id, file, {
                slug: book.slug,
                pdfUrlBefore: book.pdfUrl,
                updatedAtBefore: book.updatedAt,
              });
              const firstPage = saved.pages?.[0]?.imageAsset || saved.cover || "";
              setError("");
              setRevisedNote(
                `Saved ${saved.pageCount} new pages${firstPage ? ` (${firstPage})` : ""}. Reopen the book from the library (or refresh the book tab) to see the new PDF.`,
              );
              await onSaved(saved);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not replace the book");
            } finally {
              setRevisedBusy(false);
            }
          }}
        />
        <p className="hint">Replaces this book’s pages with a new PDF. You do not need to delete it first. Saving can take a minute; keep this tab open until you see the confirmation.</p>
        {revisedNote ? <p className="hint">{revisedNote}</p> : null}
        <button
          type="button"
          onClick={async () => {
            setError("");
            try {
              await onSaved(await updateBook(book.id, { title, tagline, author, date, coverUrl, hidden, audience }));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="ghost"
          disabled={Boolean(pdfBusy)}
          onClick={() => {
            setPdfBusy("standard");
            setError("");
            void downloadStandardBookPdf(book)
              .catch((err: Error) => setError(err.message || "Could not make the PDF"))
              .finally(() => setPdfBusy(""));
          }}
        >
          {pdfBusy === "standard" ? "Preparing PDF…" : "Standard PDF"}
        </button>
        <label>Booklet page width (mm)</label>
        <input
          type="number"
          min={50}
          max={400}
          step={0.1}
          value={bookletWidthMm}
          disabled={Boolean(pdfBusy)}
          onChange={(event) => setBookletWidthMm(event.target.value)}
        />
        <button
          type="button"
          className="ghost"
          disabled={Boolean(pdfBusy)}
          onClick={() => {
            const pageWidthMm = Number.parseFloat(bookletWidthMm);
            if (!Number.isFinite(pageWidthMm) || pageWidthMm < 50 || pageWidthMm > 400) {
              setError("Enter a booklet page width between 50 and 400 mm.");
              return;
            }
            setPdfBusy("booklet");
            setError("");
            void downloadBookletPdf(book, pageWidthMm)
              .catch((err: Error) => setError(err.message || "Could not make the PDF"))
              .finally(() => setPdfBusy(""));
          }}
        >
          {pdfBusy === "booklet" ? "Preparing PDF…" : "Download booklet"}
        </button>
        {(() => {
          const pageWidthMm = Number.parseFloat(bookletWidthMm);
          if (!Number.isFinite(pageWidthMm) || pageWidthMm <= 0) return null;
          const { sheetWidthMm, pageHeightMm } = bookletSheetSizeMm(pageWidthMm);
          const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
          return (
            <p className="hint">
              Each finished page will be {fmt(pageWidthMm)}×{fmt(pageHeightMm)} mm. Print double-sided on{" "}
              {fmt(sheetWidthMm)}×{fmt(pageHeightMm)} mm landscape sheets at actual size, flip on the long edge, fold each
              sheet in half, and nest them with the cover sheet on the outside. The designed back cover prints on the
              outside left of that sheet, and is not shown in the online book.
            </p>
          );
        })()}
        {book.archived ? (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Restore “${book.title.replace(/\n/g, " ")}” to the active library?`)) return;
              setError("");
              try {
                await onSaved(await updateBook(book.id, { archived: false }));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not restore the book");
              }
            }}
          >
            Restore to library
          </button>
        ) : (
          <>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (!confirm(`Archive “${book.title.replace(/\n/g, " ")}”? It will leave the public library but stay here in Admin.`)) return;
                setError("");
                try {
                  await updateBook(book.id, { archived: true });
                  await onLibraryChange();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not archive the book");
                }
              }}
            >
              Archive
            </button>
            {!archivedView ? (
              <button type="button" className="ghost" onClick={onShowArchived}>
                Archived Books
              </button>
            ) : null}
          </>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
        <button type="button" className="password-switch" role="switch" aria-checked={visible} aria-label={visible ? "Hide password" : "View password"} onClick={() => setVisible((open) => !open)}>
          <span className="password-switch-track" aria-hidden="true"><span className="password-switch-knob" /></span>
          <span>{visible ? "Hide" : "View"}</span>
        </button>
      </div>
    </>
  );
}

function LostPasswordForm({
  needRecoveryKey,
  onRecovered,
  onCancel,
}: {
  needRecoveryKey: boolean;
  onRecovered: (password: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (password !== confirmPassword) {
          setError("New passwords do not match");
          return;
        }
        try {
          await recoverCuratorPassword({
            password,
            email: needRecoveryKey ? email : undefined,
            recoveryPassword: needRecoveryKey ? recoveryPassword : undefined,
          });
          await onRecovered(password);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reset password");
        }
      }}
    >
      <p className="hint">
        {needRecoveryKey
          ? "Enter the email on your Curator profile and the Admin password from your hosting settings, then choose a new password."
          : "Choose a new curator password. You are already signed in."}
      </p>
      {needRecoveryKey ? (
        <>
          <label htmlFor="recover-email">Email</label>
          <input id="recover-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <PasswordField id="recover-key" label="Recovery password" autoComplete="current-password" value={recoveryPassword} onChange={setRecoveryPassword} required />
        </>
      ) : null}
      <PasswordField id="recover-password" label="New password" autoComplete="new-password" value={password} onChange={setPassword} required />
      <PasswordField id="recover-confirm" label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
      <div className="form-actions">
        <button type="submit">Reset password</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

function CuratorEditor({
  curator,
  startRecover,
  onSaved,
  onCancel,
}: {
  curator: Curator;
  startRecover?: boolean;
  onSaved: (curator: Curator) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(Boolean(startRecover));
  const [verifiedPassword, setVerifiedPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [firstName, setFirstName] = useState(curator.firstName);
  const [lastName, setLastName] = useState(curator.lastName);
  const [email, setEmail] = useState(curator.email);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (recovering) {
    return (
      <LostPasswordForm
        needRecoveryKey={false}
        onRecovered={(password) => { setVerifiedPassword(password); setRecovering(false); }}
        onCancel={() => { if (startRecover) onCancel(); else setRecovering(false); }}
      />
    );
  }
  if (!verifiedPassword) {
    return (
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await verifyCuratorPassword(currentPassword);
            setVerifiedPassword(currentPassword);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Wrong password");
          }
        }}
      >
        <PasswordField id="curator-verify" label="Password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} required />
        <div className="form-actions">
          <button type="submit">Continue</button>
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (nextPassword && nextPassword !== confirmPassword) {
          setError("New passwords do not match");
          return;
        }
        try {
          onSaved(await updateCurator({
            currentPassword: verifiedPassword,
            firstName,
            lastName,
            email,
            password: nextPassword || undefined,
          }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
        }
      }}
    >
      <label>First Name</label>
      <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
      <label>Last Name</label>
      <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
      <label>Email</label>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <PasswordField id="curator-password" label="New password" autoComplete="new-password" value={nextPassword} onChange={setNextPassword} placeholder="Leave blank to keep the current password" />
      <PasswordField id="curator-confirm" label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
      <div className="form-actions">
        <button type="submit">Save Curator</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

function CoverField({
  label,
  name,
  currentUrl,
  previewClass = "setup-cover-preview",
  hint,
  clearable,
  onClear,
}: {
  label: string;
  name: string;
  currentUrl?: string;
  previewClass?: string;
  hint?: string;
  clearable?: boolean;
  onClear?: () => Promise<void>;
}) {
  const [pickedUrl, setPickedUrl] = useState("");
  const pickedUrlRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (pickedUrlRef.current.startsWith("blob:")) URL.revokeObjectURL(pickedUrlRef.current);
  }, []);
  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (pickedUrlRef.current.startsWith("blob:")) URL.revokeObjectURL(pickedUrlRef.current);
    const next = file ? URL.createObjectURL(file) : "";
    pickedUrlRef.current = next;
    setPickedUrl(next);
  }
  const preview = pickedUrl || currentUrl;
  return (
    <>
      <label>{label}</label>
      {preview ? <img className={previewClass} src={preview} alt="" /> : null}
      {clearable && preview && onClear ? (
        <button type="button" className="ghost cover-remove" onClick={() => void onClear()}>Remove</button>
      ) : null}
      <input ref={inputRef} name={name} type="file" accept="image/*" onChange={onPick} />
      {hint ? <p className="hint">{hint}</p> : null}
    </>
  );
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange?: (id: string) => void }) {
  const current = paletteById(value);
  return (
    <>
      <label>{label}</label>
      <div className="palette-current">
        <span className="palette-swatch" style={{ background: current.bg }} />
        <span className="palette-swatch" style={{ background: current.accent }} />
        <span>{current.name}</span>
      </div>
      <div className="palette-choices">
        {PALETTES.map((palette) => (
          <label key={palette.id} className={`palette-choice${palette.id === current.id ? " on" : ""}`}>
            <input type="radio" name={name} value={palette.id} checked={palette.id === current.id} onChange={() => onChange?.(palette.id)} />
            <span>{palette.name}</span>
          </label>
        ))}
      </div>
    </>
  );
}

function PlayerSetupForm({
  setup,
  onSaved,
  onCleared,
  onCancel,
}: {
  setup: PlayerSetup;
  onSaved: (setup: PlayerSetup) => void;
  onCleared: (setup: PlayerSetup) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [color, setColor] = useState(setup.collectionColor);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          onSaved(await updatePlayerSetup(new FormData(event.currentTarget)));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
        }
      }}
    >
      <CoverField label="Collection Cover" name="cover" currentUrl={setup.collectionCoverUrl} clearable onClear={async () => {
        const form = new FormData();
        form.set("clearCover", "1");
        onCleared(await updatePlayerSetup(form));
      }} />
      <CoverField label="Logo" name="logo" currentUrl={setup.logoUrl} previewClass="setup-logo-preview" />
      <CoverField label="Favicon" name="favicon" currentUrl={setup.faviconUrl} previewClass="setup-favicon-preview" hint="Any image. Cropped from the left so the owl becomes the tab icon." />
      <ColorField label="Site Color" name="collectionColor" value={color} onChange={(id) => { setColor(id); applyPalette(id); }} />
      <label>App Name</label>
      <input name="appName" defaultValue={setup.appName} required />
      <label>Theme</label>
      <input name="theme" defaultValue={setup.theme} />
      <label>Credits</label>
      <input name="credits" defaultValue={setup.credits} />
      <label>Copyright</label>
      <textarea name="copyright" className="player-setup-copyright" defaultValue={setup.copyright} />
      <div className="form-actions">
        <button type="submit">Save Site Setup</button>
        <button type="button" className="ghost" onClick={() => { applyPalette(setup.collectionColor); onCancel(); }}>Cancel</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

function AdminDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="admin-dialog-backdrop" onClick={onClose} role="presentation">
      <div ref={panelRef} className="admin-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="admin-dialog-head">
          <h3>{title}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
