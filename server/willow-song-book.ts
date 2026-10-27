import { isWillowBook } from "../shared/reader-pages";
import {
  needsOpeningPageFont,
  needsWillowSongUpdate,
  usesOldWillowCover,
  willowFrontCoverLayout,
  WILLOW_FRONT_COVER,
  willowSongPayload,
  withOpeningPageFont,
} from "../shared/willow-song-book";
import type { BookInput, BookStore } from "./storage";

/** Keep Willow’s pages, cover, and opening-page font in step after deploy. */
export async function ensureWillowSongBook(store: BookStore): Promise<void> {
  const list = await store.listBooks();
  const item = list.find((book) => isWillowBook(book));
  if (!item) return;

  const book = await store.getBookBySlug(item.slug);
  if (!book) return;

  const patch: Partial<BookInput> = {};
  if (needsWillowSongUpdate(book)) Object.assign(patch, willowSongPayload(book));
  if (usesOldWillowCover(book)) {
    patch.cover = WILLOW_FRONT_COVER;
    patch.coverLayout = willowFrontCoverLayout();
  }
  const titleLayout = patch.titleLayout || book.titleLayout;
  if (needsOpeningPageFont({ ...book, titleLayout })) patch.titleLayout = withOpeningPageFont(titleLayout);
  if (!Object.keys(patch).length) return;

  await store.updateBook(book.id, patch);
  console.log("[catalog] Willow cover and opening page updated");
}
