import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BE_THOU_SLUG, ensureBeThouMyVisionCatalog } from "./be-thou-my-vision-catalog";
import { JsonBookStore, resetStoreForTests } from "./storage";

test("ensureBeThouMyVisionCatalog creates the bundled book once", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-be-thou-"));
  process.env.BOOKS_DATA_DIR = dir;
  resetStoreForTests();

  const store = new JsonBookStore();
  await ensureBeThouMyVisionCatalog(store);
  await ensureBeThouMyVisionCatalog(store);

  const book = await store.getBookBySlug(BE_THOU_SLUG);
  assert.ok(book);
  assert.equal(book.pages.length, 18);
  assert.equal(book.pages[0]?.kind, "facsimile");
  assert.equal(book.cover, "Be-Thou-My-Vision-cover.webp");
  assert.equal((await store.listBooks()).filter((b) => b.slug === BE_THOU_SLUG).length, 1);

  delete process.env.BOOKS_DATA_DIR;
  resetStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});
