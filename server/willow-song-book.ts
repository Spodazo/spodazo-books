import { isWillowBook } from "../shared/reader-pages";
import { needsWillowSongUpdate, willowSongPayload } from "../shared/willow-song-book";
import type { BookStore } from "./storage";

/** Keep Willow’s pages in step with the song lyrics after deploy. */
export async function ensureWillowSongBook(store: BookStore): Promise<void> {
  const list = await store.listBooks();
  const item = list.find((book) => isWillowBook(book));
  if (!item) return;

  const book = await store.getBookBySlug(item.slug);
  if (!book || !needsWillowSongUpdate(book)) return;

  await store.updateBook(book.id, willowSongPayload(book));
  console.log("[catalog] Willow updated to song lyrics with chorus pages");
}
