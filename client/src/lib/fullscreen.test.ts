import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { wantsFullscreen } from "./fullscreen";

test("fullscreen is the default until this visit leaves it", () => {
  assert.equal(wantsFullscreen(null, false), true);
  assert.equal(wantsFullscreen("1", false), true);
  assert.equal(wantsFullscreen("0", false), false);
  assert.equal(wantsFullscreen(null, true), false);
  assert.equal(wantsFullscreen(null, false, true), false);
  assert.equal(wantsFullscreen(null, false, false, true), false);
});

test("the shelf button uses the browser fullscreen API, not the window zoom button", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const book = await readFile(new URL("../pages/Book.tsx", import.meta.url), "utf8");
  const button = await readFile(new URL("../components/FullScreenButton.tsx", import.meta.url), "utf8");
  assert.match(app, /FullScreenButton/);
  assert.match(button, /enterFullscreen/);
  assert.match(book, /allow="fullscreen"/);
  const early = await readFile(new URL("../../public/fullscreen-default.js", import.meta.url), "utf8");
  assert.match(early, /localStorage\.getItem\(key\) !== "0"/);
  assert.match(early, /api\.enter\(\)/);
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /src="\/fullscreen-default\.js"/);
});
