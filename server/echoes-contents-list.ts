import fs from "fs";
import path from "path";
import { localImagePath } from "./media";
import type { BookStore } from "./storage";

const CONTENTS_IMAGE = path.resolve(process.cwd(), "server/assets/echoes-of-storms-contents.jpg");
const PREFACE_IMAGE = path.resolve(process.cwd(), "server/assets/echoes-of-storms-preface.jpg");
const STORM_LYRICS_IMAGE = path.resolve(process.cwd(), "server/assets/echoes-of-the-storm-lyrics.jpg");

function replaceStoredImage(asset: string | undefined, file: string, label: string): void {
  if (!asset || !fs.existsSync(file)) return;
  const dest = localImagePath(asset);
  if (!dest) return;
  const next = fs.readFileSync(file);
  const current = fs.readFileSync(dest);
  if (current.equals(next)) return;
  fs.writeFileSync(dest, next);
  console.log(`[catalog] updated ${label}`);
}

/** Keep shipped Echoes of Storms pages in step with the album. */
export async function ensureEchoesContentsList(store: BookStore): Promise<void> {
  const book = await store.getBookBySlug("echoes-of-storms-songbook");
  if (!book) return;
  const contents = book.pages.find((item) => (item.links || []).length >= 8);
  replaceStoredImage(contents?.fullPageAsset || contents?.imageAsset, CONTENTS_IMAGE, "Echoes of Storms contents list");
  const preface = book.pages.find((item) => item.sourcePage === 3);
  replaceStoredImage(preface?.fullPageAsset || preface?.imageAsset, PREFACE_IMAGE, "Echoes of Storms preface");
  const lyrics = book.pages.find((item) => item.sourcePage === 5);
  replaceStoredImage(lyrics?.fullPageAsset || lyrics?.imageAsset, STORM_LYRICS_IMAGE, "Echoes of the Storm lyrics");
}
