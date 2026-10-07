import fs from "fs/promises";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
import { createCanvas } from "@napi-rs/canvas";

declare global {
  // PDF.js fake worker on Node reads this instead of loading ./pdf.worker.mjs from dist/.
  var pdfjsWorker: typeof pdfWorker | undefined;
}

globalThis.pdfjsWorker = pdfWorker;
import { detectStoryLayout } from "../client/src/flipbook/layout.js";
import { detectPdfIndexLinks, type PdfIndexPageInput, type PageJumpLink } from "../shared/pdf-index-links";
import { imagesDir, uniqueFileName } from "./paths";
import { imageUrl, pdfUrl } from "./media";

const MAX_PAGES = 100;
const MAX_BYTES = 80 * 1024 * 1024;

export type ImportedPdfPage = {
  id: string;
  sourcePage: number;
  kind: "facsimile";
  title: string;
  paragraphs: string[];
  imageAsset: string;
  fullPageAsset: string;
  imageUrl: string;
  fullPageUrl: string;
  position: "bottom";
  focalPoint: string;
  links?: PageJumpLink[];
};

export type ImportedPdfBook = {
  schemaVersion: 1;
  title: string;
  pages: ImportedPdfPage[];
  pdfUrl: string;
};

function titleFromFilename(name: string): string {
  return (name || "New book").replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
}

async function destPageNumber(doc: { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> }, dest: unknown): Promise<number> {
  if (!dest) return 0;
  let explicit = dest;
  if (typeof dest === "string") {
    try {
      explicit = await doc.getDestination(dest);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(explicit) || !explicit[0]) return 0;
  try {
    return (await doc.getPageIndex(explicit[0])) + 1;
  } catch {
    return 0;
  }
}

async function readLinkAnnotations(
  doc: { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> },
  page: { getAnnotations: () => Promise<unknown[]> },
  viewport: { width: number; height: number; convertToViewportRectangle?: (rect: number[]) => number[] },
): Promise<PdfIndexPageInput["annotations"]> {
  const anns = await page.getAnnotations();
  const links: NonNullable<PdfIndexPageInput["annotations"]> = [];
  for (const raw of anns) {
    const ann = raw as {
      subtype?: string;
      dest?: unknown;
      url?: string;
      title?: string;
      contents?: string;
      rect?: number[];
    };
    if (String(ann.subtype || "") !== "Link") continue;
    const dest = await destPageNumber(doc, ann.dest);
    if (!dest || dest < 1) continue;
    const pdfRect = Array.isArray(ann.rect) ? ann.rect : [0, 0, 0, 0];
    const rect = viewport.convertToViewportRectangle
      ? viewport.convertToViewportRectangle(pdfRect)
      : [pdfRect[0], viewport.height - pdfRect[3], pdfRect[2], viewport.height - pdfRect[1]];
    const leftPx = Math.min(rect[0], rect[2]);
    const topPx = Math.min(rect[1], rect[3]);
    const widthPx = Math.abs(rect[2] - rect[0]);
    const heightPx = Math.abs(rect[3] - rect[1]);
    links.push({
      destPage: dest,
      left: (leftPx / viewport.width) * 100,
      top: (topPx / viewport.height) * 100,
      width: (widthPx / viewport.width) * 100,
      height: (heightPx / viewport.height) * 100,
      label: String(ann.title || ann.contents || "").trim(),
    });
  }
  return links;
}

type PdfJsDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number; transform: number[]; convertToViewportRectangle?: (rect: number[]) => number[] };
    getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
    getAnnotations: () => Promise<unknown[]>;
    cleanup: () => void;
    render: (opts: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: unknown }) => { promise: Promise<void> };
  }>;
  getDestination: (name: string) => Promise<unknown>;
  getPageIndex: (ref: unknown) => Promise<number>;
  cleanup: () => Promise<void>;
};

async function indexPageFromPdf(doc: PdfJsDoc, sourcePage: number): Promise<PdfIndexPageInput> {
  const page = await doc.getPage(sourcePage);
  const base = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .filter((t) => "str" in t)
    .map((t) => {
      const text = t as { str: string; transform: number[] };
      const m = pdfjs.Util.transform(base.transform, text.transform);
      return { text: text.str, x: m[4], y: m[5], size: Math.hypot(m[2], m[3]) };
    });
  const annotations = await readLinkAnnotations(doc, page, base);
  return {
    sourcePage,
    width: base.width,
    height: base.height,
    items,
    annotations,
  };
}

export async function detectPdfIndexLinksFromFile(pdfPath: string, bookTitle = ""): Promise<Map<number, PageJumpLink[]>> {
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise as PdfJsDoc;
  try {
    const indexPages: PdfIndexPageInput[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const indexPage = await indexPageFromPdf(doc, i);
      indexPages.push(indexPage);
      // getPage objects from the text-only pass can be released.
    }
    return detectPdfIndexLinks(indexPages, bookTitle);
  } finally {
    await doc.cleanup();
  }
}

export async function importPdfOnServer(
  pdfPath: string,
  originalName: string,
  onProgress?: (page: number, total: number) => void,
): Promise<{ book: ImportedPdfBook; pdfAsset: string }> {
  const stat = await fs.stat(pdfPath);
  if (stat.size > MAX_BYTES) throw new Error("PDF exceeds the 80 MB import limit.");
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const header = new TextDecoder().decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("This file is not a PDF.");

  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`Maximum ${MAX_PAGES} pages per book.`);
    const pages: ImportedPdfPage[] = [];
    const indexPages: PdfIndexPageInput[] = [];
    await fs.mkdir(imagesDir(), { recursive: true });

    for (let i = 1; i <= doc.numPages; i += 1) {
      onProgress?.(i, doc.numPages);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items
        .filter((t) => "str" in t)
        .map((t) => {
          const text = t as { str: string; transform: number[] };
          const m = pdfjs.Util.transform(base.transform, text.transform);
          return { text: text.str, x: m[4], y: m[5], size: Math.hypot(m[2], m[3]) };
        });
      const annotations = await readLinkAnnotations(doc, page, base);
      indexPages.push({
        sourcePage: i,
        width: base.width,
        height: base.height,
        items,
        annotations,
      });
      const layout = detectStoryLayout(items, base.width, base.height, "auto");
      const scale = Math.min(1800 / Math.max(base.width, base.height), Math.sqrt(4_000_000 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;

      const jpeg = canvas.toBuffer("image/jpeg", 91);
      const fileName = `page-${String(i).padStart(3, "0")}.jpg`;
      const dest = path.join(imagesDir(), uniqueFileName(imagesDir(), fileName));
      await fs.writeFile(dest, jpeg);
      const asset = path.basename(dest);
      const url = imageUrl(asset);

      pages.push({
        id: `page-${i}`,
        sourcePage: i,
        kind: "facsimile",
        title: layout?.title || `Page ${i}`,
        paragraphs: layout?.paragraphs || [],
        imageAsset: asset,
        fullPageAsset: asset,
        imageUrl: url,
        fullPageUrl: url,
        position: "bottom",
        focalPoint: "50% 50%",
      });
      page.cleanup();
    }

    const indexLinks = detectPdfIndexLinks(indexPages, titleFromFilename(originalName));
    for (const page of pages) {
      const links = indexLinks.get(page.sourcePage);
      if (links?.length) page.links = links;
    }

    const pdfAsset = path.basename(pdfPath);
    return {
      book: {
        schemaVersion: 1,
        title: titleFromFilename(originalName),
        pages,
        pdfUrl: pdfUrl(pdfAsset),
      },
      pdfAsset,
    };
  } finally {
    await doc.cleanup();
  }
}
