import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { wantsFullscreen } from "./fullscreen";

test("fullscreen stays off until the reader has asked for it", () => {
  assert.equal(wantsFullscreen(null, false), false);
  assert.equal(wantsFullscreen("0", false), false);
  assert.equal(wantsFullscreen("1", true), false);
  assert.equal(wantsFullscreen("1", false), true);
});

test("the shelf button uses the browser fullscreen API, not the window zoom button", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const book = await readFile(new URL("../pages/Book.tsx", import.meta.url), "utf8");
  const button = await readFile(new URL("../components/FullScreenButton.tsx", import.meta.url), "utf8");
  assert.match(app, /FullScreenButton/);
  assert.match(button, /enterFullscreen/);
  assert.match(book, /allow="fullscreen"/);
});
