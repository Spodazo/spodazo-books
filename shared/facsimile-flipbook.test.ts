import assert from "node:assert/strict";
import test from "node:test";
import {
  facsimileFlipbookTheme,
  facsimileSpreads,
  FLIPBOOK_NAVY,
  isFacsimileFlipbookListItem,
  shouldUseFacsimileFlipbook,
} from "./facsimile-flipbook";

test("facsimileSpreads matches Be Thou My Vision pairing", () => {
  assert.deepEqual(facsimileSpreads(18), [
    [0, 1], [2, 3], [4, 5], [6, 7], [8, 9],
    [10, 11], [12, 13], [14, 15], [16, 17], [18, 0],
  ]);
  assert.deepEqual(facsimileSpreads(1), [[0, 1]]);
  assert.deepEqual(facsimileSpreads(2), [[0, 1], [2, 0]]);
  assert.deepEqual(facsimileSpreads(5), [[0, 1], [2, 3], [4, 5]]);
  assert.deepEqual(facsimileSpreads(0), []);
});

test("shouldUseFacsimileFlipbook is true for uploaded PDFs and false for bundled books", () => {
  const pages = [
    { kind: "facsimile", imageAsset: "page-001.jpg", fullPageAsset: "page-001.jpg" },
    { kind: "facsimile", imageAsset: "page-002.jpg", fullPageAsset: "page-002.jpg" },
  ];
  assert.equal(shouldUseFacsimileFlipbook({ pdf: "songbook.pdf", pages }), true);
  assert.equal(shouldUseFacsimileFlipbook({ pdfUrl: "/media/pdfs/songbook.pdf", pages }), true);
  assert.equal(shouldUseFacsimileFlipbook({ slug: "Be-Thou-My-Vision", pdf: "x.pdf", pages }), false);
  assert.equal(shouldUseFacsimileFlipbook({ slug: "Rudolph-The-Red-Nosed-Reindeer", pdfUrl: "/x.pdf" }), false);
  assert.equal(shouldUseFacsimileFlipbook({ pdf: "", pages }), false);
  assert.equal(
    shouldUseFacsimileFlipbook({
      pdf: "book.pdf",
      pages: [{ kind: "story", imageAsset: "art.webp", fullPageAsset: "art.webp" }],
    }),
    false,
  );
});

test("library cards treat a pdfUrl as a facsimile flipbook", () => {
  assert.equal(isFacsimileFlipbookListItem({ slug: "new-songbook", pdfUrl: "/media/pdfs/a.pdf" }), true);
  assert.equal(isFacsimileFlipbookListItem({ slug: "Be-Thou-My-Vision", pdfUrl: "/x.pdf" }), false);
  assert.equal(isFacsimileFlipbookListItem({ slug: "willow", pdfUrl: "" }), false);
});

test("facsimileFlipbookTheme uses navy when the book still has story-desk defaults", () => {
  assert.deepEqual(facsimileFlipbookTheme({}), FLIPBOOK_NAVY);
  assert.deepEqual(
    facsimileFlipbookTheme({ spreadBackground: "#bd9a61", pageBackground: "#efdda6", textColor: "#203b2a" }),
    FLIPBOOK_NAVY,
  );
  assert.deepEqual(
    facsimileFlipbookTheme({ spreadBackground: "#112233", pageBackground: "#445566", textColor: "#ffe3a3" }),
    { ground: "#112233", groundEdge: FLIPBOOK_NAVY.groundEdge, paper: "#445566", gold: "#ffe3a3" },
  );
});
