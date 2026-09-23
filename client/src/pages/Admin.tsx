import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { PALETTES, paletteById } from "@shared/palettes";
import { DEFAULT_CURATOR, DEFAULT_PLAYER_SETUP, publicCurator } from "@shared/seed-data";
import type { BookListItem, BookPage, Curator, PlayerSetup, PublicBook } from "@shared/types";
import {
  adminLogin,
  adminLogout,
  adminMe,
  createBook,
  deleteBook,
  generateAiImage,
  generateAiOutline,
  fetchBook,
  fetchBooks,
  fetchCurator,
  fetchPlayerSetup,
  recoverCuratorPassword,
  updateBook,
  updateCurator,
  updatePlayerSetup,
  uploadBookAsset,
  verifyCuratorPassword,
} from "../lib/api";
import { writeCachedSetup } from "../lib/homeCache";
import { applyPalette } from "../lib/palette";
import { applySiteIcons } from "../lib/siteIcons";
import { importPDF } from "../flipbook/pdf-import.js";
import { persistImportedBook } from "../flipbook/persistence.js";
import { downloadBookPdf, type BookPdfKind } from "../flipbook/download-book-pdf";
import { mountReader } from "../flipbook/reader.js";

type Imported = Awaited<ReturnType<typeof importPDF>>;

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
  const [aiOpen, setAiOpen] = useState(false);

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
          <h2>Books</h2>
          <div className="admin-top-actions">
            <button type="button" onClick={() => setAiOpen(true)}>Create AI book</button>
            <button type="button" className="ghost" onClick={() => setImportOpen(true)}>Add book from PDF</button>
          </div>
        </div>
        <div className="album-cover-row">
          {books.map((book) => (
            <div key={book.id} className="album-cover-item">
              <button
                type="button"
                className={`album-cover-tile${selected?.id === book.id ? " selected" : ""}`}
                onClick={() => void fetchBook(book.slug).then(setSelected)}
              >
                {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span className="album-cover-empty" />}
                {book.hidden ? <span className="hidden-badge">Hidden</span> : null}
              </button>
              <p>{book.title}</p>
              <p className="hint">{book.audience === "adults" ? "Adults" : "Children"}</p>
            </div>
          ))}
        </div>
      </section>

      {selected ? (
        <BookEditor
          book={selected}
          onSaved={async (next) => {
            setSelected(next);
            setBooks(await fetchBooks());
          }}
          onDeleted={async () => {
            setSelected(null);
            setBooks(await fetchBooks());
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

      {aiOpen ? (
        <AdminDialog title="Create AI book" onClose={() => setAiOpen(false)}>
          <CreateAiBookForm
            onSaved={async (book) => {
              setAiOpen(false);
              setBooks(await fetchBooks());
              setSelected(book);
            }}
            onCancel={() => setAiOpen(false)}
          />
        </AdminDialog>
      ) : null}
    </main>
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
      const result = await importPDF(file, {
        mode: "auto",
        signal: controller.signal,
        resourceBase: `${location.origin}/pdfjs/`,
        onProgress: ({ page, total }: { page: number; total: number }) => setStatus(`Importing page ${page} of ${total}…`),
      });
      imported?.dispose();
      setImported(result);
      setPageIndex(0);
      setStatus(`${result.book.pages.length} pages ready. Review the wording, then save.`);
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
      <p className="hint">{status || "Willow-style PDFs extract illustration + text. Other layouts stay as full pages."}</p>
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
          <label>Page</label>
          <select value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))}>
            {imported.book.pages.map((item, index) => (
              <option key={item.id} value={index}>{index + 1}. {item.title}</option>
            ))}
          </select>
          <p className="hint">{page.kind === "facsimile" ? "This layout was kept as a whole PDF page." : "Illustration and text extracted. Check the wording."}</p>
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
              const saved = await persistImportedBook(
                imported,
                async (blob: Blob, filename: string) => {
                  const uploaded = await uploadBookAsset(blob, filename);
                  return new URL(uploaded.url, location.origin).href;
                },
                async (manifest: { title: string; pdfUrl: string; pages: BookPage[] }) => {
                  return createBook({
                    title: manifest.title,
                    tagline: imported.book.tagline,
                    author: imported.book.author,
                    date: imported.book.date,
                    slug: /willow/i.test(manifest.title) ? "Willows-Big-Forest-Adventure" : undefined,
                    pdfUrl: manifest.pdfUrl,
                    coverUrl: manifest.pages[0]?.imageUrl,
                    pages: manifest.pages,
                    published: true,
                    hidden: false,
                  });
                },
              ) as PublicBook;
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

type AiCharacterDraft = {
  id: string;
  name: string;
  source: "photo" | "caricature";
  file: File | null;
};

type AiDraftPage = {
  id: string;
  kind: BookPage["kind"];
  title: string;
  paragraphs: string[];
  imageAsset: string;
  imageUrl: string;
  position: BookPage["position"];
  illustrationPrompt: string;
};

function newCharacterDraft(): AiCharacterDraft {
  return { id: crypto.randomUUID(), name: "", source: "photo", file: null };
}

function CreateAiBookForm({
  onSaved,
  onCancel,
}: {
  onSaved: (book: PublicBook) => Promise<void>;
  onCancel: () => void;
}) {
  const [audience, setAudience] = useState<PublicBook["audience"]>("children");
  const [prompt, setPrompt] = useState("");
  const [pageCount, setPageCount] = useState(8);
  const [style, setStyle] = useState("");
  const [characters, setCharacters] = useState<AiCharacterDraft[]>([newCharacterDraft()]);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [author, setAuthor] = useState("");
  const [date, setDate] = useState("");
  const [sheets, setSheets] = useState<Array<{ name: string; url: string }>>([]);
  const [pages, setPages] = useState<AiDraftPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const page = pages[pageIndex];

  async function generate() {
    cancelled.current = false;
    setBusy(true);
    setError("");
    setPages([]);
    try {
      const sheetsNext: Array<{ name: string; filename: string; url: string }> = [];
      for (const [index, person] of characters.entries()) {
        if (cancelled.current) return;
        if (!person.file) continue;
        const label = person.name.trim() || `Character ${index + 1}`;
        setStatus(person.source === "photo" ? `Turning ${label} into a caricature…` : `Uploading ${label}…`);
        const uploaded = await uploadBookAsset(person.file, person.file.name);
        if (person.source === "photo") {
          const drawn = await generateAiImage({
            kind: "caricature",
            audience,
            name: label,
            referenceFiles: [uploaded.filename],
          });
          sheetsNext.push({ name: label, filename: drawn.filename, url: drawn.url });
        } else {
          sheetsNext.push({ name: label, filename: uploaded.filename, url: uploaded.url });
        }
      }
      if (cancelled.current) return;
      setStatus("Writing the story…");
      const outline = await generateAiOutline({
        prompt,
        audience,
        pageCount,
        style,
        characters: sheetsNext.map((item) => ({ name: item.name })),
      });
      if (cancelled.current) return;
      if (!sheetsNext.length) {
        setStatus("Drawing the characters…");
        const invented = await generateAiImage({
          kind: "character",
          audience,
          prompt: outline.characterDescription,
          artStyle: outline.artStyle || style,
          name: "cast",
        });
        sheetsNext.push({ name: "Cast", filename: invented.filename, url: invented.url });
      }
      const references = sheetsNext.map((item) => item.filename);
      setStatus("Drawing the cover…");
      const cover = await generateAiImage({
        kind: "cover",
        audience,
        prompt: `${outline.title}. ${outline.tagline}. ${outline.characterDescription}`,
        artStyle: outline.artStyle || style,
        referenceFiles: references,
      });
      const nextPages: AiDraftPage[] = [
        {
          id: "page-1",
          kind: "facsimile",
          title: outline.title,
          paragraphs: [],
          imageAsset: cover.filename,
          imageUrl: cover.url,
          position: "bottom",
          illustrationPrompt: outline.title,
        },
      ];
      for (const [index, item] of outline.pages.entries()) {
        if (cancelled.current) return;
        setStatus(`Drawing page ${index + 1} of ${outline.pages.length}…`);
        const picture = await generateAiImage({
          kind: "page",
          audience,
          prompt: item.illustrationPrompt,
          artStyle: outline.artStyle || style,
          name: String(index + 1),
          referenceFiles: references,
        });
        nextPages.push({
          id: `page-${index + 2}`,
          kind: "story",
          title: item.title,
          paragraphs: item.paragraphs,
          imageAsset: picture.filename,
          imageUrl: picture.url,
          position: "bottom",
          illustrationPrompt: item.illustrationPrompt,
        });
      }
      if (cancelled.current) return;
      setTitle(outline.title);
      setTagline(outline.tagline);
      setAuthor(outline.author);
      setDate(outline.date);
      setSheets(sheetsNext.map((item) => ({ name: item.name, url: item.url })));
      setPages(nextPages);
      setPageIndex(0);
      setStatus("Review the wording, then save. The book stays hidden until you unhide it.");
    } catch (err) {
      if (!cancelled.current) setError(err instanceof Error ? err.message : "Could not create the book");
    } finally {
      if (!cancelled.current) setBusy(false);
    }
  }

  return (
    <div>
      <label>Audience</label>
      <select value={audience} disabled={busy} onChange={(event) => setAudience(event.target.value as PublicBook["audience"])}>
        <option value="children">Children</option>
        <option value="adults">Adults</option>
      </select>
      <label>Story prompt</label>
      <textarea value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} placeholder="A shy fox finds a lantern in the woods…" />
      <label>Story pages</label>
      <input type="number" min={4} max={12} value={pageCount} disabled={busy} onChange={(event) => setPageCount(Number(event.target.value) || 8)} />
      <label>Art style (optional)</label>
      <input value={style} disabled={busy} onChange={(event) => setStyle(event.target.value)} placeholder="Watercolour, evening light" />
      <label>Characters</label>
      <p className="hint">Upload photos to turn into caricatures, or caricatures to use as-is. Leave empty to invent the cast.</p>
      {characters.map((person, index) => (
        <div key={person.id} className="ai-character-row">
          <input value={person.name} disabled={busy} placeholder={`Name ${index + 1}`} onChange={(event) => {
            const next = [...characters];
            next[index] = { ...person, name: event.target.value };
            setCharacters(next);
          }} />
          <select value={person.source} disabled={busy} onChange={(event) => {
            const next = [...characters];
            next[index] = { ...person, source: event.target.value as AiCharacterDraft["source"] };
            setCharacters(next);
          }}>
            <option value="photo">Photo → caricature</option>
            <option value="caricature">Caricature</option>
          </select>
          <input type="file" accept="image/*" disabled={busy} onChange={(event) => {
            const next = [...characters];
            next[index] = { ...person, file: event.currentTarget.files?.[0] || null };
            setCharacters(next);
          }} />
          {characters.length > 1 ? (
            <button type="button" className="ghost" disabled={busy} onClick={() => setCharacters(characters.filter((item) => item.id !== person.id))}>
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className="ghost" disabled={busy} onClick={() => setCharacters([...characters, newCharacterDraft()])}>
        Add character
      </button>
      <p className="hint">{status || "Uses your OpenAI key. One story, one caricature per photo, then a cover and one picture per story page. Keep this tab open."}</p>
      {sheets.length ? (
        <div className="ai-sheet-row">
          {sheets.map((sheet) => (
            <figure key={sheet.url} className="ai-sheet">
              <img src={sheet.url} alt="" />
              <figcaption>{sheet.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {page ? (
        <>
          <label>Book title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          <label>Subtitle</label>
          <input value={tagline} onChange={(event) => setTagline(event.target.value)} />
          <label>Author</label>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
          <label>Date</label>
          <input value={date} onChange={(event) => setDate(event.target.value)} />
          <label>Page</label>
          <select value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))}>
            {pages.map((item, index) => (
              <option key={item.id} value={index}>{index + 1}. {item.title}</option>
            ))}
          </select>
          {page.imageUrl ? <img className="ai-page-preview" src={page.imageUrl} alt="" /> : null}
          <label>Page title</label>
          <input value={page.title} onChange={(event) => {
            page.title = event.target.value;
            setPages([...pages]);
          }} />
          {page.kind === "story" ? (
            <>
              <label>Story text</label>
              <textarea value={page.paragraphs.join("\n\n")} onChange={(event) => {
                page.paragraphs = event.target.value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
                setPages([...pages]);
              }} />
              <label>Text position</label>
              <select value={page.position} onChange={(event) => {
                page.position = event.target.value as BookPage["position"];
                setPages([...pages]);
              }}>
                <option value="bottom">Bottom</option>
                <option value="top">Top</option>
              </select>
            </>
          ) : (
            <p className="hint">Cover plate — shown as a full picture with no overlay text.</p>
          )}
        </>
      ) : null}
      <div className="form-actions">
        <button type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>
          {busy ? "Creating…" : pages.length ? "Create again" : "Create book"}
        </button>
        <button
          type="button"
          disabled={!pages.length || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const saved = await createBook({
                title,
                tagline,
                author,
                date,
                coverUrl: pages[0]?.imageUrl,
                audience,
                pageTemplate: "one-up",
                characterRender: "scene",
                published: true,
                hidden: true,
                pages: pages.map((item, index) => ({
                  id: item.id,
                  sourcePage: index + 1,
                  kind: item.kind,
                  title: item.title,
                  paragraphs: item.paragraphs,
                  imageAsset: item.imageAsset,
                  fullPageAsset: item.imageAsset,
                  imageUrl: item.imageUrl,
                  fullPageUrl: item.imageUrl,
                  position: item.position,
                  focalPoint: index === 0 ? "50% 40%" : "50% 50%",
                  alt: item.title,
                })),
              });
              await onSaved(saved);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save book
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
  onDeleted,
}: {
  book: PublicBook;
  onSaved: (book: PublicBook) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [tagline, setTagline] = useState(book.tagline);
  const [author, setAuthor] = useState(book.author || "");
  const [date, setDate] = useState(book.date || "");
  const [coverUrl, setCoverUrl] = useState(book.coverUrl);
  const [hidden, setHidden] = useState(book.hidden);
  const [audience, setAudience] = useState(book.audience || "children");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<BookPdfKind | "">("");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(book.title);
    setTagline(book.tagline);
    setAuthor(book.author || "");
    setDate(book.date || "");
    setCoverUrl(book.coverUrl);
    setHidden(book.hidden);
    setAudience(book.audience || "children");
  }, [book.id]);

  useEffect(() => {
    if (!preview || !previewRef.current) return;
    const handle = mountReader(previewRef.current, { ...book, title, tagline, author, date, coverUrl }, { libraryUrl: "/admin", baseUrl: location.href });
    return () => handle.destroy();
  }, [preview, book, title, tagline, author, date, coverUrl]);

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
      <label>Audience</label>
      <select value={audience} onChange={(event) => setAudience(event.target.value as PublicBook["audience"])}>
        <option value="children">Children</option>
        <option value="adults">Adults</option>
      </select>
      <label>
        <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
        Hide from the public library
      </label>
      <p className="hint">{book.pageCount} pages. Slug: /{book.slug}</p>
      <div className="form-actions">
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
        <a className="ghost" href={`/admin/edit/${book.slug}`}>Edit pages</a>
        <button type="button" className="ghost" onClick={() => setPreview(true)}>Preview</button>
        {(["standard", "a3-a4", "a4-a5"] as BookPdfKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className="ghost"
            disabled={Boolean(pdfBusy)}
            onClick={() => {
              setPdfBusy(kind);
              setError("");
              void downloadBookPdf(book, kind)
                .catch((err: Error) => setError(err.message || "Could not make the PDF"))
                .finally(() => setPdfBusy(""));
            }}
          >
            {pdfBusy === kind ? "Preparing PDF…" : kind === "standard" ? "Standard PDF" : kind === "a3-a4" ? "A3 folded to A4" : "A4 folded to A5"}
          </button>
        ))}
        <p className="hint">Folded PDFs are for double-sided printing. Print at actual size, flip on the long edge, fold each sheet in half, and nest them with the cover sheet on the outside.</p>
        <button
          type="button"
          className="danger"
          onClick={async () => {
            if (!confirm(`Delete ${book.title}?`)) return;
            await deleteBook(book.id);
            await onDeleted();
          }}
        >
          Delete
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {preview ? (
        <div className="reader-preview">
          <button type="button" className="ghost" onClick={() => setPreview(false)}>Close preview</button>
          <div ref={previewRef} className="reader-host" />
        </div>
      ) : null}
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
