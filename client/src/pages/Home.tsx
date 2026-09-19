import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminLoginLink from "../components/AdminLoginLink";
import { DEFAULT_PLAYER_SETUP } from "@shared/seed-data";
import type { BookListItem, PlayerSetup } from "@shared/types";
import { loadHomeBooks, loadHomeSetup, readCachedBooks, readCachedSetup } from "../lib/homeCache";
import { applyPalette } from "../lib/palette";

export default function HomePage() {
  const [setup, setSetup] = useState<PlayerSetup>(readCachedSetup() || DEFAULT_PLAYER_SETUP);
  const [books, setBooks] = useState<BookListItem[]>(readCachedBooks());

  useEffect(() => {
    applyPalette(setup.collectionColor);
    void loadHomeSetup().then((next) => {
      setSetup(next);
      applyPalette(next.collectionColor);
    });
    void loadHomeBooks().then(setBooks);
  }, []);

  return (
    <main className="library">
      <AdminLoginLink />
      <header className="library-head">
        {setup.logoUrl ? <img className="library-logo" src={setup.logoUrl} alt={setup.appName} /> : <small>SPODAZO</small>}
        <h1>Our storybooks</h1>
        {setup.theme ? <p className="library-theme">{setup.theme}</p> : null}
      </header>
      <section className="library-grid">
        {books.map((book) => (
          <article key={book.id} className="book-card">
            <Link href={`/${book.slug}`} className="cover-link" aria-label={`Read ${book.title}`}>
              {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <div className="cover-empty" />}
            </Link>
            <div className="caption">
              <h2>{book.title}</h2>
              {book.tagline ? <p>{book.tagline}</p> : null}
              <div className="actions">
                <Link href={`/${book.slug}`}>Read</Link>
                {book.pdfUrl ? (
                  <a href={book.pdfUrl} download>
                    Download
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {!books.length ? <p className="empty">Books will appear here after they are published in Admin.</p> : null}
      </section>
    </main>
  );
}
