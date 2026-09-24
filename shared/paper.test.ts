import assert from "node:assert/strict";
import test from "node:test";
import { PAPER_TILE_PX, normalizePaperTexture, paperSurfaceStyle, paperTextureUrl } from "./paper";

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
  assert.equal(laid.backgroundRepeat, "repeat");
  assert.equal(laid.backgroundSize, `${PAPER_TILE_PX}px ${PAPER_TILE_PX}px`);
  const deckle = paperSurfaceStyle("#112233", "deckle");
  assert.match(deckle.backgroundImage, /^linear-gradient/);
  assert.equal(deckle.backgroundSize, `100% 100%, ${PAPER_TILE_PX}px ${PAPER_TILE_PX}px`);
});
