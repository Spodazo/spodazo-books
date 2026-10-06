import { isBundledFlipbookSlug } from "../shared/bundled-flipbooks";
import { indexLinksEqual } from "../shared/pdf-index-links";
import { shouldUseFacsimileFlipbook } from "../shared/facsimile-flipbook";
import type { BookPage } from "../shared/types";
import { localPdfPath } from "./media";
import { detectPdfIndexLinksFromFile } from "./pdf-import";
import type { BookStore } from "./storage";

function linksChanged(pages: BookPage[], next: Map<number, NonNullable<BookPage["links"]>>): boolean {
  return pages.some((page) => !indexLinksEqual(page.links, next.get(page.sourcePage) || []));
}

/** Re-read stored PDFs so already-imported song lists pick up box and destination fixes. */
export async function refreshImportedPdfIndexLinks(store: BookStore): Promise<number> {
  const list = await store.listBooks();
  let updated = 0;
  for (const item of list) {
    if (isBundledFlipbookSlug(item.slug)) continue;
    if (!shouldUseFacsimileFlipbook(item)) continue;
    const book = await store.getBookById(item.id);
    if (!book?.pdf || !book.pages.length) continue;
    const pdfPath = localPdfPath(book.pdf);
    if (!pdfPath) continue;
    try {
      const found = await detectPdfIndexLinksFromFile(pdfPath, book.title);
      if (!found.size && !book.pages.some((page) => (page.links || []).length)) continue;
      if (!linksChanged(book.pages, found)) continue;
      const pages = book.pages.map((page) => ({
        ...page,
        links: found.get(page.sourcePage) || [],
      }));
      await store.updateBook(book.id, { pages });
      updated += 1;
      console.log(`[catalog] refreshed contents links for ${book.slug}`);
    } catch (err) {
      console.error(`[catalog] contents link refresh failed for ${item.slug}:`, err);
    }
  }
  return updated;
}
