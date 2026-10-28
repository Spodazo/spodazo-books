import { homeCoverSrc } from "../shared/home-cover";
import { paletteById } from "../shared/palettes";
import type { BookListItem, PlayerSetup } from "../shared/types";
import { coverPixelSize } from "./media";

export function htmlWithPalette(html: string, paletteId?: string | null): string {
  const palette = paletteById(paletteId);
  const scheme = palette.id === "honey" ? "light" : "dark";
  let next = html.replace(/<html\b([^>]*)>/i, (full, attrs: string) => {
    if (/\bdata-palette=/.test(attrs)) return full;
    return `<html${attrs} data-palette="${palette.id}">`;
  });
  next = next.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="theme-color" content="${palette.bg}" />`,
  );
  if (!next.includes('id="palette-boot"')) {
    const boot = `<style id="palette-boot">html,body{background:${palette.bg};color:${palette.text};color-scheme:${scheme}}</style>`;
    next = next.replace("</head>", `    ${boot}\n  </head>`);
  }
  return next;
}

function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function htmlWithHomeBootstrap(
  html: string,
  payload: { setup: PlayerSetup; books: BookListItem[] },
): string {
  const urls = [...new Set(
    [...payload.books.map((book) => homeCoverSrc(book)), payload.setup.logoUrl || ""].filter(Boolean),
  )];
  const links = urls
    .map((href) => `<link rel="preload" as="image" href="${attr(href)}" fetchpriority="high" />`)
    .join("\n    ");
  const json = JSON.stringify({ setup: payload.setup, books: payload.books }).replace(/</g, "\\u003c");
  const block = `${links}\n    <script type="application/json" id="home-bootstrap">${json}</script>`;
  return html.replace("</head>", `    ${block}\n  </head>`);
}

export async function withCoverMetrics(books: BookListItem[]): Promise<BookListItem[]> {
  return Promise.all(books.map(async (book) => {
    const size = await coverPixelSize(homeCoverSrc(book));
    if (!size) return book;
    return { ...book, coverWidth: size.width, coverHeight: size.height };
  }));
}
