#!/usr/bin/env npx tsx
/**
 * B1: Rasterize a PDF into a Be Thou–style bundled flipbook (pages + generated index.html + song-nav.json).
 *
 * Usage:
 *   npx tsx scripts/build-bundled-flipbook-from-pdf.ts --pdf path/to/book.pdf --out client/public/flipbooks/my-songbook --song-nav path/to/song-nav.json
 *
 * Optional: --title "My Songbook"
 */
import fs from "node:fs";
import path from "node:path";
import { writeBundledFlipbookFromPdf } from "../server/bundled-flipbook";
import { parseSongNav } from "../shared/song-nav";

function arg(flag: string): string {
  const i = process.argv.indexOf(flag);
  if (i < 0 || !process.argv[i + 1]) return "";
  return process.argv[i + 1];
}

const pdfPath = arg("--pdf");
const outDir = arg("--out");
const songNavPath = arg("--song-nav");
const title = arg("--title");

if (!pdfPath || !outDir) {
  console.error("Usage: npx tsx scripts/build-bundled-flipbook-from-pdf.ts --pdf FILE.pdf --out DIR [--song-nav FILE.json] [--title TITLE]");
  process.exit(1);
}
if (!fs.existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}`);
  process.exit(1);
}

const songNav = songNavPath
  ? parseSongNav(JSON.parse(fs.readFileSync(songNavPath, "utf8")))
  : undefined;

const meta = await writeBundledFlipbookFromPdf({
  pdfPath,
  destDir: path.resolve(outDir),
  title: title || undefined,
  songNav,
});

console.log(`Wrote ${meta.pageCount} pages to ${path.resolve(outDir)}`);
console.log(`Title: ${meta.title}`);
console.log(`Song links: ${meta.songNav.entries.length} (list page ${meta.songNav.songListPage || "none"})`);
console.log("");
console.log("If this book should use the static iframe reader, add it to shared/bundled-flipbooks.ts:");
console.log(`  "Your-Slug": { dir: "${path.basename(path.resolve(outDir))}", pageCount: ${meta.pageCount} },`);
