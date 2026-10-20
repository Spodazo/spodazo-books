import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WILLOW_SONG_MARKER, WILLOW_SONG_PAGE_COUNT, willowSongPages } from "../shared/willow-song-book";
import { JsonBookStore, resetStoreForTests } from "./storage";
import { ensureWillowSongBook } from "./willow-song-book";

test("ensureWillowSongBook rewrites Willow once and stays put", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-willow-song-"));
  process.env.BOOKS_DATA_DIR = dir;
  resetStoreForTests();

  const store = new JsonBookStore();
  const created = await store.createBook({
    slug: "willows-big-forest-adventure",
    title: "Willow’s Big Forest Adventure",
    tagline: "A little tiger. A very big roar.",
    pages: willowSongPages().slice(0, 10),
    coverLayout: { elements: [{ id: "cover-tagline", type: "text", x: 10, y: 80, w: 80, h: 8, z: 1, text: "old", role: "tagline" }] },
    titleLayout: { elements: [{ id: "title-tagline", type: "text", x: 54, y: 50, w: 40, h: 16, z: 1, text: "old", role: "tagline" }] },
  });

  await ensureWillowSongBook(store);
  await ensureWillowSongBook(store);

  const book = await store.getBookBySlug(created.slug);
  assert.ok(book);
  assert.equal(book.pages.length, WILLOW_SONG_PAGE_COUNT);
  assert.match(book.pages.map((page) => page.paragraphs.join(" ")).join(" "), new RegExp(WILLOW_SONG_MARKER));
  assert.equal(book.coverLayout.elements.find((item) => item.role === "tagline")?.text?.includes("Sing-Along Book"), true);
  assert.equal(book.coverLayout.elements.find((item) => item.role === "tagline")?.text?.includes("so much more"), true);
  assert.equal((await store.listBooks()).filter((item) => item.slug === created.slug).length, 1);

  delete process.env.BOOKS_DATA_DIR;
  resetStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});
