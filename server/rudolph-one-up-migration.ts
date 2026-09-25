import { DEFAULT_PAGE_BACKGROUND } from "../shared/page-layout";
import type { BookStore } from "./storage";

/** One-time idempotent fix for the imported Rudolph portrait book (cover overlay + one-up template). */
export async function ensureRudolphOneUpDisplay(store: BookStore): Promise<void> {
  const list = await store.listBooks();
  const item = list.find((book) => /rudolph/i.test(book.slug || ""));
  if (!item) return;

  const book = await store.getBookBySlug(item.slug);
  if (!book) return;

  const elements = book.coverLayout?.elements || [];
  const hasTextOverlay = elements.some((el) => el.type === "text" || el.id === "cover-band");
  const alreadyOneUp = book.pageTemplate === "one-up";
  const singleCoverArt =
    elements.length === 1 &&
    elements[0].type === "image" &&
    elements[0].id === "cover-art" &&
    (elements[0].w || 0) >= 99;

  if (alreadyOneUp && !hasTextOverlay && singleCoverArt) return;

  const coverAsset = book.cover || elements.find((el) => el.type === "image")?.imageAsset || "";
  await store.updateBook(book.id, {
    pageTemplate: "one-up",
    coverLayout: {
      background: book.pageBackground || DEFAULT_PAGE_BACKGROUND,
      elements: [
        {
          id: "cover-art",
          type: "image",
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          z: 1,
          imageAsset: coverAsset,
          fit: "contain",
          focusX: 50,
          focusY: 50,
          opacity: 100,
        },
      ],
    },
  });
  console.log("[catalog] Rudolph book set to one-up portrait display with plain cover art");
}
