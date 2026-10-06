import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPdfIndexLinks,
  facsimilePageLinks,
  groupPdfLines,
  normalizeIndexTitle,
} from "./pdf-index-links";

function item(text: string, x: number, y: number, size = 14): { text: string; x: number; y: number; size: number } {
  return { text, x, y, size };
}

test("normalizeIndexTitle drops leading song numbers", () => {
  assert.equal(normalizeIndexTitle("01 Be Thou My Vision"), "be thou my vision");
  assert.equal(normalizeIndexTitle("2. River Hymn"), "river hymn");
});

test("groupPdfLines joins split words on one baseline", () => {
  const lines = groupPdfLines([
    item("Be", 80, 200),
    item("Thou", 110, 201),
    item("My Vision", 160, 199),
    item("House of Many Mansions", 80, 240),
  ]);
  assert.equal(lines[0].text, "Be Thou My Vision");
  assert.equal(lines[1].text, "House of Many Mansions");
});

test("detectPdfIndexLinks maps a numbered song list to later pages", () => {
  const pages = [
    { sourcePage: 1, width: 595, height: 842, items: [item("Songbook", 80, 80, 28)] },
    {
      sourcePage: 2,
      width: 595,
      height: 842,
      items: [
        item("Contents", 80, 80, 24),
        item("01 Be Thou My Vision", 90, 200),
        item("02 House of Many Mansions", 90, 230),
        item("03 Horsemen's Praise", 90, 260),
      ],
    },
    { sourcePage: 3, width: 595, height: 842, items: [item("Forward", 80, 80)] },
    { sourcePage: 4, width: 595, height: 842, items: [item("01 Be Thou My Vision", 80, 80, 22), item("Verse 1", 80, 140)] },
    { sourcePage: 5, width: 595, height: 842, items: [item("02 House of Many Mansions", 80, 80, 22)] },
    { sourcePage: 6, width: 595, height: 842, items: [item("03 Horsemen's Praise", 80, 80, 22)] },
  ];
  const found = detectPdfIndexLinks(pages, "Be Thou My Vision");
  const links = found.get(2) || [];
  assert.equal(links.length, 3);
  assert.equal(links[0].page, 4);
  assert.equal(links[1].page, 5);
  assert.equal(links[2].page, 6);
  assert.match(links[0].label, /Be Thou My Vision/);
  assert.ok(links[0].top > 15 && links[0].top < 35);
});

test("detectPdfIndexLinks uses dotted page numbers and PDF link annotations", () => {
  const dotted = detectPdfIndexLinks([
    { sourcePage: 1, width: 595, height: 842, items: [item("Cover", 80, 80)] },
    {
      sourcePage: 2,
      width: 595,
      height: 842,
      items: [
        item("Index", 80, 70, 22),
        item("First Light ........ 3", 90, 180),
        item("River Hymn ........ 4", 90, 220),
      ],
    },
    { sourcePage: 3, width: 595, height: 842, items: [item("First Light", 80, 80)] },
    { sourcePage: 4, width: 595, height: 842, items: [item("River Hymn", 80, 80)] },
  ]);
  assert.deepEqual((dotted.get(2) || []).map((link) => link.page), [3, 4]);

  const annotated = detectPdfIndexLinks([
    { sourcePage: 1, width: 595, height: 842, items: [] },
    {
      sourcePage: 2,
      width: 595,
      height: 842,
      items: [item("Songs", 80, 80)],
      annotations: [
        { destPage: 4, left: 20, top: 30, width: 50, height: 3, label: "One" },
        { destPage: 6, left: 20, top: 36, width: 50, height: 3, label: "Two" },
      ],
    },
  ]);
  assert.deepEqual((annotated.get(2) || []).map((link) => link.page), [4, 6]);
});

test("facsimilePageLinks groups stored page taps by source page", () => {
  const map = facsimilePageLinks([
    { sourcePage: 1, links: [] },
    {
      sourcePage: 2,
      links: [
        { page: 4, label: "One", top: 30, left: 20, width: 50, height: 3 },
        { page: 6, label: "Two", top: 36, left: 20, width: 50, height: 3 },
      ],
    },
  ]);
  assert.equal(map["2"].length, 2);
  assert.equal(map["2"][0].page, 4);
});
