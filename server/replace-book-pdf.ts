import fs from "fs/promises";
import path from "path";
import { normalizeBookPage } from "../shared/seed-data";
import type { PublicBook } from "../shared/types";
import { imagesDir } from "./paths";
import { importPdfOnServer } from "./pdf-import";
import type { BookStore } from "./storage";

export type PdfReplaceJob =
  | { status: "running" }
  | { status: "done"; book: PublicBook }
  | { status: "error"; error: string };

const jobs = new Map<string, PdfReplaceJob>();
const tails = new Map<string, Promise<void>>();

export function pdfReplaceStatus(bookId: string): PdfReplaceJob | null {
  return jobs.get(bookId) || null;
}

/** Return the job once; drop finished jobs so a later upload can poll cleanly. */
export function takePdfReplaceStatus(bookId: string): PdfReplaceJob | null {
  const job = jobs.get(bookId) || null;
  if (job?.status === "done" || job?.status === "error") jobs.delete(bookId);
  return job;
}

/** Run one replacement at a time per book, and keep going after the HTTP response. */
export function enqueuePdfReplace(bookId: string, job: () => Promise<void>): void {
  const previous = tails.get(bookId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(job)
    .catch((err) => {
      const message = err instanceof Error ? err.message : "Could not replace the book";
      jobs.set(bookId, { status: "error", error: message });
      console.error(`[pdf] replace failed for ${bookId}:`, err);
    });
  tails.set(bookId, next);
}

/** Render the PDF and point the book at the new pages. Throws if the catalog did not keep them. */
export async function applyReplacementPdf(
  store: BookStore,
  bookId: string,
  pdfPath: string,
  originalName: string,
  revision: string,
): Promise<PublicBook> {
  const current = await store.getBookById(bookId);
  if (!current) throw new Error("Book not found");
  const imported = await importPdfOnServer(pdfPath, originalName, undefined, revision);
  const first = imported.book.pages[0];
  const updated = await store.updateBook(current.id, {
    pdf: imported.pdfAsset,
    pages: imported.book.pages.map((page, index) => normalizeBookPage(page, index)),
    cover: first?.imageAsset || current.cover,
    pageTemplate: "one-up",
    coverLayout: {
      background: current.spreadBackground || "#021b3f",
      elements: first
        ? [{
          id: "cover-art",
          type: "image" as const,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          z: 1,
          imageAsset: first.imageAsset,
          imageUrl: first.imageUrl,
          fit: "contain" as const,
          focusX: 50,
          focusY: 50,
          opacity: 100,
        }]
        : [],
    },
  });
  if (!updated) throw new Error("Book not found");
  const saved = await store.getBookById(current.id);
  const savedFirst = saved?.pages[0]?.imageAsset || "";
  const expectedFirst = first?.imageAsset || "";
  if (!saved || saved.pdf !== imported.pdfAsset || savedFirst !== expectedFirst) {
    throw new Error("The revised PDF was not saved onto this book.");
  }
  if (expectedFirst) await fs.access(path.join(imagesDir(), expectedFirst));
  return saved;
}

export function startPdfReplace(
  store: BookStore,
  bookId: string,
  pdfPath: string,
  originalName: string,
  revision: string,
): void {
  jobs.set(bookId, { status: "running" });
  enqueuePdfReplace(bookId, async () => {
    const saved = await applyReplacementPdf(store, bookId, pdfPath, originalName, revision);
    jobs.set(bookId, { status: "done", book: saved });
    console.log(`[pdf] replaced ${saved.slug} with ${saved.pageCount} pages from ${saved.pdf}`);
  });
}
