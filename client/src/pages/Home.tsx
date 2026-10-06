import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminLoginLink from "../components/AdminLoginLink";
import CoverFace from "../components/CoverFace";
import { BOOK_FONTS, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, googleFontsHref } from "@shared/book-fonts";
import { DEFAULT_PAGE_BACKGROUND, libraryCoverLayout } from "@shared/page-layout";
import { DEFAULT_PLAYER_SETUP, sortBooksByAdminOrder } from "@shared/seed-data";
import type { BookListItem, PlayerSetup } from "@shared/types";
import { isBundledFlipbookSlug } from "@shared/bundled-flipbooks";
import { isFacsimileFlipbookListItem } from "@shared/facsimile-flipbook";
import { fetchBook } from "../lib/api";
import { markBookOpen } from "../lib/bookOpen";
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
    const applyBooks = () => {
      void loadHomeBooks().then((next) => {
        const ordered = sortBooksByAdminOrder(next);
        setBooks((current) => JSON.stringify(current) === JSON.stringify(ordered) ? current : ordered);
      });
    };
    applyBooks();
    const onVisible = () => {
      if (document.visibilityState === "visible") applyBooks();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", applyBooks);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", applyBooks);
    };
  }, []);

  const shelf = sortBooksByAdminOrder(books);

  return (
    <main className="library">
      <AdminLoginLink />
      <header className="library-head">
        {setup.logoUrl ? <img className="library-logo" src={setup.logoUrl} alt={setup.appName} /> : <small>SPODAZO</small>}
        {setup.theme ? <p className="library-theme">{setup.theme}</p> : null}
      </header>
      <LibrarySection books={shelf} />
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

function LibrarySection({ books }: { books: BookListItem[] }) {
  if (!books.length) return null;
  return (
    <section className="library-section">
      <div className="library-grid">
        {books.map((book) => (
          <LibraryBookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

function LibraryBookCard({ book }: { book: BookListItem }) {
  return (
    <article className="book-card">
      <Link
        href={`/${book.slug}`}
        className="cover-link"
        aria-label={`Read ${book.title}`}
        onClick={() => {
          markBookOpen({ bundled: isBundledFlipbookSlug(book.slug) || isFacsimileFlipbookListItem(book) });
          void fetchBook(book.slug);
        }}
      >
        <CoverFace
          layout={libraryCoverLayout(book)}
          background={book.pageBackground || DEFAULT_PAGE_BACKGROUND}
          texture={book.pageTexture}
          font={book.textFont || DEFAULT_TEXT_FONT}
          ink={book.textColor || DEFAULT_TEXT_COLOR}
        />
      </Link>
    </article>
  );
}
