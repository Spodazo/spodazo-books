import assert from "node:assert/strict";
import test from "node:test";
import { audioUrl, decodeMediaFilename, imageUrl } from "./media";

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

test("revisionPageFileName never reuses page-001.jpg", async () => {
  const { revisionPageFileName } = await import("./paths");
  assert.equal(revisionPageFileName("rev1", 1), "rev1-page-001.jpg");
  assert.notEqual(revisionPageFileName("rev1", 1), revisionPageFileName("rev2", 1));
});

test("writeExclusiveFile leaves an existing file untouched", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { writeExclusiveFile } = await import("./paths");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-pages-"));
  const first = await writeExclusiveFile(dir, "page.jpg", Buffer.from("old"));
  const second = await writeExclusiveFile(dir, "page.jpg", Buffer.from("new"));
  assert.equal(first, "page.jpg");
  assert.equal(second, "page-2.jpg");
  assert.equal(fs.readFileSync(path.join(dir, first), "utf8"), "old");
  assert.equal(fs.readFileSync(path.join(dir, second), "utf8"), "new");
});

test("audioUrl points at the bundled audio folder", () => {
  assert.match(audioUrl("willows-forest-adventure.mp3"), /\/media\/audio\/willows-forest-adventure\.mp3\?/);
});
