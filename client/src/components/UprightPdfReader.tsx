import { useEffect } from "react";
import { Link } from "wouter";
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, googleFontsHref } from "@shared/book-fonts";
import { DEFAULT_PAGE_BACKGROUND, ensureBookLayouts } from "@shared/page-layout";
import { portraitPagesFor } from "@shared/portrait-pages";
import { characterUrlFor } from "@shared/reader-pages";
import type { PublicBook } from "@shared/types";
import CoverFace from "./CoverFace";

export default function UprightPdfReader({ book }: { book: PublicBook }) {
  const designed = ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl: characterUrlFor(book) });
  const pages = portraitPagesFor(designed).map((layout, index) => ({ key: `portrait-${index}`, layout }));

  useEffect(() => {
    const href = googleFontsHref([designed.textFont || DEFAULT_TEXT_FONT]);
    let link = document.getElementById("upright-book-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "upright-book-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [designed.textFont]);

  return (
    <div className="upright-pdf">
      <Link href="/" className="reader-close upright-pdf-close" aria-label="Close">
        ×
      </Link>
      <div className="upright-pdf-pages">
        {pages.map((page) => (
          <div key={page.key} className="upright-spread">
            <CoverFace
              layout={page.layout}
              background={designed.pageBackground || DEFAULT_PAGE_BACKGROUND}
              texture={designed.pageTexture}
              font={designed.textFont || DEFAULT_TEXT_FONT}
              ink={designed.textColor || DEFAULT_TEXT_COLOR}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
