import assert from "node:assert/strict";
import test from "node:test";
import { decodeMediaFilename, imageUrl } from "./media";

test("decodeMediaFilename undoes a single encode and ignores query strings", () => {
  assert.equal(decodeMediaFilename("Willow - Tiger.webp"), "Willow - Tiger.webp");
  assert.equal(decodeMediaFilename("Willow%20-%20Tiger.webp"), "Willow - Tiger.webp");
  assert.equal(
    decodeMediaFilename("/media/images/Willow%20-%20Tiger.webp?v=dev&w=720"),
    "Willow - Tiger.webp",
  );
});

test("imageUrl does not double-encode a stored filename", () => {
  const href = imageUrl("Willow%20-%20Tiger.webp");
  assert.match(href, /\/media\/images\/Willow%20-%20Tiger\.webp\?/);
  assert.doesNotMatch(href, /%2520/);
});
