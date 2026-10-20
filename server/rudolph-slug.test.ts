import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RUDOLPH_SLUG } from "../shared/rudolph";
import { ensureRudolphPublicSlug } from "./rudolph-slug";
import { JsonBookStore, resetStoreForTests } from "./storage";

test("ensureRudolphPublicSlug renames the long Rudolph path once", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-rudolph-slug-"));
  process.env.BOOKS_DATA_DIR = dir;
  resetStoreForTests();

  const store = new JsonBookStore();
  await store.createBook({
    slug: "Rudolph-The-Red-Nosed-Reindeer",
    title: "Rudolph\nThe Red-Nosed Reindeer",
  });

  await ensureRudolphPublicSlug(store);
  await ensureRudolphPublicSlug(store);

  const book = await store.getBookBySlug(RUDOLPH_SLUG);
  assert.ok(book);
  assert.equal(book.slug, RUDOLPH_SLUG);
  assert.equal((await store.listBooks()).filter((item) => /rudolph/i.test(item.slug)).length, 1);
  assert.equal(await store.getBookBySlug("Rudolph-The-Red-Nosed-Reindeer"), null);

  delete process.env.BOOKS_DATA_DIR;
  resetStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});
