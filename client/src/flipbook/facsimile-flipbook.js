import css from "./facsimile-flipbook.css?raw";
import engine from "./facsimile-flipbook-engine.js?raw";
import { escapeHTML as esc, safeURL } from "./layout.js";
import {
  FACSIMILE_A4_RATIO,
  facsimileFlipbookTheme,
  facsimilePageUrls,
  facsimileSpreads,
} from "@shared/facsimile-flipbook";

function embedJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pageHref(url, baseUrl) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    return safeURL(raw, baseUrl);
  } catch {
    return raw.startsWith("/") ? raw : "";
  }
}

export function createFacsimileFlipbookDocument(book, { libraryUrl = "/", baseUrl = location.href } = {}) {
  const pages = facsimilePageUrls(book.pages || []).map((url) => pageHref(url, baseUrl)).filter(Boolean);
  if (!pages.length) throw new Error("This book has no pages.");
  const theme = facsimileFlipbookTheme(book);
  const title = String(book.title || "Flip book").replace(/\n/g, " ");
  const config = {
    title,
    pages,
    spreads: facsimileSpreads(pages.length),
    ratio: FACSIMILE_A4_RATIO,
    libraryUrl,
  };
  return `<!doctype html><html lang="en" style="--ground:${esc(theme.ground)};--ground-edge:${esc(theme.groundEdge)};--paper:${esc(theme.paper)};--again:${esc(theme.paper)};--gold:${esc(theme.gold)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500&display=swap"><style>${css}</style></head><body><div id="stage" aria-label="${esc(title)} flip book" role="application"><a id="closeBtn" class="flipbook-close left" href="${esc(libraryUrl)}" target="_top" aria-label="Close">×</a><div id="book"><div class="stackWrapL"><div class="stack l" id="stackL"></div></div><div class="stackWrapR"><div class="stack r" id="stackR"></div></div><div class="slot L" id="slotL"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="slot R" id="slotR"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="leaf" id="leaf"><div class="face front"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div><div class="face back"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div></div><div class="arrow l off" id="arrL" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div><div class="arrow r" id="arrR" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></div></div></div><script src="/flipbooks/mobile-view-zoom.js"></script><script>window.FACSIMILE_FLIPBOOK=${embedJson(config)};</script><script>${engine}</script></body></html>`;
}

export function mountFacsimileFlipbook(container, book, options = {}) {
  const frame = document.createElement("iframe");
  frame.title = String(book.title || "Flip book").replace(/\n/g, " ");
  frame.className = "bundled-flipbook-frame";
  frame.style.cssText = "width:100%;height:100%;border:0;display:block";
  frame.srcdoc = createFacsimileFlipbookDocument(book, options);
  container.replaceChildren(frame);
  return { frame, destroy() { frame.remove(); } };
}
