import { useEffect } from "react";
import { Link } from "wouter";
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, googleFontsHref } from "@shared/book-fonts";
import { DEFAULT_PAGE_BACKGROUND, ensureBookLayouts, hasLayout } from "@shared/page-layout";
import { characterUrlFor, visibleStoryPages } from "@shared/reader-pages";
import type { PageLayout, PublicBook } from "@shared/types";
import CoverFace from "./CoverFace";

function asLayout(page: { elements?: PageLayout["elements"]; background?: string }): PageLayout {
  return { elements: page.elements || [], background: page.background };
}

export default function UprightPdfReader({ book }: { book: PublicBook }) {
  const designed = ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl: characterUrlFor(book) });
  const pages: Array<{ key: string; layout: PageLayout }> = [];
  if (hasLayout(designed.titleLayout)) pages.push({ key: "title", layout: designed.titleLayout });
  visibleStoryPages(designed).forEach((page, index) => {
    if (hasLayout(page)) pages.push({ key: page.id || `page-${index}`, layout: asLayout(page) });
  });
  if (hasLayout(designed.endLayout)) pages.push({ key: "end", layout: designed.endLayout });

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
      <p className="upright-pdf-bar">Turn your phone for our flipbook version.</p>
    </div>
  );
}
