import assert from "node:assert/strict";
import test from "node:test";
import { homeCoverLayout, homeCoverSrc } from "./home-cover";
import type { BookListItem } from "./types";

function book(patch: Partial<BookListItem>): BookListItem {
  return {
    id: "1",
    slug: "sample",
    title: "Sample",
    tagline: "",
    author: "",
    date: "",
    cover: "cover.webp",
    coverUrl: "/media/images/cover.webp?v=1&w=720",
    pdfUrl: "",
    color: "navy",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children",
    pageCount: 1,
    pageBackground: "#022a58",
    pageTexture: "",
    spreadBackground: "#021b3f",
    textFont: "story",
    textColor: "#203b2a",
    coverLayout: { elements: [] },
    ...patch,
  };
}

test("Willow’s shelf uses the small front cover, not the full reader file", () => {
  const willow = book({
    slug: "willows-big-forest-adventure",
    title: "Willow",
    pdfUrl: "/media/pdfs/willow.pdf",
    pageBackground: "#fefcdd",
  });
  const src = homeCoverSrc(willow);
  assert.match(src, /willow-front-cover\.webp\?w=720$/);
  assert.equal(homeCoverLayout(willow).elements[0]?.imageUrl, src);
  assert.doesNotMatch(src, /Willow%20-%20Tiger|w=2400/);
});

test("other shelf covers keep the prepared card URL", () => {
  const src = homeCoverSrc(book({ pdfUrl: "/media/pdfs/rudolph.pdf" }));
  assert.equal(src, "/media/images/cover.webp?v=1&w=720");
});
