import { isBundledFlipbookSlug } from "../shared/bundled-flipbooks";
import { indexLinksEqual, matchSongListToPages, realignIndexLinksByOrder } from "../shared/pdf-index-links";
import { shouldUseFacsimileFlipbook } from "../shared/facsimile-flipbook";
import type { BookPage, PageJumpLink } from "../shared/types";
import { recognizeContentsLines } from "./contents-ocr";
import { localImagePath, localPdfPath } from "./media";
import { detectPdfIndexLinksFromFile } from "./pdf-import";
import type { BookStore } from "./storage";

function linksChanged(pages: BookPage[], next: Map<number, NonNullable<BookPage["links"]>>): boolean {
  return pages.some((page) => !indexLinksEqual(page.links, next.get(page.sourcePage) || []));
}

async function realignImageContents(
  pages: BookPage[],
  found: Map<number, PageJumpLink[]>,
): Promise<void> {
  for (const page of pages) {
    const links = found.get(page.sourcePage) || page.links || [];
    if (links.length < 2) continue;
    const image = localImagePath(page.fullPageAsset || page.imageAsset || "");
    if (!image) continue;
    const lines = await recognizeContentsLines(image);
    const rows = matchSongListToPages(lines, pages);
    const next = realignIndexLinksByOrder(links, rows);
    if (next.some((link, index) => link.page !== links[index].page)) found.set(page.sourcePage, next);
  }
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
      await realignImageContents(book.pages, found);
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
