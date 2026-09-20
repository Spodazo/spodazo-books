import assert from "node:assert/strict";
import test from "node:test";
import { groupBooksByAudience, normalizeAudience, normalizeBookPage, parsePagesJson, slugify } from "./seed-data";

test("slugify drops punctuation", () => {
  assert.equal(slugify("Willow’s Big Forest Adventure"), "willows-big-forest-adventure");
});

test("parsePagesJson keeps story fields", () => {
  const pages = parsePagesJson(
    JSON.stringify([
      {
        id: "page-1",
        kind: "story",
        title: "Hello",
        paragraphs: ["One", "Two"],
        imageAsset: "art-001.jpg",
        fullPageAsset: "page-001.jpg",
        position: "top",
        focalPoint: "25% 50%",
      },
    ]),
  );
  assert.equal(pages[0].title, "Hello");
  assert.deepEqual(pages[0].paragraphs, ["One", "Two"]);
  assert.equal(pages[0].position, "top");
});

test("normalizeBookPage rejects unsafe focal points", () => {
  const page = normalizeBookPage({ focalPoint: "center" }, 0);
  assert.equal(page.focalPoint, "50% 50%");
});

test("normalizeAudience defaults missing values to children", () => {
  assert.equal(normalizeAudience(undefined), "children");
  assert.equal(normalizeAudience("adults"), "adults");
});

test("groupBooksByAudience splits the public library", () => {
  const grouped = groupBooksByAudience([
    { title: "Willow", audience: "children" },
    { title: "Memoir", audience: "adults" },
    { title: "Legacy" },
  ]);
  assert.deepEqual(grouped.children.map((book) => book.title), ["Willow", "Legacy"]);
  assert.deepEqual(grouped.adults.map((book) => book.title), ["Memoir"]);
});
