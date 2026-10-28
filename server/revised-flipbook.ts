import fs from "fs";
import path from "path";
import { usesStaticBundledFlipbook } from "../shared/bundled-flipbooks";
import {
  FACSIMILE_A4_RATIO,
  facsimileFlipbookTheme,
  facsimilePageLinks,
  facsimilePageUrls,
  facsimileSpreads,
} from "../shared/facsimile-flipbook";
import type { PublicBook } from "../shared/types";
import type { BookStore } from "./storage";

const DIR_SLUG: Record<string, string> = {
  "rudolph-the-red-nosed-reindeer": "Rudolph",
  "be-thou-my-vision": "Be-Thou-My-Vision",
};

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char
  ));
}

function facsimileSource(): { css: string; engine: string } {
  const css = process.env.FACSIMILE_CSS;
  const engine = process.env.FACSIMILE_ENGINE;
  if (css && engine) return { css, engine };
  const dir = path.resolve(process.cwd(), "client/src/flipbook");
  return {
    css: fs.readFileSync(path.join(dir, "facsimile-flipbook.css"), "utf8"),
    engine: fs.readFileSync(path.join(dir, "facsimile-flipbook-engine.js"), "utf8"),
  };
}

/** Flipbook document for a catalog book that replaced the shipped HTML export. */
export function revisedFlipbookDocument(book: PublicBook, libraryUrl = "/"): string {
  const pages = facsimilePageUrls(book.pages || []).filter(Boolean);
  if (!pages.length) return "";
  const { css, engine } = facsimileSource();
  const theme = facsimileFlipbookTheme(book);
  const title = String(book.title || "Flip book").replace(/\n/g, " ");
  const config = {
    title,
    pages,
    spreads: facsimileSpreads(pages.length),
    ratio: FACSIMILE_A4_RATIO,
    libraryUrl,
    pageLinks: facsimilePageLinks(book.pages || []),
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en" style="--ground:${escapeHTML(theme.ground)};--ground-edge:${escapeHTML(theme.groundEdge)};--paper:${escapeHTML(theme.paper)};--again:${escapeHTML(theme.paper)};--gold:${escapeHTML(theme.gold)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"><title>${escapeHTML(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500&display=swap"><style>${css}</style></head><body><div id="stage" aria-label="${escapeHTML(title)} flip book" role="application"><a id="closeBtn" class="flipbook-close left" href="${escapeHTML(libraryUrl)}" target="_top" aria-label="Close">×</a><div id="book"><div class="stackWrapL"><div class="stack l" id="stackL"></div></div><div class="stackWrapR"><div class="stack r" id="stackR"></div></div><div class="slot L" id="slotL"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="slot R" id="slotR"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="leaf" id="leaf"><div class="face front"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div><div class="face back"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div></div><div class="arrow l off" id="arrL" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div><div class="arrow r" id="arrR" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></div></div></div><script src="/flipbooks/mobile-view-zoom.js"></script><script src="/flipbooks/landscape-hint.js"></script><script>window.FACSIMILE_FLIPBOOK=${json};</script><script>${engine}</script></body></html>`;
}

/** The saved PDF, when one exists, instead of the shipped flipbook files. */
export async function revisedFlipbookForDir(store: BookStore, dirName: string): Promise<string | null> {
  const slug = DIR_SLUG[path.basename(dirName || "")];
  if (!slug) return null;
  const book = await store.getBookBySlug(slug);
  if (!book || usesStaticBundledFlipbook(book)) return null;
  const html = revisedFlipbookDocument(book);
  return html || null;
}
