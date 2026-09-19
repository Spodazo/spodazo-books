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
          <button type="button" onClick={() => setImportOpen(true)}>Add book from PDF</button>
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
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(book.title);
    setTagline(book.tagline);
    setAuthor(book.author || "");
    setDate(book.date || "");
    setCoverUrl(book.coverUrl);
    setHidden(book.hidden);
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
      <input value={author} onChange={(event) => setAuthor(event.target.value)} />
      <label>Date</label>
      <input value={date} onChange={(event) => setDate(event.target.value)} placeholder="2026" />
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
              await onSaved(await updateBook(book.id, { title, tagline, author, date, coverUrl, hidden }));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          Save
        </button>
        <button type="button" className="ghost" onClick={() => setPreview(true)}>Preview</button>
        {book.pdfUrl ? <a className="ghost" href={book.pdfUrl} download>Download PDF</a> : null}
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
