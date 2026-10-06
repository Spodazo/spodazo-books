import fs from "fs";
import path from "path";
import { generateBundledSongbookHtml, pageFileName } from "../shared/bundled-songbook";
import { parseSongNav, type SongNav } from "../shared/song-nav";
import type { BookPage } from "../shared/types";
import { bundledFlipbooksDir, imagesDir, uniqueFileName } from "./paths";
import { renderPdfToJpegs } from "./pdf-import";

const TEMPLATE_CANDIDATES = [
  path.resolve(process.cwd(), "client/public/flipbooks/songbook-template.html"),
  path.resolve(process.cwd(), "dist/public/flipbooks/songbook-template.html"),
];

const ZOOM_CANDIDATES = [
  path.resolve(process.cwd(), "client/public/flipbooks/mobile-view-zoom.js"),
  path.resolve(process.cwd(), "dist/public/flipbooks/mobile-view-zoom.js"),
];

export function loadSongbookTemplate(): string {
  for (const file of TEMPLATE_CANDIDATES) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  throw new Error("songbook-template.html is missing");
}

function ensureZoomScript(): void {
  const dest = path.join(bundledFlipbooksDir(), "mobile-view-zoom.js");
  if (fs.existsSync(dest) && fs.statSync(dest).size > 32) return;
  for (const file of ZOOM_CANDIDATES) {
    if (!fs.existsSync(file)) continue;
    fs.mkdirSync(bundledFlipbooksDir(), { recursive: true });
    fs.copyFileSync(file, dest);
    return;
  }
  throw new Error("mobile-view-zoom.js is missing");
}

export function safeBundleDirName(raw: string): string {
  const name = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!name || name === "." || name === "..") throw new Error("Invalid flipbook folder name");
  return name;
}

export function bundleRoot(dir: string): string {
  const name = safeBundleDirName(dir);
  const root = path.resolve(bundledFlipbooksDir(), name);
  const base = path.resolve(bundledFlipbooksDir());
  if (root !== base && !root.startsWith(base + path.sep)) throw new Error("Invalid flipbook folder name");
  return root;
}

export type BundleMeta = {
  title: string;
  pageCount: number;
  ratio: number;
  songNav: SongNav;
};

function writeIndex(root: string, meta: BundleMeta): void {
  const html = generateBundledSongbookHtml(loadSongbookTemplate(), {
    title: meta.title,
    imageCount: meta.pageCount,
    ratio: meta.ratio,
    songNav: meta.songNav,
  });
  fs.writeFileSync(path.join(root, "index.html"), html);
  fs.writeFileSync(path.join(root, "song-nav.json"), JSON.stringify(meta.songNav, null, 2));
  fs.writeFileSync(
    path.join(root, "manifest.json"),
    JSON.stringify({ title: meta.title, pageCount: meta.pageCount, ratio: meta.ratio }, null, 2),
  );
}

