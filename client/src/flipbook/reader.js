import css from './reader.css?raw';
import runtime from './reader-runtime.js?raw';
import {escapeHTML as esc, safeURL} from './layout.js';
import {fontStack, fontsUsed, googleFontsHref} from '@shared/book-fonts';
import {paletteById} from '@shared/palettes';
import {characterUrlFor, visibleStoryPages} from '@shared/reader-pages';

function coverSrc(book, baseUrl) {
  const cover = book.coverUrl || book.pages?.[0]?.imageUrl || book.pages?.[0]?.fullPageUrl || '';
  return cover ? esc(safeURL(cover, baseUrl)) : '';
}

function titleHtml(title) {
  const words = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const lines = [];
  for (let i = 0; i < words.length; i += 2) {
    lines.push(`<span>${esc(words.slice(i, i + 2).join(" "))}</span>`);
  }
  return lines.join("");
}

function subtitleHtml(tagline) {
  return String(tagline || "")
    .split(/\./)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="title-sub">${esc(line)}</p>`)
    .join("");
}

function adminLoginHtml() {
  return `<a class="admin-login" href="/admin" target="_top" aria-label="Admin login" title="Admin login"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zm-8 0V7a3 3 0 0 1 6 0v2H9zm3 5.2a1.8 1.8 0 0 1 .8 3.4V19h-1.6v-1.4a1.8 1.8 0 0 1 .8-3.4z"/></svg></a>`;
}

function pageCurlHtml(baseUrl) {
  return `<div class="page-curl" hidden aria-hidden="true"><div class="page-curl-peek"></div><img class="page-curl-flap" src="${esc(safeURL("/media/images/page-curl.png", baseUrl))}" alt=""></div>`;
}

