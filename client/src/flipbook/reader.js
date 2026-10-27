import css from './reader.css?raw';
import runtime from './reader-runtime.js?raw';
import {escapeHTML as esc, safeURL} from './layout.js';
import {DEFAULT_SPREAD_BACKGROUND, elementTextHtml, imageObjectFit, imageObjectPosition, isOneLeafPdfPage, normalizeColor, publishedLabel} from '@shared/page-layout';
import {normalizePaperTexture, paperTexture, paperTextureUrl} from '@shared/paper';
import {DEFAULT_FRAME_COLOR, frameClass, frameMarkup} from '@shared/text-frames';
import {fontStack, fontsUsed, googleFontsHref, localFontFaceCss} from '@shared/book-fonts';
import {paletteById} from '@shared/palettes';
import {characterUrlFor, isWillowBook, visibleStoryPages} from '@shared/reader-pages';
import {WILLOW_FRONT_COVER_URL, WILLOW_SONG_AUDIO_URL, WILLOW_SONG_END_CUE, WILLOW_SONG_TITLE_CUE, willowStoryPageCue} from '@shared/willow-song-book';
import {isImportedPdfFacsimileBook,storyPagesHtml as buildStoryPagesHtml} from './story-pages-html';

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

function elementFrameInk(el, book) {
  const value = String(el?.frameColor || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : elementInk(el, book) || DEFAULT_FRAME_COLOR;
}

function bookFontFamilies(book) {
  const ids = [book?.textFont];
  for (const layout of [book?.coverLayout, book?.backCoverLayout, book?.titleLayout, book?.endLayout, ...(book?.pages || [])]) {
    for (const el of layout?.elements || []) {
      if (el.fontFamily) ids.push(el.fontFamily);
    }
  }
  return fontsUsed(...ids);
}

function elementLeaf(el) {
  return (Number(el.x) || 0) + (Number(el.w) || 10) / 2 < 50 ? "left" : "right";
}

function elementSize(el) {
  if (el.id === "title-cover" || el.id === "end-art") return "main";
  return (Number(el.w) || 10) * (Number(el.h) || 10) >= 400 ? "main" : "small";
}

function elementHtml(el, baseUrl, book, extraMarkup = "") {
  const align = el.align === "center" || el.align === "right" ? el.align : "left";
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const font = fontStack(el.fontFamily || book?.textFont).replace(/"/g, "'");
  const stack = Number(el.z) || 1;
  const fade = el.type === "image" || el.type === "shape" ? `;opacity:${Math.min(100, Math.max(10, Number(el.opacity) || 100)) / 100}` : "";
  const style = `left:${Number(el.x) || 0}%;top:${Number(el.y) || 0}%;width:${Number(el.w) || 10}%;height:${Number(el.h) || 10}%;z-index:${stack}${fade};--fs:${Number(el.fontSize) || 4};--ff:${font};--ink:${elementInk(el, book)};--frame:${elementFrameInk(el, book)};--ta:${align};--tj:${justify};--fit:${imageObjectFit(el)};--focus:${imageObjectPosition(el)}`;
  const meta = `data-leaf="${elementLeaf(el)}" data-size="${elementSize(el)}"${el.role ? ` data-role="${esc(el.role)}"` : ""}${el.id ? ` data-id="${esc(el.id)}"` : ""}`;
  if (el.type === "shape") {
    const radius = el.shape === "circle" ? "border-radius:50%" : "border-radius:2%";
    return `<div class="el el-shape" style="${style};background:${elementInk(el, book)};${radius}" ${meta}></div>`;
  }
  if (el.type === "image") {
    const src = esc(safeURL(el.imageUrl || "", baseUrl));
    return src ? `<img class="el el-image" src="${src}" alt="" style="${style}" ${meta}>` : "";
  }
  const extra = frameClass(el.frame);
  const again = el.role === "end" ? `<button type="button" class="read-again">Read again</button>` : "";
  return `<div class="el el-text${extra ? ` ${extra}` : ""}" style="${style}" ${meta}>${frameMarkup(el.frame, (Number(el.w) || 10) / (Number(el.h) || 10))}${elementTextHtml(el.text || "", esc)}${again}${extraMarkup}</div>`;
}

function cueAttr(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "";
  return ` data-cue="${Number(seconds)}"`;
}

function laidOutPage(label, layout, book, baseUrl, extra = "", extraClass = "", taglineExtra = "", attrs = "") {
  const fill = pageFill(layout, book);
  const items = (layout.elements || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((el) => elementHtml(el, baseUrl, book, el.role === "tagline" ? taglineExtra : "")).join("");
  return `<article class="page laid-out${extraClass}" aria-label="${esc(label)}" style="background-color:${fill}"${attrs}>${items}${extra}</article>`;
}

function storyBody(paragraphs) {
  return (paragraphs || [])
    .map((line) => String(line).trim())
    .filter((line) => line && !/^\d+\s*\/\s*\d+$/.test(line));
}

function legalHtml(credits, copyright, logoUrl, baseUrl, date) {
  const credit = String(credits || "").trim();
  const copy = String(copyright || "").trim();
  const logo = logoUrl ? esc(safeURL(logoUrl, baseUrl)) : "";
  const published = publishedLabel(date);
  if (!credit && !copy && !logo && !published) return "";
  return `<footer class="end-legal">${logo?`<img class="end-logo" src="${logo}" alt="Spodazo Books">`:""}${published?`<p class="end-published">${esc(published)}</p>`:""}${credit?`<p class="end-credits">${esc(credit)}</p>`:""}${copy?`<p class="end-copyright">${esc(copy)}</p>`:""}</footer>`;
}

function characterSrc(book, baseUrl) {
  const url = characterUrlFor(book);
  return url ? esc(safeURL(url, baseUrl)) : "";
}

function willowNapHtml(book, baseUrl) {
  const nap = esc(safeURL("/media/images/willow-bear-nap.webp", baseUrl));
  const cue = cueAttr(WILLOW_SONG_END_CUE);
  return `<article class="page nap-spread" data-source="nap"${cue} aria-label="A cozy nap"><div class="nap-leaf nap-leaf-blank"><p class="nap-end">The End</p></div><div class="nap-leaf nap-leaf-art"><img class="nap-picture" src="${nap}" alt=""></div><button class="zone" data-dir="-1" aria-label="Previous page"></button><button class="zone" data-dir="1" aria-label="Next page"></button></article>`;
}

function coverBits(layout, book, baseUrl) {
  return (layout?.elements || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((el) => elementHtml(el, baseUrl, book).replaceAll('class="el el-', 'class="cover-bit cover-bit-')).join("");
}

/** One right-hand leaf for every book. Willow’s words “The End” stay on the nap spread. */
function backCoverPageHtml(book, baseUrl, credits, copyright, logoUrl) {
  const legal = legalHtml(credits, copyright, logoUrl, baseUrl, book.date);
  const again = `<button type="button" class="read-again">Read again</button>`;
  const zone = `<button class="zone" data-dir="-1" aria-label="Previous page"></button>`;
  let inner = "";
  let leafStyle = "";
  let plain = " back-cover-plain";
  if (isWillowBook(book)) {
    const src = esc(safeURL("/media/images/willow-back-cover.webp", baseUrl));
    inner = `<img class="back-cover-art" src="${src}" alt="">`;
    plain = "";
  } else if (hasLayout(book.backCoverLayout)) {
    leafStyle = ` style="background-color:${pageFill(book.backCoverLayout, book)}"`;
    inner = coverBits(book.backCoverLayout, book, baseUrl);
  } else {
    const src = coverSrc(book, baseUrl);
    inner = src ? `<img class="back-cover-art" src="${src}" alt="">` : "";
  }
  return `<article class="page end-page back-cover${plain}" data-source="end" aria-label="Back cover"><div class="back-cover-leaf"${leafStyle}>${inner}${again}${legal}</div>${zone}</article>`;
}

function endPageHtml(book, baseUrl, credits, copyright, logoUrl) {
  if (isWillowBook(book)) return willowNapHtml(book, baseUrl);
  const extras = `${legalHtml(credits,copyright,logoUrl,baseUrl,book.date)}<button class="zone" data-dir="-1" aria-label="Previous page"></button>`;
  if (hasLayout(book.endLayout)) {
    return laidOutPage("The end", book.endLayout, book, baseUrl, extras, " end-page", "").replace("<article", '<article data-source="end"');
  }
  const src = coverSrc(book, baseUrl);
  const character = characterSrc(book, baseUrl);
  const left = character
    ? `<div class="end-cover-wrap end-character-wrap"><img class="end-character" src="${character}" alt="" width="560" height="860"></div>`
    : (src ? `<div class="end-cover-wrap"><img class="end-cover" src="${src}" alt=""></div>` : "");
  return `<article class="page end-page" data-source="end" aria-label="The end">${left}<section class="end-meta"><h1 class="end-title">THE END</h1><button type="button" class="read-again">Read again</button></section>${legalHtml(credits,copyright,logoUrl,baseUrl,book.date)}<button class="zone" data-dir="-1" aria-label="Previous page"></button></article>`;
}

function separatedTitleCredits(layout) {
  const elements = (layout?.elements || []).map((el) => ({ ...el }));
  const author = elements.find((el) => el.role === "author" || el.id === "title-author");
  const date = elements.find((el) => el.role === "date" || el.id === "title-date");
  if (author) {
    if (!author.role) author.role = "author";
    author.x = 54;
    author.w = 42;
    author.y = 78;
    author.h = 8;
  }
  if (date) {
    if (!date.role) date.role = "date";
    date.x = 54;
    date.w = 42;
    date.y = 88;
    date.h = 7;
  }
  return { ...(layout || {}), elements };
}

function readerChrome(libraryUrl, baseUrl, {back=true, next=true, hint=true, hintDesktop="Tap the right page to turn", hintMobile="Swipe left to turn the page"}={}) {
  const hintHtml = hint ? `<div id="hint" class="hint" role="status"><span class="hint-desktop">${esc(hintDesktop)}</span><span class="hint-mobile">${esc(hintMobile)}</span></div>` : "";
  const zones = `${back?`<button class="zone" data-dir="-1" aria-label="Previous page"></button>`:""}${next?`<button class="zone" data-dir="1" aria-label="Next page"></button>`:""}`;
  return `${hintHtml}${zones}`;
}

function frontCoverHtml(book, baseUrl, libraryUrl) {
  const chrome = readerChrome(libraryUrl, baseUrl, {back:false, hintDesktop:"Tap the cover to open", hintMobile:"Swipe to open"});
  if (isWillowBook(book)) {
    const src = esc(safeURL(WILLOW_FRONT_COVER_URL, baseUrl));
    return `<article class="page front-cover willow-front current" data-source="cover" aria-label="Cover">${chrome}<div class="front-cover-leaf"><img class="front-cover-art" src="${src}" alt=""></div></article>`;
  }
  if (!hasLayout(book.coverLayout)) return "";
  const layout = book.coverLayout;
  const fill = pageFill(layout, book);
  const items = (layout.elements || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((el) => elementHtml(el, baseUrl, book).replaceAll('class="el el-', 'class="cover-bit cover-bit-')).join("");
  return `<article class="page front-cover current" data-source="cover" aria-label="Cover">${chrome}<div class="front-cover-leaf" style="background-color:${fill}">${items}</div></article>`;
}

function singAlongHtml(book, baseUrl) {
  if (!isWillowBook(book)) return "";
  const src = esc(safeURL(WILLOW_SONG_AUDIO_URL, baseUrl));
  return `<button type="button" class="sing-along" data-audio="${src}" aria-pressed="false">Sing Along</button>`;
}

function titlePageHtml(book, baseUrl, libraryUrl, isCurrent) {
  const chrome = readerChrome(libraryUrl, baseUrl, {hint: isCurrent});
  const current = isCurrent ? " current" : "";
  const sing = singAlongHtml(book, baseUrl);
  const willowTitle = isWillowBook(book) ? " willow-title" : "";
  if (hasLayout(book.titleLayout)) {
    const layout = isWillowBook(book) ? separatedTitleCredits(book.titleLayout) : book.titleLayout;
    return laidOutPage("Title page", layout, book, baseUrl, chrome, ` title-page${current}${willowTitle}`, sing, isWillowBook(book) ? cueAttr(WILLOW_SONG_TITLE_CUE) : "").replace("<article", '<article data-source="title"');
  }
  const src = coverSrc(book, baseUrl);
  return `<article class="page title-page${current}${willowTitle}" data-source="title"${isWillowBook(book)?cueAttr(WILLOW_SONG_TITLE_CUE):""} aria-label="Title page">${chrome}<div class="title-cover-wrap">${src?`<img class="title-cover" src="${src}" alt="">`:''}</div><section class="title-meta"><div class="title-top"><h1>${titleHtml(book.title)}</h1><div class="title-subs">${subtitleHtml(book.tagline)}</div>${sing}</div><div class="title-bottom">${book.author?`<p class="title-author">${esc(book.author)}</p>`:''}${book.date?`<p class="title-date">${esc(book.date)}</p>`:''}</div></section></article>`;
}

/** Create an isolated document. Your app controls routing and the library destination. */
export function createReaderDocument(book,{libraryUrl='/',baseUrl=location.href,credits='',copyright='',logoUrl='',fadeOpen=false}={}) {
  if(!book.pages?.length)throw new Error('This book has no pages.');
  const palette=paletteById(book.color);
  const preload=isWillowBook(book)?esc(safeURL(WILLOW_FRONT_COVER_URL,baseUrl)):coverSrc(book,baseUrl);
  const characterPreload=characterSrc(book,baseUrl);
  const storyPages=visibleStoryPages(book);
  const skipCover=storyPages.length !== (book.pages||[]).length;
  const paper=pageFill({background:book.pageBackground},book);
  const spread=normalizeColor(book.spreadBackground, DEFAULT_SPREAD_BACKGROUND);
  const texture=normalizePaperTexture(book.pageTexture);
  const textureMeta=paperTexture(texture);
  const textureUrl=textureMeta?esc(safeURL(paperTextureUrl(textureMeta.id),baseUrl)):'';
  const edgeUrl=textureMeta?.id==='deckle'?esc(safeURL('/paper/deckle-edge.png',baseUrl)):'';
  const paperAttr=texture?` data-paper="${texture}"`:'';
  const paperStyle=textureUrl?`;--paper-texture:url('${textureUrl}');--paper-w:${textureMeta.w}px;--paper-h:${textureMeta.h}px${edgeUrl?`;--paper-edge:url('${edgeUrl}')`:''}`:'';
  const oneLeaf=book.pageTemplate==='one-up';
  const pdfFacsimile=isImportedPdfFacsimileBook(book,storyPages);
  const cover=frontCoverHtml(book,baseUrl,libraryUrl);
  const storyDeps={esc,safeURL,baseUrl,book,skipCover,oneLeaf,hasLayout,laidOutPage:(label,layout,zones,i)=>laidOutPage(label,layout,book,baseUrl,zones,"","", isWillowBook(book)?cueAttr(willowStoryPageCue(i)):""),pageFill,storyBody};
  const titleBlock=pdfFacsimile?'':titlePageHtml(book,baseUrl,libraryUrl,!cover);
  const endBlock=pdfFacsimile?'':endPageHtml(book,baseUrl,credits,copyright,logoUrl)+backCoverPageHtml(book,baseUrl,credits,copyright,logoUrl);
  const articles=cover+titleBlock+buildStoryPagesHtml(storyPages,storyDeps)+endBlock;
  const bootMobile=`(function(){try{var m=matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1100px)').matches&&matchMedia('(orientation:portrait)').matches;var root=document.documentElement;root.classList.toggle('mobile',m);if(!m&&${cover?'true':'false'})root.classList.add('closed-book');}catch(e){}})();`;
  const openAttr=fadeOpen?' data-fade-open="1"':'';
  const templateAttr=oneLeaf?' data-page-template="one-up"':'';
  const htmlClass=` class="${fadeOpen?"opening":"booting"}${isWillowBook(book)?" willow":""}"`;
  const faces=localFontFaceCss((href)=>safeURL(href,baseUrl));
  return `<!doctype html><html${htmlClass}${paperAttr} lang="en" style="--title-bg:${palette.bg};--title-ink:${palette.text};--title-outline:${palette.accent};--page-paper:${paper};--spread:${spread}${paperStyle}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light only"><title>${esc(book.title)}</title><script>${bootMobile}</script>${preload?`<link rel="preload" as="image" href="${preload}">`:''}${characterPreload?`<link rel="preload" as="image" href="${characterPreload}">`:''}<link rel="stylesheet" href="${esc(googleFontsHref(bookFontFamilies(book)))}"><style>${faces}${css}</style></head><body><a class="reader-close viewport-close" href="${esc(safeURL(libraryUrl,baseUrl))}" target="_top" aria-label="Close">×</a><div class="book-spine" aria-hidden="true"></div>${pageCurlHtml(baseUrl)}<main${openAttr}${templateAttr} aria-label="${esc(book.title)}">${articles}</main><span id="count" class="sr" aria-live="polite"></span><script>${runtime}</script></body></html>`;
}
export function mountReader(container,book,options={}) {
  const frame=document.createElement('iframe');frame.title=book.title;frame.style.cssText='width:100%;height:100%;border:0;display:block';
  // Generated script is trusted application code; imported PDF text is HTML-escaped.
  frame.srcdoc=createReaderDocument(book,options);container.replaceChildren(frame);
  return {frame,destroy(){frame.remove();}};
}
