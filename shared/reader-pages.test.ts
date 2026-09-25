import assert from "node:assert/strict";
import test from "node:test";
import { characterUrlFor, isDuplicateTitlePage, visibleStoryPages } from "./reader-pages";
import type { BookPage } from "./types";

function page(partial: Partial<BookPage> & { id: string }): BookPage {
  return {
    sourcePage: 1,
    kind: "story",
    title: "",
    paragraphs: [],
    imageAsset: "",
    fullPageAsset: "",
    imageUrl: "",
    fullPageUrl: "",
    position: "bottom",
    focalPoint: "50% 50%",
    elements: [],
    background: "",
    ...partial,
  };
}

test("Willow skips the imported title page", () => {
  const book = {
    title: "Willow’s Big Forest Adventure",
    slug: "Willows-Big-Forest-Adventure",
    pages: [
      page({ id: "page-1", title: "WILLOW’S FOREST ADVENTURE", paragraphs: ["Willow’s Big Forest Adventure"] }),
      page({ id: "page-2", title: "One Little Butterfly", paragraphs: ["Willow spotted a butterfly."] }),
    ],
  };
  assert.equal(isDuplicateTitlePage(book, book.pages[0], 0), true);
  assert.deepEqual(visibleStoryPages(book).map((item) => item.id), ["page-2"]);
});

test("other books keep a first page that is real story", () => {
  const book = {
    title: "Lantern Walk",
    slug: "lantern-walk",
    pages: [page({ id: "page-1", paragraphs: ["The fox ran into the trees."] })],
  };
  assert.equal(isDuplicateTitlePage(book, book.pages[0], 0), false);
  assert.equal(visibleStoryPages(book).length, 1);
});

test("Rudolph uses the bundled character on the end page", () => {
  assert.equal(
    characterUrlFor({ slug: "Rudolph-The-Red-Nosed-Reindeer", title: "Rudolph" }),
    "/media/images/rudolph-character.webp",
  );
});
