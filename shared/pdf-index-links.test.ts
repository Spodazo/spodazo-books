import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPdfIndexLinks,
  facsimilePageLinks,
  groupPdfLines,
  lineBoxTopPercent,
  matchSongListToPages,
  normalizeIndexTitle,
  realignIndexLinks,
  realignIndexLinksByOrder,
  retargetStoredIndexLinks,
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
  const glyphTop = lineBoxTopPercent({ y: 200, size: 14 }, 842);
  assert.ok(Math.abs(links[0].top - glyphTop) < 0.4);
  assert.ok(links[0].top < ((200 - 14 * 0.35) / 842) * 100);
});

test("detectPdfIndexLinks keeps similar titles and ignores printed page numbers", () => {
  const pages = [
    { sourcePage: 1, width: 595, height: 842, items: [item("Songbook", 80, 80, 28)] },
    {
      sourcePage: 2,
      width: 595,
      height: 842,
      items: [
        item("Contents", 80, 80, 24),
        item("01 First Light", 90, 200),
        item("03 Horsemen's Praise", 90, 230),
        item("05 Garment of Praise", 90, 260),
        item("10 All is Well ........ 1", 90, 290),
      ],
    },
    {
      sourcePage: 3,
      width: 595,
      height: 842,
      items: [item("01 First Light", 80, 80, 22), item("and all is well tonight", 80, 140)],
    },
    { sourcePage: 6, width: 595, height: 842, items: [item("03 Horsemen's Praise", 80, 80, 22)] },
    { sourcePage: 8, width: 595, height: 842, items: [item("05 Garment of Praise", 80, 80, 22)] },
    { sourcePage: 12, width: 595, height: 842, items: [item("10 All is Well", 80, 80, 22)] },
  ];
  const links = detectPdfIndexLinks(pages, "Evening Songs").get(2) || [];
  assert.deepEqual(links.map((link) => link.page), [3, 6, 8, 12]);
});

test("detectPdfIndexLinks uses text-line boxes even when annotation rects sit low", () => {
  const pages = [
    { sourcePage: 1, width: 595, height: 842, items: [item("Cover", 80, 80)] },
    {
      sourcePage: 2,
      width: 595,
      height: 842,
      items: [
        item("Songs", 80, 80, 22),
        item("01 First Light", 90, 200),
        item("02 River Hymn", 90, 240),
      ],
      annotations: [
        { destPage: 4, left: 20, top: 25.5, width: 50, height: 1.6, label: "One" },
        { destPage: 5, left: 20, top: 30.2, width: 50, height: 1.6, label: "Two" },
      ],
    },
    { sourcePage: 4, width: 595, height: 842, items: [item("01 First Light", 80, 80, 22)] },
    { sourcePage: 5, width: 595, height: 842, items: [item("02 River Hymn", 80, 80, 22)] },
  ];
  const links = detectPdfIndexLinks(pages).get(2) || [];
  const glyphTop = lineBoxTopPercent({ y: 200, size: 14 }, 842);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((link) => link.page), [4, 5]);
  assert.ok(Math.abs(links[0].top - glyphTop) < 0.4);
  assert.ok(links[0].top < 25);
});

test("retargetStoredIndexLinks fixes a tap that pointed at the wrong titled page", () => {
  const pages = retargetStoredIndexLinks([
    { sourcePage: 1, title: "Cover", links: [] },
    {
      sourcePage: 2,
      title: "Contents",
      links: [
        { page: 3, label: "01 First Light", top: 20, left: 12, width: 50, height: 4 },
        { page: 3, label: "02 River Hymn", top: 25, left: 12, width: 50, height: 4 },
      ],
    },
    { sourcePage: 3, title: "01 First Light" },
    { sourcePage: 4, title: "02 River Hymn" },
  ]);
  assert.deepEqual((pages[1].links || []).map((link) => link.page), [3, 4]);
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

  const retargeted = facsimilePageLinks([
    { sourcePage: 1, title: "Cover" },
    {
      sourcePage: 2,
      title: "Contents",
      links: [
        { page: 3, label: "01 First Light", top: 20, left: 12, width: 50, height: 4 },
        { page: 3, label: "02 River Hymn", top: 25, left: 12, width: 50, height: 4 },
      ],
    },
    { sourcePage: 3, title: "01 First Light" },
    { sourcePage: 4, title: "02 River Hymn" },
  ]);
  assert.deepEqual(retargeted["2"].map((link) => link.page), [3, 4]);

  const numbered = facsimilePageLinks([
    { sourcePage: 1, title: "Page 1" },
    {
      sourcePage: 2,
      title: "Page 2",
      links: [
        { page: 4, label: "Page 4", top: 30, left: 9, width: 80, height: 4.2 },
        { page: 6, label: "Page 6", top: 34, left: 9, width: 80, height: 4.2 },
      ],
    },
    { sourcePage: 3, title: "Page 3" },
    { sourcePage: 4, title: "Echoes of the Storm" },
    { sourcePage: 5, title: "Page 5" },
    { sourcePage: 6, title: "Though He Slay Me" },
  ]);
  assert.deepEqual(numbered["2"].map((link) => link.page), [4, 6]);
});

