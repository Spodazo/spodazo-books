import css from './reader.css?raw';
import runtime from './reader-runtime.js?raw';
import {escapeHTML as esc, safeURL} from './layout.js';
/** Create an isolated document. Your app controls routing and the library destination. */
export function createReaderDocument(book,{libraryUrl='/',baseUrl=location.href}={}) {
  if(!book.pages?.length)throw new Error('This book has no pages.');
  const articles=book.pages.map((p,i)=>{
    const fallback=p.kind==='facsimile';
    const classes=`page${i===0?' current':''}${fallback?' facsimile':''}${p.position==='top'?' top-text':''}`;
    const focal=/^\d{1,3}% \d{1,3}%$/.test(p.focalPoint||'')?p.focalPoint:'50% 50%';
    const image=safeURL(fallback?p.fullPageUrl||p.imageUrl:p.imageUrl,baseUrl);
    const text=fallback?'':`<section><div class="eyebrow">${esc(book.title)}</div><h1>${esc(p.title)}</h1><p>${(p.paragraphs||[]).map(esc).join('<br>')}</p><span class="number">${i+1} / ${book.pages.length}</span></section>`;
    return `<article class="${classes}" aria-label="Page ${i+1}"><img src="${esc(image)}" alt="${esc(p.alt||p.title)}" style="object-position:${focal}">${text}${i?'<button class="zone" data-dir="-1" aria-label="Previous page"></button>':''}<button class="zone" data-dir="1" aria-label="${i===book.pages.length-1?'Read again':'Next page'}"></button></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light only"><title>${esc(book.title)}</title><style>${css}</style></head><body><a class="library-back" href="${esc(safeURL(libraryUrl,baseUrl))}" target="_top">← Library</a><main aria-label="${esc(book.title)}">${articles}</main><div id="hint" class="hint" role="status"><span class="hint-desktop">Tap left or right to turn the page</span><span class="hint-mobile">Swipe left to turn the page. Swipe right to go back</span></div><span id="count" class="sr" aria-live="polite"></span><script>${runtime}</script></body></html>`;
}
export function mountReader(container,book,options={}) {
  const frame=document.createElement('iframe');frame.title=book.title;frame.style.cssText='width:100%;height:100%;border:0;display:block';
  // Generated script is trusted application code; imported PDF text is HTML-escaped.
  frame.srcdoc=createReaderDocument(book,options);container.replaceChildren(frame);
  return {frame,destroy(){frame.remove();}};
}
