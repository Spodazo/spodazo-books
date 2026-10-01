import assert from "node:assert/strict";
import test from "node:test";
import { bundledFlipbookCoverUrl, bundledFlipbookSrc, rudolphFlipbookPages } from "./bundled-flipbooks";

test("Rudolph uses the bundled static flipbook", () => {
  assert.equal(
    bundledFlipbookSrc("Rudolph-The-Red-Nosed-Reindeer", "/"),
    "/flipbooks/rudolph-the-red-nosed-reindeer/index.html",
  );
  assert.equal(bundledFlipbookSrc("willows-big-forest-adventure", "/"), "");
});

test("Rudolph catalog pages mirror the zip export", () => {
  const pages = rudolphFlipbookPages("/");
  assert.equal(pages.length, 20);
  assert.equal(pages[0].imageUrl, "/flipbooks/rudolph-the-red-nosed-reindeer/pages/p-01.jpg");
  assert.equal(pages[19].imageUrl, "/flipbooks/rudolph-the-red-nosed-reindeer/pages/p-20.jpg");
  assert.equal(bundledFlipbookCoverUrl("Rudolph-The-Red-Nosed-Reindeer", "/"), pages[0].imageUrl);
});