function pageFill(page, book) {
  const value = String(page?.background || book?.pageBackground || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#efdda6";
}

function hasLayout(layout) {
  return Boolean(layout?.elements?.length);
}

function elementInk(el, book) {
  const value = String(el?.color || book?.textColor || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#203b2a";
}

function bookFontFamilies(book) {
  const ids = [book?.textFont];
  for (const layout of [book?.titleLayout, book?.endLayout, ...(book?.pages || [])]) {
    for (const el of layout?.elements || []) {
      if (el.fontFamily) ids.push(el.fontFamily);
    }
  }
  return fontsUsed(...ids);
}

function elementHtml(el, baseUrl, book) {
  const align = el.align === "center" || el.align === "right" ? el.align : "left";
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const style = `left:${Number(el.x) || 0}%;top:${Number(el.y) || 0}%;width:${Number(el.w) || 10}%;height:${Number(el.h) || 10}%;z-index:${Number(el.z) || 1};--fs:${Number(el.fontSize) || 4};--ff:${fontStack(el.fontFamily || book?.textFont)};--ink:${elementInk(el, book)};--ta:${align};--tj:${justify};--fit:${imageFit(el)}`;
  if (el.type === "image") {
    const src = esc(safeURL(el.imageUrl || "", baseUrl));
    return src ? `<img class="el el-image" src="${src}" alt="" style="${style}">` : "";
  }
  return `<div class="el el-text" style="${style}"><p>${esc(el.text || "")}</p></div>`;
}

function laidOutPage(label, layout, book, baseUrl, extra = "", extraClass = "") {
  const fill = pageFill(layout, book);
  const items = (layout.elements || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((el) => elementHtml(el, baseUrl, book)).join("");
  return `<article class="page laid-out${extraClass}" aria-label="${esc(label)}" style="background:${fill}">${items}${extra}</article>`;
}

function storyBody(paragraphs) {
  return (paragraphs || [])
    .map((line) => String(line).trim())
    .filter((line) => line && !/^\d+\s*\/\s*\d+$/.test(line));
}

function isWillow(book) {
  return /willow/i.test(String(book.slug || "")) || /willow/i.test(String(book.title || ""));
}

function imageFit(el) {
  if (el.fit === "contain" || el.id === "title-cover" || el.id === "end-art") return "contain";
  return "cover";
}

function legalHtml(credits, copyright, logoUrl, baseUrl) {
  const credit = String(credits || "").trim();
  const copy = String(copyright || "").trim();
  const logo = logoUrl ? esc(safeURL(logoUrl, baseUrl)) : "";
  if (!credit && !copy && !logo) return "";
  return `<footer class="end-legal">${logo?`<img class="end-logo" src="${logo}" alt="">`:""}${credit?`<p class="end-credits">${esc(credit)}</p>`:""}${copy?`<p class="end-copyright">${esc(copy)}</p>`:""}</footer>`;
}

function characterSrc(book, baseUrl) {
  const url = characterUrlFor(book);
  return url ? esc(safeURL(url, baseUrl)) : "";
}

function endPageHtml(book, baseUrl, credits, copyright, logoUrl) {
  const extras = `${legalHtml(credits,copyright,logoUrl,baseUrl)}<button type="button" class="read-again">Read again</button><button class="zone" data-dir="-1" aria-label="Previous page"></button>`;
  if (hasLayout(book.endLayout)) {
    return laidOutPage("The end", book.endLayout, book, baseUrl, extras, " end-page").replace("<article", '<article data-source="end"');
  }
  const src = coverSrc(book, baseUrl);
  const character = characterSrc(book, baseUrl);
  const left = character
    ? `<div class="end-cover-wrap end-character-wrap"><img class="end-character" src="${character}" alt="" width="560" height="860"></div>`
    : (src ? `<div class="end-cover-wrap"><img class="end-cover" src="${src}" alt=""></div>` : "");
  return `<article class="page end-page" data-source="end" aria-label="The end">${left}<section class="end-meta"><h1 class="end-title">THE END</h1><button type="button" class="read-again">Read again</button></section>${legalHtml(credits,copyright,logoUrl,baseUrl)}<button class="zone" data-dir="-1" aria-label="Previous page"></button></article>`;
}

function titlePageHtml(book, baseUrl, libraryUrl) {
  const chrome = `<a class="reader-close" href="${esc(safeURL(libraryUrl,baseUrl))}" target="_top" aria-label="Close">×</a>${adminLoginHtml()}<button class="zone" data-dir="1" aria-label="Next page"></button>`;
  if (hasLayout(book.titleLayout)) {
    return laidOutPage("Title page", book.titleLayout, book, baseUrl, chrome, " title-page current").replace("<article", '<article data-source="title"');
  }
  const src = coverSrc(book, baseUrl);
  return `<article class="page title-page current" data-source="title" aria-label="Title page">${chrome}<div class="title-cover-wrap">${src?`<img class="title-cover" src="${src}" alt="">`:''}</div><section class="title-meta"><div class="title-top"><h1>${titleHtml(book.title)}</h1><div class="title-subs">${subtitleHtml(book.tagline)}</div></div><div class="title-bottom">${book.author?`<p class="title-author">${esc(book.author)}</p>`:''}${book.date?`<p class="title-date">${esc(book.date)}</p>`:''}</div><div id="hint" class="hint" role="status"><span class="hint-desktop">Tap left or right to turn the page</span><span class="hint-mobile">Swipe left to turn the page. Swipe right to go back</span></div></section></article>`;
}

/** Create an isolated document. Your app controls routing and the library destination. */
export function createReaderDocument(book,{libraryUrl='/',baseUrl=location.href,credits='',copyright='',logoUrl=''}={}) {
  if(!book.pages?.length)throw new Error('This book has no pages.');
  const palette=paletteById(book.color);
  const preload=coverSrc(book,baseUrl);
  const characterPreload=characterSrc(book,baseUrl);
  const storyPages=visibleStoryPages(book);
  const skipCover=storyPages.length !== (book.pages||[]).length;
  const paper=pageFill({background:book.pageBackground},book);
  const articles=titlePageHtml(book,baseUrl,libraryUrl)+storyPages.map((p,i)=>{
    const zones=`<button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="Next page"></button>`;
    if(hasLayout(p)) return laidOutPage(p.title||`Page ${i+1}`,p,book,baseUrl,zones);
    const coverOnly=!skipCover&&i===0;
    const fallback=p.kind==='facsimile'||coverOnly;
    const classes=`page${fallback?' facsimile':''}${coverOnly?' cover-plate':''}`;
    const focal=/^\d{1,3}% \d{1,3}%$/.test(p.focalPoint||'')?p.focalPoint:'50% 50%';
    const image=safeURL(coverOnly?(book.coverUrl||p.fullPageUrl||p.imageUrl):fallback?p.fullPageUrl||p.imageUrl:p.imageUrl,baseUrl);
    const text=fallback?'':`<section><p>${storyBody(p.paragraphs).map(esc).join(' ')}</p></section>`;
    return `<article class="${classes}" aria-label="${esc(p.title||`Page ${i+1}`)}" style="background:${pageFill(p,book)}"><img src="${esc(image)}" alt="${esc(p.alt||p.title)}" style="object-position:${focal}">${text}${zones}</article>`;
  }).join('')+endPageHtml(book,baseUrl,credits,copyright,logoUrl);
  return `<!doctype html><html lang="en" style="--title-bg:${palette.bg};--title-ink:${palette.text};--title-outline:${palette.accent};--page-paper:${paper}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light only"><title>${esc(book.title)}</title>${preload?`<link rel="preload" as="image" href="${preload}">`:''}${characterPreload?`<link rel="preload" as="image" href="${characterPreload}">`:''}<link rel="stylesheet" href="${esc(googleFontsHref(bookFontFamilies(book)))}"><style>${css}</style></head><body><div class="book-spine" aria-hidden="true"></div>${pageCurlHtml(baseUrl)}<main aria-label="${esc(book.title)}">${articles}</main><span id="count" class="sr" aria-live="polite"></span><script>${runtime}</script></body></html>`;
}
export function mountReader(container,book,options={}) {
  const frame=document.createElement('iframe');frame.title=book.title;frame.style.cssText='width:100%;height:100%;border:0;display:block';
  // Generated script is trusted application code; imported PDF text is HTML-escaped.
  frame.srcdoc=createReaderDocument(book,options);container.replaceChildren(frame);
  return {frame,destroy(){frame.remove();}};
}
