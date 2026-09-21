import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TEXT_FONT, fontStack, googleFontsHref, normalizeFont } from "./book-fonts";

test("normalizeFont keeps known families and falls back", () => {
  assert.equal(normalizeFont("Nunito", DEFAULT_TEXT_FONT), "Nunito");
  assert.equal(normalizeFont("Comic Sans", DEFAULT_TEXT_FONT), DEFAULT_TEXT_FONT);
  assert.equal(normalizeFont("", ""), "");
});

test("googleFontsHref asks Google for the chosen families", () => {
  const href = googleFontsHref(["Dancing Script", "bogus"]);
  assert.match(href, /fonts\.googleapis\.com/);
  assert.match(href, /Dancing\+Script/);
  assert.doesNotMatch(href, /bogus/);
});

test("fontStack quotes the family name", () => {
  assert.equal(fontStack("Nunito Sans"), '"Nunito Sans", sans-serif');
});
