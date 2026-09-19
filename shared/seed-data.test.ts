import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBookPage, parsePagesJson, slugify } from "./seed-data";

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