export function readBundleMeta(dir: string): BundleMeta {
  const root = bundleRoot(dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as {
    title?: string;
    pageCount?: number;
    ratio?: number;
  };
  const songNav = parseSongNav(JSON.parse(fs.readFileSync(path.join(root, "song-nav.json"), "utf8")));
  return {
    title: String(manifest.title || "Songbook"),
    pageCount: Number(manifest.pageCount) || 0,
    ratio: Number(manifest.ratio) || 297 / 210,
    songNav,
  };
}

export async function writeBundledFlipbookFromPdf(options: {
  pdfPath: string;
  originalName?: string;
  destDir: string;
  title?: string;
  songNav?: SongNav | unknown;
}): Promise<BundleMeta> {
  const rendered = await renderPdfToJpegs(options.pdfPath, options.originalName || path.basename(options.pdfPath));
  if (!rendered.pages.length) throw new Error("PDF has no pages.");
  const dest = path.resolve(options.destDir);
  const pagesDir = path.join(dest, "pages");
  fs.mkdirSync(pagesDir, { recursive: true });
  for (const page of rendered.pages) {
    fs.writeFileSync(path.join(pagesDir, pageFileName(page.index)), page.jpeg);
  }
  const first = rendered.pages[0];
  const meta: BundleMeta = {
    title: String(options.title || rendered.title).trim() || rendered.title,
    pageCount: rendered.pages.length,
    ratio: first.height / first.width,
    songNav: parseSongNav(options.songNav),
  };
  const zoomSrc = path.resolve(dest, "../mobile-view-zoom.js");
  if (!fs.existsSync(zoomSrc)) {
    for (const file of ZOOM_CANDIDATES) {
      if (!fs.existsSync(file)) continue;
      fs.mkdirSync(path.dirname(zoomSrc), { recursive: true });
      fs.copyFileSync(file, zoomSrc);
      break;
    }
  }
  writeIndex(dest, meta);
  return meta;
}

export async function prepareBundledDraft(
  pdfPath: string,
  originalName: string,
): Promise<{
  draftId: string;
  title: string;
  pageCount: number;
  ratio: number;
  previewUrl: string;
  songNav: SongNav;
}> {
  ensureZoomScript();
  const draftId = `draft-${crypto.randomUUID()}`;
  const dest = bundleRoot(draftId);
  const meta = await writeBundledFlipbookFromPdf({
    pdfPath,
    originalName,
    destDir: dest,
    title: originalName.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
  });
  return {
    draftId,
    title: meta.title,
    pageCount: meta.pageCount,
    ratio: meta.ratio,
    previewUrl: `/media/bundled-flipbooks/${draftId}/index.html`,
    songNav: meta.songNav,
  };
}

export function updateDraftSongNav(draftId: string, songNavRaw: unknown, title?: string): BundleMeta {
  const meta = readBundleMeta(draftId);
  meta.songNav = parseSongNav(songNavRaw);
  if (title !== undefined) meta.title = String(title).trim() || meta.title;
  writeIndex(bundleRoot(draftId), meta);
  return meta;
}

export function catalogPagesForBundle(dir: string, pageCount: number): BookPage[] {
  const out: BookPage[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    const file = pageFileName(i);
    out.push({
      id: `page-${i}`,
      sourcePage: i,
      kind: "facsimile",
      title: `Page ${i}`,
      paragraphs: [],
      imageAsset: file,
      fullPageAsset: file,
      imageUrl: `/media/bundled-flipbooks/${dir}/pages/${file}`,
      fullPageUrl: `/media/bundled-flipbooks/${dir}/pages/${file}`,
      position: "bottom",
      focalPoint: "50% 50%",
      elements: [],
      background: "",
    });
  }
  return out;
}

export async function publishBundledDraft(options: {
  draftId: string;
  dir: string;
  title?: string;
  songNav?: unknown;
}): Promise<{ dir: string; coverAsset: string; pageCount: number; songNav: SongNav; title: string }> {
  const meta = options.songNav
    ? updateDraftSongNav(options.draftId, options.songNav, options.title)
    : readBundleMeta(options.draftId);
  if (options.title) {
    meta.title = String(options.title).trim() || meta.title;
    writeIndex(bundleRoot(options.draftId), meta);
  }
  const destName = safeBundleDirName(options.dir);
  if (destName.startsWith("draft-")) throw new Error("Choose a folder name for the published book.");
  const src = bundleRoot(options.draftId);
  const dest = bundleRoot(destName);
  if (src !== dest) {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  const coverSrc = path.join(dest, "pages", pageFileName(1));
  if (!fs.existsSync(coverSrc)) throw new Error("Published flipbook is missing page 1.");
  const coverAsset = uniqueFileName(imagesDir(), `${destName}-cover.jpg`);
  fs.copyFileSync(coverSrc, path.join(imagesDir(), coverAsset));
  return {
    dir: destName,
    coverAsset,
    pageCount: meta.pageCount,
    songNav: meta.songNav,
    title: meta.title,
  };
}
