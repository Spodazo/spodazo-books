import assert from "node:assert/strict";
import test from "node:test";
import { normalizePaperTexture, paperSurfaceStyle, paperSwatchStyle, paperTexture, paperTextureUrl } from "./paper";

test("normalizePaperTexture keeps the five papers", () => {
  assert.equal(normalizePaperTexture("speckle"), "speckle");
  assert.equal(normalizePaperTexture("laid"), "laid");
  assert.equal(normalizePaperTexture("coldpress"), "coldpress");
  assert.equal(normalizePaperTexture("deckle"), "deckle");
  assert.equal(normalizePaperTexture("felt"), "felt");
  assert.equal(normalizePaperTexture("linen"), "");
  assert.equal(normalizePaperTexture(""), "");
});

test("paperSurfaceStyle shows the sample photograph at its own size", () => {
  assert.deepEqual(paperSurfaceStyle("#efdda6", ""), { backgroundColor: "#efdda6" });
  const laid = paperSurfaceStyle("#112233", "laid");
  const tile = paperTexture("laid");
  assert.equal(laid.backgroundColor, "#112233");
  assert.equal(laid.backgroundImage, `url("${paperTextureUrl("laid")}")`);
  assert.equal(laid.backgroundBlendMode, "normal");
  assert.equal(laid.backgroundRepeat, "repeat");
  assert.equal(laid.backgroundSize, `${tile?.w}px ${tile?.h}px`);
  const deckle = paperSurfaceStyle("#112233", "deckle");
  assert.match(String(deckle.backgroundImage), /deckle-edge\.png/);
  assert.equal(deckle.backgroundRepeat, "repeat-y, repeat");
  assert.equal(deckle.backgroundBlendMode, "normal, normal");
  assert.match(paperSwatchStyle("deckle").backgroundImage || "", /deckle-full\.png/);
});
