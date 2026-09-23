import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminLoginLink from "../components/AdminLoginLink";
import CoverFace from "../components/CoverFace";
import { BOOK_FONTS, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, googleFontsHref } from "@shared/book-fonts";
import { DEFAULT_PAGE_BACKGROUND, defaultCoverLayout, hasLayout } from "@shared/page-layout";
import { DEFAULT_PLAYER_SETUP, groupBooksByAudience } from "@shared/seed-data";
import type { BookListItem, PageLayout, PlayerSetup } from "@shared/types";
import { loadHomeBooks, loadHomeSetup, readCachedBooks, readCachedSetup } from "../lib/homeCache";
import { applyPalette } from "../lib/palette";

export default function HomePage() {
  const [setup, setSetup] = useState<PlayerSetup>(readCachedSetup() || DEFAULT_PLAYER_SETUP);
  const [books, setBooks] = useState<BookListItem[]>(readCachedBooks());

  useEffect(() => {
    const href = googleFontsHref(BOOK_FONTS.map((font) => font.id));
    let link = document.getElementById("home-cover-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "home-cover-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, []);

  useEffect(() => {
    applyPalette(setup.collectionColor);
    void loadHomeSetup().then((next) => {
      setSetup(next);
      applyPalette(next.collectionColor);
    });
    void loadHomeBooks().then((next) => {
      setBooks((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    });
  }, []);

  const { children, adults } = groupBooksByAudience(books);

  return (
    <main className="library">
      <AdminLoginLink />
      <header className="library-head">
        {setup.logoUrl ? <img className="library-logo" src={setup.logoUrl} alt={setup.appName} /> : <small>SPODAZO</small>}
        {setup.theme ? <p className="library-theme">{setup.theme}</p> : null}
      </header>
      <LibrarySection books={children} />
      <LibrarySection books={adults} />
      {!books.length ? <p className="empty">Books will appear here after they are published in Admin.</p> : null}
      {setup.logoUrl || setup.credits || setup.copyright ? (
        <footer className="library-legal">
          {setup.logoUrl ? <img className="library-legal-logo" src={setup.logoUrl} alt="" /> : null}
          {setup.credits ? <p className="library-credits">{setup.credits}</p> : null}
          {setup.copyright ? <p className="library-copyright">{setup.copyright}</p> : null}
        </footer>
      ) : null}
    </main>
  );
}

function coverLayoutFor(book: BookListItem): PageLayout {
  if (hasLayout(book.coverLayout)) return book.coverLayout;
  return defaultCoverLayout(book, book.coverUrl);
}

function LibrarySection({ books }: { books: BookListItem[] }) {
  if (!books.length) return null;
  return (
    <section className="library-section">
      <div className="library-grid">
        {books.map((book) => (
          <article key={book.id} className="book-card">
            <Link href={`/${book.slug}`} className="cover-link" aria-label={`Read ${book.title}`}>
              <CoverFace
                layout={coverLayoutFor(book)}
                background={book.pageBackground || DEFAULT_PAGE_BACKGROUND}
                font={book.textFont || DEFAULT_TEXT_FONT}
                ink={book.textColor || DEFAULT_TEXT_COLOR}
              />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
