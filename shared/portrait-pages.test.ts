import assert from "node:assert/strict";
import test from "node:test";
import { ensureBookLayouts } from "./page-layout";
import { derivePortraitPages, portraitLeafBox, portraitPagesFor } from "./portrait-pages";
import type { Book, BookPage } from "./types";

function storyPage(partial: Partial<BookPage> = {}): BookPage {
  return {
    id: "page-1",
    sourcePage: 1,
    kind: "story",
    title: "One",
    paragraphs: ["The fox ran."],
    imageAsset: "fox.webp",
    fullPageAsset: "fox.webp",
    imageUrl: "",
    fullPageUrl: "",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [],
    background: "",
    ...partial,
  };
}

test("portraitLeafBox turns each half of a spread into its own page", () => {
  assert.deepEqual(portraitLeafBox({ x: 0, y: 0, w: 50, h: 100 }, "left"), { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(portraitLeafBox({ x: 0, y: 0, w: 50, h: 100 }, "right"), null);
  assert.deepEqual(portraitLeafBox({ x: 56, y: 18, w: 38, h: 64 }, "right")?.x, 12);
  assert.equal(portraitLeafBox({ x: 0, y: 0, w: 100, h: 100 }, "right"), null);
  assert.deepEqual(portraitLeafBox({ x: 0, y: 0, w: 100, h: 100 }, "left"), { x: 0, y: 0, w: 100, h: 100 });
});

test("derivePortraitPages lists cover then one portrait screen per flipbook spread", () => {
  const book = ensureBookLayouts({
    id: "book-1",
    slug: "lantern",
    title: "Lantern Walk",
    tagline: "",
    author: "",
    date: "",
    cover: "",
    pdf: "",
    color: "honey",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children",
    pageTemplate: "one-up",
    characterRender: "scene",
    pageBackground: "#efdda6",
    pageTexture: "",
    spreadBackground: "#bd9a61",
    textFont: "story",
    textColor: "#203b2a",
    titleLayout: { elements: [] },
    coverLayout: { elements: [] },
    backCoverLayout: { elements: [] },
    endLayout: { elements: [] },
    portraitPages: null,
    pages: [storyPage()],
  } as Book);
  const pages = derivePortraitPages(book);
  assert.equal(pages[0]?.portraitRole, "cover");
  const spreadPage = pages.find((page) => page.portraitRole === "spread");
  assert.ok(spreadPage);
  assert.ok((spreadPage?.elements.length || 0) > 0);
  assert.ok(spreadPage?.elements.some((item) => item.type === "text" && item.text === "The fox ran."));
});

test("portraitPagesFor ignores saved portrait overrides and uses flipbook layouts", () => {
  const book = ensureBookLayouts({
    id: "book-1",
    slug: "lantern",
    title: "Lantern Walk",
    tagline: "",
    author: "",
    date: "",
    cover: "",
    pdf: "",
    color: "honey",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children",
    pageTemplate: "one-up",
    characterRender: "scene",
    pageBackground: "#efdda6",
    pageTexture: "",
    spreadBackground: "#bd9a61",
    textFont: "story",
    textColor: "#203b2a",
    titleLayout: { elements: [] },
    coverLayout: { elements: [] },
    backCoverLayout: { elements: [] },
    endLayout: { elements: [] },
    portraitPages: [{
      elements: [{ id: "only", type: "text", x: 8, y: 10, w: 84, h: 20, z: 1, text: "Saved phone page" }],
      background: "",
    }],
    pages: [storyPage()],
  } as Book);
  const pages = portraitPagesFor(book);
  assert.ok(pages.length > 1);
  assert.ok(pages.some((page) => page.elements.some((item) => item.text === "The fox ran.")));
  assert.equal(pages.some((page) => page.elements.some((item) => item.text === "Saved phone page")), false);
});
