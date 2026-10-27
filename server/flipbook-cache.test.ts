import assert from "node:assert/strict";
import test from "node:test";
import { withFlipbookCacheBust } from "./flipbook-cache";
import { revisedFlipbookDocument } from "./revised-flipbook";
import type { PublicBook } from "../shared/types";

test("withFlipbookCacheBust injects the shared script once", () => {
  const once = withFlipbookCacheBust("<head><title>Book</title></head>");
  assert.match(once, /<head><script src="\/flipbooks\/cache-bust.js"><\/script>/);
  assert.equal(withFlipbookCacheBust(once), once);
});

test("a revised Rudolph PDF replaces the shipped flipbook document", () => {
  const html = revisedFlipbookDocument({
    slug: "Rudolph",
    title: "Rudolph",
    pdf: "revised.pdf",
    pdfUrl: "/media/pdfs/revised.pdf",
    pages: [
      {
        id: "page-1",
        sourcePage: 1,
        kind: "facsimile",
        title: "Cover",
        paragraphs: [],
        imageAsset: "page-001-5.jpg",
        fullPageAsset: "page-001-5.jpg",
        imageUrl: "/media/images/page-001-5.jpg?v=1",
        fullPageUrl: "/media/images/page-001-5.jpg?v=1",
        position: "bottom",
        focalPoint: "50% 50%",
        elements: [],
        background: "",
      },
    ],
  } as PublicBook);
  assert.match(html, /page-001-5\.jpg/);
  assert.doesNotMatch(html, /pages\/p-01\.jpg/);
});
