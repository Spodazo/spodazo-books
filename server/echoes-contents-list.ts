import fs from "fs";
import path from "path";
import { localImagePath } from "./media";
import type { BookStore } from "./storage";

const CONTENTS_IMAGE = path.resolve(process.cwd(), "server/assets/echoes-of-storms-contents.jpg");

/** Replace the printed song list. Horsemen's Praise is not on this album. */
export async function ensureEchoesContentsList(store: BookStore): Promise<void> {
  if (!fs.existsSync(CONTENTS_IMAGE)) return;
  const book = await store.getBookBySlug("echoes-of-storms-songbook");
  const page = book?.pages.find((item) => (item.links || []).length >= 8);
  if (!page) return;
  const dest = localImagePath(page.fullPageAsset || page.imageAsset || "");
  if (!dest) return;
  const next = fs.readFileSync(CONTENTS_IMAGE);
  const current = fs.readFileSync(dest);
  if (current.equals(next)) return;
  fs.writeFileSync(dest, next);
  console.log("[catalog] updated Echoes of Storms contents list");
}
