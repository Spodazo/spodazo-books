import assert from "node:assert/strict";
import test from "node:test";
import { withFlipbookCacheBust } from "./flipbook-cache";

test("withFlipbookCacheBust injects the shared script once", () => {
  const once = withFlipbookCacheBust("<head><title>Book</title></head>");
  assert.match(once, /<head><script src="\/flipbooks\/cache-bust.js"><\/script>/);
  assert.equal(withFlipbookCacheBust(once), once);
});
