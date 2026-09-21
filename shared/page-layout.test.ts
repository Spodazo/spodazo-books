import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PAGE_BACKGROUND,
  defaultStoryElements,
  ensureBookLayouts,
  ensurePageElements,
  isLegacySingleLeafLayout,
  normalizeColor,
  normalizeElement,
  pageFill,
  syncBookFromLayouts,
} from "./page-layout";
import type { Book, BookPage } from "./types";

test("normalizeColor accepts hex and falls back", () => {
  assert.equal(normalizeColor("#abc", DEFAULT_PAGE_BACKGROUND), "#aabbcc");
  assert.equal(normalizeColor("red", DEFAULT_PAGE_BACKGROUND), DEFAULT_PAGE_BACKGROUND);
  assert.equal(normalizeColor("", ""), "");
});

test("pageFill uses the page override then the book default", () => {
  assert.equal(pageFill("#112233", "#efdda6"), "#112233");
  assert.equal(pageFill("", "#445566"), "#445566");
  assert.equal(pageFill("", ""), DEFAULT_PAGE_BACKGROUND);
});

test("defaultStoryElements places art and wording", () => {
  const page = {
    id: "page-1",
    sourcePage: 1,
    kind: "story",
    title: "Hello",
    paragraphs: ["The fox ran."],
    imageAsset: "fox.webp",
    fullPageAsset: "fox.webp",
    imageUrl: "/media/images/fox.webp",
    fullPageUrl: "/media/images/fox.webp",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [],
    background: "",
  } as BookPage;
  const elements = defaultStoryElements(page);
  assert.equal(elements[0].type, "image");
  assert.equal(elements[1].type, "text");
  assert.equal(elements[1].text, "The fox ran.");
  assert.equal(elements[0].w, 50);
  assert.ok((elements[1].x || 0) >= 50);
});

test("legacy full-page layouts become a two-leaf spread", () => {
  const page = {
    id: "page-1",
    sourcePage: 1,
    kind: "story",
    title: "Hello",
    paragraphs: ["Old wording"],
    imageAsset: "fox.webp",
    fullPageAsset: "fox.webp",
    imageUrl: "/media/images/fox.webp",
    fullPageUrl: "/media/images/fox.webp",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [
      { id: "page-1-art", type: "image", x: 0, y: 0, w: 100, h: 100, z: 1, imageAsset: "fox.webp", imageUrl: "/media/images/fox.webp" },
      { id: "page-1-text", type: "text", x: 6, y: 68, w: 88, h: 26, z: 2, text: "Edited wording", role: "body", fontSize: 3.4 },
    ],
    background: "",
  } as BookPage;
  assert.equal(isLegacySingleLeafLayout(page.elements), true);
  const next = ensurePageElements(page);
  assert.equal(next.elements[0].w, 50);
  assert.equal(next.elements[1].x, 56);
  assert.equal(next.elements[1].text, "Edited wording");
});

test("legacy text-only pages move wording onto the right leaf", () => {
  const page = {
    id: "page-2",
    sourcePage: 2,
    kind: "story",
    title: "Hello",
    paragraphs: ["A lantern glowed under the trees."],
    imageAsset: "",
    fullPageAsset: "",
    imageUrl: "",
    fullPageUrl: "",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [
      { id: "page-2-text", type: "text", x: 6, y: 68, w: 88, h: 26, z: 2, text: "A lantern glowed under the trees.", role: "body", fontSize: 3.4 },
    ],
    background: "",
  } as BookPage;
  const next = ensurePageElements(page);
  assert.equal(next.elements[0].x, 56);
  assert.equal(next.elements[0].w, 38);
});

test("ensureBookLayouts and sync keep title text and cover", () => {
  const book = ensureBookLayouts({
    id: "book-1",
    slug: "lantern",
    title: "Lantern Walk",
    tagline: "A quiet evening",
    author: "Nia",
    date: "2026",
    cover: "cover.webp",
    pdf: "",
    color: "honey",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children",
    pageTemplate: "one-up",
    characterRender: "scene",
    pageBackground: "",
    titleLayout: { elements: [] },
    endLayout: { elements: [] },
    pages: [{
      id: "page-1",
      sourcePage: 1,
      kind: "story",
      title: "One",
      paragraphs: ["Hello"],
      imageAsset: "one.webp",
      fullPageAsset: "one.webp",
      imageUrl: "",
      fullPageUrl: "",
      position: "bottom",
      focalPoint: "50% 50%",
      elements: [],
      background: "",
    }],
  } as Book, { coverUrl: "/media/images/cover.webp" });
  assert.ok(book.titleLayout.elements.length >= 2);
  assert.ok(book.pages[0].elements.length >= 1);
  const titleEl = book.titleLayout.elements.find((item) => item.role === "title");
  if (titleEl) titleEl.text = "Night Walk";
  const synced = syncBookFromLayouts(book);
  assert.equal(synced.title, "Night Walk");
});

test("normalizeElement clamps size", () => {
  const el = normalizeElement({ type: "image", x: -10, w: 200 }, 0);
  assert.equal(el.x, 0);
  assert.equal(el.w, 100);
});
