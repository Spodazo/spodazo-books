import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PAGE_BACKGROUND,
  defaultStoryElements,
  elementTextHtml,
  ensureBookLayouts,
  ensurePageElements,
  isLegacySingleLeafLayout,
  isOneLeafPdfPage,
  normalizeAlign,
  normalizeColor,
  decodeElementClipboard,
  duplicateElement,
  encodeElementClipboard,
  imageObjectFit,
  imageObjectPosition,
  normalizeElement,
  pageFill,
  panImageFocus,
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
  assert.equal(elements[0].fit, "cover");
  assert.ok((elements[1].x || 0) >= 50);
});

test("a facsimile PDF page fills one leaf without covering the spread", () => {
  const page = {
    id: "page-1",
    sourcePage: 1,
    kind: "facsimile",
    title: "Page 1",
    paragraphs: [],
    imageAsset: "page-001.jpg",
    fullPageAsset: "page-001.jpg",
    imageUrl: "/media/images/page-001.jpg",
    fullPageUrl: "/media/images/page-001.jpg",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [],
    background: "",
  } as BookPage;
  assert.equal(isOneLeafPdfPage(page), true);
  const elements = defaultStoryElements(page);
  assert.equal(elements[0].type, "image");
  assert.equal(elements[0].w, 100);
  assert.equal(elements[0].h, 100);
  assert.equal(elements[0].fit, "contain");
  assert.equal(elements.length, 1);
});

