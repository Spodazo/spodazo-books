import assert from "node:assert/strict";
import test from "node:test";
import type { BookPage } from "@shared/types";
import { facsimileSpreadCount, storyPagesHtml } from "./story-pages-html";

function facsimilePage(n: number): BookPage {
  const asset = `page-${String(n).padStart(3, "0")}.jpg`;
  return {
    id: `page-${n}`,
    sourcePage: n,
    kind: "facsimile",
    title: `Page ${n}`,
    paragraphs: [],
    imageAsset: asset,
    fullPageAsset: asset,
    imageUrl: `/media/images/${asset}`,
    fullPageUrl: `/media/images/${asset}`,
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [],
    background: "",
  };
}

const stubDeps = {
  esc: (v: string) => v,
  safeURL: (url: string) => url,
  baseUrl: "https://books.example/",
  book: { coverUrl: "" },
  skipCover: true,
  oneLeaf: true,
  hasLayout: () => false,
  laidOutPage: () => "",
  pageFill: () => "#efdda6",
  storyBody: (p: string[]) => p,
};

test("facsimileSpreadCount pairs PDF pages two per spread", () => {
  const pages = [1, 2, 3, 4].map(facsimilePage);
  assert.equal(facsimileSpreadCount(pages, true), 2);
  assert.equal(facsimileSpreadCount(pages, false), 2);
  assert.equal(facsimileSpreadCount([facsimilePage(1)], true), 1);
  assert.equal(facsimileSpreadCount([facsimilePage(1)], false), 0);
});

test("storyPagesHtml puts page 1 on the left and page 2 on the right", () => {
  const pages = [1, 2, 3, 4].map(facsimilePage);
  const html = storyPagesHtml(pages, stubDeps);
  assert.equal((html.match(/pdf-spread/g) || []).length, 2);
  assert.match(html, /leaf-left"><img[^>]+page-001\.jpg/);
  assert.match(html, /leaf-right"><img[^>]+page-002\.jpg/);
  assert.match(html, /leaf-left"><img[^>]+page-003\.jpg/);
  assert.match(html, /leaf-right"><img[^>]+page-004\.jpg/);
});
