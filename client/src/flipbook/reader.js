import css from './reader.css?raw';
import runtime from './reader-runtime.js?raw';
import {escapeHTML as esc, safeURL} from './layout.js';
import {paletteById} from '@shared/palettes';

function coverSrc(book, baseUrl) {
  const cover = book.coverUrl || book.pages?.[0]?.imageUrl || book.pages?.[0]?.fullPageUrl || '';
  return cover ? esc(safeURL(cover, baseUrl)) : '';
}

function subtitleHtml(tagline) {
  return String(tagline || "")
    .split(/\./)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="title-sub">${esc(line)}</p>`)
    .join("");
}

function storyBody(paragraphs) {
  return (paragraphs || [])
    .map((line) => String(line).trim())
    .filter((line) => line && !/^\d+\s*\/\s*\d+$/.test(line));
}

function isWillow(book) {
  return /willow/i.test(String(book.slug || "")) || /willow/i.test(String(book.title || ""));
}

function titlePageHtml(book, baseUrl, libraryUrl) {
  const src = coverSrc(book, baseUrl);
  return `<article class="page title-page current" data-source="title" aria-label="Title page"><a class="reader-close" href="${esc(safeURL(libraryUrl,baseUrl))}" target="_top" aria-label="Close">×</a><div class="title-cover-wrap">${src?`<img class="title-cover" src="${src}" alt="">`:''}</div><section class="title-meta"><div class="title-top"><h1>${esc(book.title||'')}</h1>${subtitleHtml(book.tagline)}</div><div class="title-bottom">${book.author?`<p class="title-author">${esc(book.author)}</p>`:''}${book.date?`<p class="title-date">${esc(book.date)}</p>`:''}</div></section><button class="zone" data-dir="1" aria-label="Next page"></button></article>`;
}

/** Create an isolated document. Your app controls routing and the library destination. */
export function createReaderDocument(book,{libraryUrl='/',baseUrl=location.href}={}) {
  if(!book.pages?.length)throw new Error('This book has no pages.');
  const palette=paletteById(book.color);
  const preload=coverSrc(book,baseUrl);
  const skipCover=isWillow(book);
  const storyPages=skipCover?book.pages.slice(1):book.pages;
  const articles=titlePageHtml(book,baseUrl,libraryUrl)+storyPages.map((p,i)=>{
    const coverOnly=!skipCover&&i===0;
    const fallback=p.kind==='facsimile'||coverOnly;
    const classes=`page${fallback?' facsimile':''}${coverOnly?' cover-plate':''}`;
    const focal=/^\d{1,3}% \d{1,3}%$/.test(p.focalPoint||'')?p.focalPoint:'50% 50%';
    const image=safeURL(coverOnly?(book.coverUrl||p.fullPageUrl||p.imageUrl):fallback?p.fullPageUrl||p.imageUrl:p.imageUrl,baseUrl);
    const text=fallback?'':`<section><p>${storyBody(p.paragraphs).map(esc).join(' ')}</p></section>`;
    return `<article class="${classes}" aria-label="Page ${i+1}"><img src="${esc(image)}" alt="${esc(p.alt||p.title)}" style="object-position:${focal}">${text}<button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="${i===storyPages.length-1?'Read again':'Next page'}"></button></article>`;
  }).join('');
  return `<!doctype html><html lang="en" style="--title-bg:${palette.bg};--title-ink:${palette.text};--title-outline:${palette.accent}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light only"><title>${esc(book.title)}</title>${preload?`<link rel="preload" as="image" href="${preload}">`:''}<style>${css}</style></head><body><main aria-label="${esc(book.title)}">${articles}</main><div id="hint" class="hint" role="status"><span class="hint-desktop">Tap left or right to turn the page</span><span class="hint-mobile">Swipe left to turn the page. Swipe right to go back</span></div><span id="count" class="sr" aria-live="polite"></span><script>${runtime}</script></body></html>`;
}
export function mountReader(container,book,options={}) {
  const frame=document.createElement('iframe');frame.title=book.title;frame.style.cssText='width:100%;height:100%;border:0;display:block';
  // Generated script is trusted application code; imported PDF text is HTML-escaped.
  frame.srcdoc=createReaderDocument(book,options);container.replaceChildren(frame);
  return {frame,destroy(){frame.remove();}};
}