test("an imported full PDF page is treated as one leaf even if saved as story", () => {
  const page = {
    id: "page-2",
    sourcePage: 2,
    kind: "story",
    title: "Page 2",
    paragraphs: ["Words from the PDF"],
    imageAsset: "page-002.jpg",
    fullPageAsset: "page-002.jpg",
    imageUrl: "/media/images/page-002.jpg",
    fullPageUrl: "/media/images/page-002.jpg",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [
      { id: "page-2-art", type: "image", x: 0, y: 0, w: 100, h: 100, z: 1, imageAsset: "page-002.jpg" },
    ],
    background: "",
  } as BookPage;
  const next = ensurePageElements(page);
  assert.equal(next.kind, "facsimile");
  assert.equal(next.elements.length, 0);
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

test("a spread picture is kept across both leaves", () => {
  const page = {
    id: "page-1",
    sourcePage: 1,
    kind: "story",
    title: "Hello",
    paragraphs: ["The fox ran across the snow."],
    imageAsset: "fox.webp",
    fullPageAsset: "fox.webp",
    imageUrl: "/media/images/fox.webp",
    fullPageUrl: "/media/images/fox.webp",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [
      { id: "art", type: "image", x: 0, y: 0, w: 100, h: 100, z: 1, imageAsset: "fox.webp", fit: "contain" },
      { id: "words", type: "text", x: 20, y: 70, w: 60, h: 20, z: 2, text: "The fox ran across the snow.", role: "body", fontSize: 3.4 },
    ],
    background: "",
  } as BookPage;
  assert.equal(isLegacySingleLeafLayout(page.elements), false);
  const next = ensurePageElements(page);
  assert.equal(next.elements[0].w, 100);
  assert.equal(next.elements[0].fit, "contain");
  assert.equal(next.elements[1].x, 20);
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
    pageTexture: "",
    textFont: "",
    textColor: "",
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
  assert.equal(book.pageTexture, "");
  assert.equal(book.spreadBackground, "#bd9a61");
  assert.ok(book.titleLayout.elements.length >= 2);
  assert.ok(book.coverLayout.elements.some((item) => item.type === "image"));
  assert.ok(book.coverLayout.elements.some((item) => item.role === "title"));
  assert.ok(book.pages[0].elements.length >= 1);
  const titleEl = book.titleLayout.elements.find((item) => item.role === "title");
  if (titleEl) titleEl.text = "Night Walk";
  const synced = syncBookFromLayouts(book);
  assert.equal(synced.title, "Night Walk");
  const art = book.backCoverLayout.elements.find((item) => item.id === "back-art");
  assert.ok(art);
  assert.equal(art?.y, 40);
  assert.equal(art?.h, 20);
  assert.equal(art?.fit, "contain");
  const backTitle = book.backCoverLayout.elements.find((item) => item.id === "back-title");
  assert.equal(backTitle?.text, "Lantern Walk");
  assert.equal(backTitle?.w, 92);
  assert.equal(backTitle?.h, 4);
  assert.equal(book.backCoverLayout.elements.some((item) => item.role === "tagline" || item.id === "back-tagline"), false);
  const tidied = ensureBookLayouts({
    ...book,
    backCoverLayout: {
      elements: [
        { id: "back-art", type: "image", x: 20, y: 40, w: 60, h: 20, z: 1, imageAsset: "cover.webp", fit: "contain" },
        { id: "back-title", type: "text", x: 10, y: 62, w: 80, h: 6, z: 2, text: "Willow’s Big\nForest Adventure", role: "title" },
        { id: "back-tagline", type: "text", x: 12, y: 69, w: 76, h: 5, z: 3, text: "A quiet evening", role: "tagline" },
      ],
    },
  });
  assert.equal(tidied.backCoverLayout.elements.find((item) => item.id === "back-title")?.text, "Willow’s Big Forest Adventure");
  assert.equal(tidied.backCoverLayout.elements.some((item) => item.id === "back-tagline"), false);
  const designed = ensureBookLayouts({
    ...book,
    backCoverLayout: {
      background: "#fff8e4",
      elements: [{ id: "blurb", type: "text", x: 10, y: 40, w: 80, h: 20, z: 1, text: "About this book", role: "back" }],
    },
  });
  assert.equal(designed.backCoverLayout.elements[0]?.text, "About this book");
  assert.equal(designed.backCoverLayout.elements[0]?.align, "center");
  assert.equal(designed.backCoverLayout.background, "#fff8e4");
});

test("normalizeElement clamps size", () => {
  const el = normalizeElement({ type: "image", x: -10, w: 200 }, 0);
  assert.equal(el.x, 0);
  assert.equal(el.w, 100);
});

test("ensureBookLayouts restores missing end art", () => {
  const book = ensureBookLayouts({
    id: "book-1",
    slug: "Willows-Big-Forest-Adventure",
    title: "Willow’s Big Forest Adventure",
    tagline: "",
    author: "",
    date: "",
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
    pageTexture: "",
    textFont: "",
    textColor: "",
    titleLayout: { elements: [{ id: "title-title", type: "text", x: 52, y: 16, w: 42, h: 22, z: 2, text: "Willow", role: "title" }] },
    endLayout: { elements: [{ id: "end-art", type: "image", x: 6, y: 10, w: 42, h: 80, z: 1 }, { id: "end-title", type: "text", x: 52, y: 32, w: 42, h: 18, z: 2, text: "THE END", role: "end" }] },
    pages: [{
      id: "page-2",
      sourcePage: 2,
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
  } as Book, { coverUrl: "/media/images/cover.webp", characterUrl: "/media/images/willow-character.webp" });
  const art = book.endLayout.elements.find((item) => item.type === "image");
  assert.equal(art?.imageUrl, "/media/images/willow-character.webp");
});

test("elementTextHtml keeps paragraph and line breaks", () => {
  const html = elementTextHtml("One line\n\nTwo\nlines", (value) => value.replace(/</g, "&lt;"));
  assert.match(html, /<p>One line<\/p>/);
  assert.match(html, /<p>Two<br>lines<\/p>/);
});

test("normalizeAlign keeps a choice and defaults by role", () => {
  assert.equal(normalizeAlign("right", "body"), "right");
  assert.equal(normalizeAlign("", "title"), "center");
  assert.equal(normalizeAlign("", "body"), "left");
});

test("normalizeElement keeps a text frame and color", () => {
  const element = normalizeElement({ type: "text", text: "Hi", frame: "wave", frameColor: "#c4a35a" }, 0);
  assert.equal(element.frame, "wave");
  assert.equal(element.frameColor, "#c4a35a");
});

test("normalizeElement keeps a circle or rectangle", () => {
  assert.equal(normalizeElement({ type: "shape", shape: "circle", color: "#ffffff" }, 0).shape, "circle");
  assert.equal(normalizeElement({ type: "shape" }, 0).shape, "rectangle");
});

test("normalizeElement keeps a picture fade and defaults to solid", () => {
  assert.equal(normalizeElement({ type: "image", opacity: 40 }, 0).opacity, 40);
  assert.equal(normalizeElement({ type: "image" }, 0).opacity, 100);
});

test("normalizeElement keeps a picture crop and fills the frame by default", () => {
  const cropped = normalizeElement({ type: "image", fit: "cover", focusX: 120, focusY: -4 }, 0);
  assert.equal(cropped.fit, "cover");
  assert.equal(cropped.focusX, 100);
  assert.equal(cropped.focusY, 0);
  assert.equal(imageObjectFit(cropped), "cover");
  assert.equal(imageObjectPosition(cropped), "100% 0%");
  assert.equal(imageObjectFit({ fit: "contain" }), "contain");
  assert.equal(imageObjectPosition({}), "50% 50%");
});

test("panImageFocus slides the visible part of a filled picture", () => {
  const next = panImageFocus({ focusX: 50, focusY: 50, w: 50, h: 40 }, 25, -10);
  assert.equal(next.focusX, 0);
  assert.equal(next.focusY, 75);
});

test("clipboard round-trip copies an element and paste nudges it", () => {
  const source = normalizeElement({ id: "title", type: "text", text: "Rudolph", x: 10, y: 20, w: 30, h: 12, z: 2, role: "title" }, 0);
  const decoded = decodeElementClipboard(encodeElementClipboard(source));
  assert.equal(decoded?.text, "Rudolph");
  assert.equal(decoded?.role, "title");
  assert.equal(decodeElementClipboard("just words"), null);
  const copy = duplicateElement(source, 8, 3);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.text, "Rudolph");
  assert.equal(copy.x, 13);
  assert.equal(copy.y, 23);
  assert.equal(copy.z, 8);
});
