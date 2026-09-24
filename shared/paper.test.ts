import assert from "node:assert/strict";
import test from "node:test";
import { normalizePaperTexture, paperSurfaceStyle, paperTextureUrl } from "./paper";

test("normalizePaperTexture keeps the five papers", () => {
  assert.equal(normalizePaperTexture("speckle"), "speckle");
  assert.equal(normalizePaperTexture("laid"), "laid");
  assert.equal(normalizePaperTexture("coldpress"), "coldpress");
  assert.equal(normalizePaperTexture("deckle"), "deckle");
  assert.equal(normalizePaperTexture("felt"), "felt");
  assert.equal(normalizePaperTexture("linen"), "");
  assert.equal(normalizePaperTexture(""), "");
});

test("paperSurfaceStyle is a flat color until a texture is chosen", () => {
  assert.deepEqual(paperSurfaceStyle("#efdda6", ""), { backgroundColor: "#efdda6" });
  const laid = paperSurfaceStyle("#112233", "laid");
  assert.equal(laid.backgroundColor, "#112233");
  assert.equal(laid.backgroundImage, `url("${paperTextureUrl("laid")}")`);
  assert.equal(laid.backgroundBlendMode, "multiply");
  assert.equal(paperSurfaceStyle("#112233", "deckle").backgroundPosition, "left center");
  assert.equal(laid.backgroundSize, "cover");
});
