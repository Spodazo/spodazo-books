import assert from "node:assert/strict";
import test from "node:test";
import { groupBooksByAudience, normalizeAudience, normalizeBookPage, parsePagesJson, slugify, sortBooksByAdminOrder } from "./seed-data";

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
        links: [{ page: 4, label: "Be Thou My Vision", top: 31.5, left: 22, width: 56, height: 3.1 }],
      },
    ]),
  );
  assert.equal(pages[0].title, "Hello");
  assert.equal(pages[0].links?.[0]?.page, 4);
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

test("sortBooksByAdminOrder follows Admin sortOrder, not title or audience", () => {
  const sorted = sortBooksByAdminOrder([
    { title: "Willow", sortOrder: 3, audience: "children" },
    { title: "Be Thou My Vision", sortOrder: 1, audience: "adults" },
    { title: "Evening Songs", sortOrder: 2, audience: "children" },
  ]);
  assert.deepEqual(sorted.map((book) => book.title), ["Be Thou My Vision", "Evening Songs", "Willow"]);
});
