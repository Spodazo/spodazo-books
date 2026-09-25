import { isOneLeafPdfPage } from "@shared/page-layout";
import type { Book, BookPage } from "@shared/types";

export type StoryPageHtmlDeps = {
  esc: (value: string) => string;
  safeURL: (url: string, baseUrl: string) => string;
  baseUrl: string;
  book: Book;
  skipCover: boolean;
  oneLeaf: boolean;
  hasLayout: (layout: BookPage) => boolean;
  laidOutPage: (label: string, layout: BookPage, zones: string) => string;
  pageFill: (page: BookPage, book: Book) => string;
  storyBody: (paragraphs: string[]) => string[];
};

function facsimileLeafImg(page: BookPage, deps: StoryPageHtmlDeps): string {
  const focal = /^\d{1,3}% \d{1,3}%$/.test(page.focalPoint || "") ? page.focalPoint : "50% 50%";
  const image = deps.safeURL(page.fullPageUrl || page.imageUrl, deps.baseUrl);
  return `<img src="${deps.esc(image)}" alt="${deps.esc(page.alt || page.title)}" style="object-position:${focal}">`;
}

function facsimileSpreadHtml(
  left: BookPage | null,
  right: BookPage | null,
  deps: StoryPageHtmlDeps,
  label: string,
  spreadIndex: number,
): string {
  const zones = `<button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="Next page"></button>`;
  const fill = deps.pageFill(left || right || { background: "" }, deps.book);
  const leftHtml = left ? facsimileLeafImg(left, deps) : "";
  const rightHtml = right ? facsimileLeafImg(right, deps) : "";
  return `<article class="page facsimile pdf-spread" data-spread="${spreadIndex}" aria-label="${deps.esc(label)}" style="background-color:${fill}"><div class="pdf-leaf leaf-left">${leftHtml}</div><div class="pdf-leaf leaf-right">${rightHtml}</div>${zones}</article>`;
}

function facsimileSingleHtml(page: BookPage, deps: StoryPageHtmlDeps, extraClass: string, label: string): string {
  const zones = `<button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="Next page"></button>`;
  const classes = `page facsimile${extraClass ? ` ${extraClass}` : ""}`;
  return `<article class="${classes}" aria-label="${deps.esc(label)}" style="background-color:${deps.pageFill(page, deps.book)}">${facsimileLeafImg(page, deps)}${zones}</article>`;
}

export function storyPagesHtml(storyPages: BookPage[], deps: StoryPageHtmlDeps): string {
  const pdfSpreads = deps.oneLeaf && storyPages.length > 0 && storyPages.every(isOneLeafPdfPage);
  if (!pdfSpreads) {
    return storyPages.map((p, i) => {
      const zones = `<button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="Next page"></button>`;
      const coverOnly = !deps.skipCover && i === 0;
      const pdfLeaf = isOneLeafPdfPage(p);
      if (deps.hasLayout(p) && !pdfLeaf) return deps.laidOutPage(p.title || `Page ${i + 1}`, p, zones);
      const fallback = pdfLeaf || coverOnly;
      const leafSide = deps.oneLeaf && fallback && !coverOnly ? (i % 2 === 0 ? " leaf-right" : " leaf-left") : "";
      const classes = `page${fallback ? " facsimile" : ""}${deps.oneLeaf && fallback ? ` one-leaf${leafSide}` : ""}${coverOnly ? " cover-plate" : ""}`;
      const focal = /^\d{1,3}% \d{1,3}%$/.test(p.focalPoint || "") ? p.focalPoint : "50% 50%";
      const image = deps.safeURL(
        coverOnly ? (deps.book.coverUrl || p.fullPageUrl || p.imageUrl) : fallback ? p.fullPageUrl || p.imageUrl : p.imageUrl,
        deps.baseUrl,
      );
      const text = fallback ? "" : `<section><p>${deps.storyBody(p.paragraphs).map(deps.esc).join(" ")}</p></section>`;
      return `<article class="${classes}" aria-label="${deps.esc(p.title || `Page ${i + 1}`)}" style="background-color:${deps.pageFill(p, deps.book)}"><img src="${deps.esc(image)}" alt="${deps.esc(p.alt || p.title)}" style="object-position:${focal}">${text}${zones}</article>`;
    }).join("");
  }

  let html = "";
  let start = 0;
  if (!deps.skipCover && storyPages.length) {
    html += facsimileSingleHtml(storyPages[0], deps, "cover-plate", storyPages[0].title || "Cover");
    start = 1;
  }
  const slice = storyPages.slice(start);
  for (let i = 0; i < slice.length; i += 2) {
    const right = slice[i];
    const left = slice[i + 1] || null;
    const spreadNum = Math.floor(i / 2) + 1;
    const label = left
      ? `${right.title || `Page ${i + 1}`} / ${left.title || `Page ${i + 2}`}`
      : (right.title || `Spread ${spreadNum}`);
    html += facsimileSpreadHtml(left, right, deps, label, spreadNum);
  }
  return html;
}

export function facsimileSpreadCount(storyPages: BookPage[], skipCover: boolean): number {
  let start = 0;
  if (!skipCover && storyPages.length) start = 1;
  return Math.ceil(Math.max(0, storyPages.length - start) / 2);
}