test("song list rows open the album tracks in catalog order", () => {
  const lines = [
    { text: "01 Echoes of the Storm", top: 30.52 },
    { text: "02 Though He Slay Me", top: 33.57 },
    { text: "03 By Waters Deep and Still", top: 36.9 },
    { text: "04 Under His Wings", top: 39.96 },
    { text: "05 A Promise Broken", top: 43.31 },
    { text: "06 Clean Once Again", top: 46.5 },
    { text: "07 Armor of God", top: 49.56 },
    { text: "08 Restored", top: 53.05 },
    { text: "09 Our Light", top: 55.94 },
    { text: "10 The Heavens Declare", top: 59.16 },
    { text: "11 Your Hands Will Break My Fall", top: 62.65 },
    { text: "12 Be Thou My Vision", top: 65.7 },
  ];
  const songs = [
    { sourcePage: 4, title: "Echoes of the Storm" },
    { sourcePage: 6, title: "Though He Slay Me" },
    { sourcePage: 8, title: "By Waters Deep and Still" },
    { sourcePage: 10, title: "Under His Wings" },
    { sourcePage: 12, title: "A Promise Broken" },
    { sourcePage: 14, title: "Clean Once Again" },
    { sourcePage: 16, title: "Armor of God" },
    { sourcePage: 18, title: "Restored" },
    { sourcePage: 20, title: "Our Light" },
    { sourcePage: 22, title: "The Heavens Declare" },
    { sourcePage: 24, title: "Your Hands Will Break My Fall" },
    { sourcePage: 26, title: "Be Thou My Vision" },
  ];
  const rows = matchSongListToPages(lines, songs);
  const links = realignIndexLinks(
    [
      { page: 4, label: "Page 4", top: 29.52, left: 9, width: 80, height: 4.2 },
      { page: 6, label: "Page 6", top: 32.76, left: 9, width: 80, height: 4.2 },
      { page: 8, label: "Page 8", top: 36.01, left: 9, width: 80, height: 4.2 },
      { page: 10, label: "Page 10", top: 39.19, left: 9, width: 80, height: 4.2 },
      { page: 12, label: "Page 12", top: 42.44, left: 9, width: 80, height: 4.2 },
      { page: 14, label: "Page 14", top: 45.6, left: 9, width: 80, height: 4.2 },
      { page: 16, label: "Page 16", top: 48.85, left: 9, width: 80, height: 4.2 },
      { page: 18, label: "Page 18", top: 52.1, left: 9, width: 80, height: 4.2 },
      { page: 20, label: "Page 20", top: 55.18, left: 9, width: 80, height: 4.2 },
      { page: 22, label: "Page 22", top: 58.52, left: 9, width: 80, height: 4.2 },
      { page: 24, label: "Page 24", top: 61.77, left: 9, width: 80, height: 4.2 },
      { page: 26, label: "Page 26", top: 64.85, left: 9, width: 80, height: 4.2 },
    ],
    rows,
  );
  assert.deepEqual(links.map((link) => link.page), [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]);
});

test("noisy contents text still opens each named song", () => {
  const text = [
    "Echoes of Storms",
    "Songs",
    "01 Echoes of the Storm",
    "02 Though He Slay Me",
    "03 By Waters Deep and Still",
    "04 Under His Wings",
    "5 : 05 A Promise Broken",
    "3 o 7 06 Clean Once Again",
    "07 Armor of God",
    "08 Restored",
    "09 Our Light",
    "10 The Heavens Declare",
    "11 Your Hands Will Break My Fall",
    "12 Be Thou My Vision",
  ].join("\n");
  const songs = [
    { sourcePage: 4, title: "Echoes of the Storm" },
    { sourcePage: 6, title: "Though He Slay Me" },
    { sourcePage: 8, title: "By Waters Deep and Still" },
    { sourcePage: 10, title: "Under His Wings" },
    { sourcePage: 12, title: "A Promise Broken" },
    { sourcePage: 14, title: "Clean Once Again" },
    { sourcePage: 16, title: "Armor of God" },
    { sourcePage: 18, title: "Restored" },
    { sourcePage: 20, title: "Our Light" },
    { sourcePage: 22, title: "The Heavens Declare" },
    { sourcePage: 24, title: "Your Hands Will Break My Fall" },
    { sourcePage: 26, title: "Be Thou My Vision" },
  ];
  const lines = text.split("\n").map((line, top) => ({ text: line, top }));
  const rows = matchSongListToPages(lines, songs);
  const links = realignIndexLinksByOrder(
    [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((page, index) => ({
      page,
      label: `Page ${page}`,
      top: 29 + index * 3,
      left: 9,
      width: 80,
      height: 4,
    })),
    rows,
  );
  assert.deepEqual(links.map((link) => link.page), [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]);
});

test("a contents name that is not on the album is not given another song", () => {
  const rows = matchSongListToPages(
    [{ text: "05 Horsemens Praise", top: 40 }],
    [
      { sourcePage: 12, title: "A Promise Broken" },
      { sourcePage: 16, title: "Armor of God" },
    ],
  );
  assert.equal(rows[0].page, 0);
});
