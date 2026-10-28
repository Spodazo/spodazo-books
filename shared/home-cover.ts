import { libraryCoverLayout } from "./page-layout";
import type { BookListItem, PageLayout } from "./types";
import { isWillowBook } from "./reader-pages";
import { WILLOW_FRONT_COVER_URL, willowFrontCoverLayout } from "./willow-song-book";

/** Shelf cards are about 720px wide. The reader still uses the full Willow cover. */
export const HOME_COVER_WIDTH = 720;

export function homeCoverSrc(book: Pick<BookListItem, "slug" | "title" | "cover" | "coverUrl" | "pdfUrl" | "coverLayout" | "tagline" | "author">): string {
  if (isWillowBook(book)) {
    const base = WILLOW_FRONT_COVER_URL;
    if (/[?&]w=\d+/.test(base)) return base;
    return `${base}${base.includes("?") ? "&" : "?"}w=${HOME_COVER_WIDTH}`;
  }
  const layout = libraryCoverLayout(book);
  const image = layout.elements.find((element) => element.type === "image" && element.imageUrl);
  return image?.imageUrl || book.coverUrl || "";
}

/** The picture the shelf actually shows, so its box can match the file before it downloads. */
export function homeCoverLayout(book: BookListItem): PageLayout {
  if (!isWillowBook(book)) return libraryCoverLayout(book);
  const src = homeCoverSrc(book);
  const layout = willowFrontCoverLayout();
  return {
    ...layout,
    elements: layout.elements.map((element) => (
      element.type === "image" ? { ...element, imageUrl: src } : element
    )),
  };
}
