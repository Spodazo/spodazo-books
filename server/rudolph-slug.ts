import { RUDOLPH_SLUG } from "../shared/rudolph";
import type { BookStore } from "./storage";

/** Point the live Rudolph catalog entry at /Rudolph. Idempotent. */
export async function ensureRudolphPublicSlug(store: BookStore): Promise<void> {
  const list = await store.listBooks();
  const item = list.find((book) => /rudolph/i.test(book.slug || "") || /rudolph/i.test(book.title || ""));
  if (!item || item.slug === RUDOLPH_SLUG) return;

  const taken = list.some((book) => book.id !== item.id && book.slug.toLowerCase() === RUDOLPH_SLUG.toLowerCase());
  if (taken) {
    console.error(`[catalog] Rudolph slug left as /${item.slug}; /${RUDOLPH_SLUG} is already used`);
    return;
  }

  await store.updateBook(item.id, { slug: RUDOLPH_SLUG });
  console.log(`[catalog] Rudolph public URL is /${RUDOLPH_SLUG}`);
}
