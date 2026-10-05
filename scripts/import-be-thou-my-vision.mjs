/**
 * Add or update the Be Thou My Vision bundled flipbook in the Spodazo Books catalog.
 *
 * Usage:
 *   BOOKS_URL=http://localhost:3001 ADMIN_PASSWORD=... node scripts/import-be-thou-my-vision.mjs
 *   BOOKS_URL=https://books.spodazo.com railway run -- node scripts/import-be-thou-my-vision.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnv() {
  const path = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const SLUG = "Be-Thou-My-Vision";
const FLIPBOOK_DIR = "be-thou-my-vision";
const PAGE_COUNT = 18;
const COVER_ASSET = "Be-Thou-My-Vision-cover.webp";

const base = process.env.BOOKS_URL || "http://localhost:3001";
const password = process.env.ADMIN_PASSWORD;
const cookieJar = "/tmp/spodazo-be-thou-import.jar";

if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

function curlJson(args, body) {
  const argv = ["-sS", "-b", cookieJar, "-c", cookieJar, ...args];
  if (body !== undefined) {
    argv.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }
  return JSON.parse(execFileSync("curl", argv, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }) || "{}");
}

function bundledPages() {
  const pages = [];
  for (let i = 1; i <= PAGE_COUNT; i++) {
    const file = `p-${String(i).padStart(2, "0")}.jpg`;
    const url = `/flipbooks/${FLIPBOOK_DIR}/pages/${file}`;
    pages.push({
      id: `page-${i}`,
      sourcePage: i,
      kind: "facsimile",
      title: `Page ${i}`,
      paragraphs: [],
      imageAsset: file,
      fullPageAsset: file,
      imageUrl: url,
      fullPageUrl: url,
      position: "bottom",
      focalPoint: "50% 50%",
      elements: [],
      background: "",
    });
  }
  return pages;
}

function uploadCover() {
  const coverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "media", "images", COVER_ASSET);
  if (!existsSync(coverPath)) {
    console.error("Cover not found:", coverPath);
    process.exit(1);
  }
  const raw = execFileSync(
    "curl",
    [
      "-sS",
      "-b",
      cookieJar,
      "-c",
      cookieJar,
      "-F",
      `file=@${coverPath};filename=${COVER_ASSET}`,
      `${base}/api/admin/book-assets`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw || "{}");
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}

const login = curlJson(["-X", "POST", `${base}/api/admin/login`], { password });
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

console.log("Uploading library cover…");
const coverUpload = uploadCover();
const coverUrl = coverUpload.url || `/media/images/${encodeURIComponent(COVER_ASSET)}`;

const pages = bundledPages();
const coverLayout = {
  background: "#021b3f",
  elements: [
    {
      id: "cover-art",
      type: "image",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      imageAsset: coverUpload.filename || COVER_ASSET,
      imageUrl: coverUrl,
      fit: "cover",
      focusX: 50,
      focusY: 50,
      opacity: 100,
    },
  ],
};

const bookBody = {
  title: "Be Thou My Vision",
  slug: SLUG,
  tagline: "Songs of contemplation and adoration.",
  author: "Brody Vale & Eden Blue",
  date: "5 Oct 2026",
  cover: coverUpload.filename || COVER_ASSET,
  coverUrl,
  color: "honey",
  sortOrder: 3,
  hidden: false,
  published: true,
  audience: "children",
  pageTemplate: "one-up",
  characterRender: "scene",
  pageBackground: "#022a58",
  pageTexture: "felt",
  spreadBackground: "#021b3f",
  textFont: "Lexend",
  textColor: "#f1c27d",
  pdf: "",
  pdfUrl: "",
  pages,
  coverLayout,
  titleLayout: { elements: [], background: "" },
  backCoverLayout: { elements: [], background: "" },
  endLayout: { elements: [], background: "" },
};

const list = curlJson(["-X", "GET", `${base}/api/books`]);
const existing = Array.isArray(list) ? list.find((b) => b.slug === SLUG) : null;

let result;
if (existing?.id) {
  console.log("Updating existing book", existing.id);
  result = curlJson(["-X", "PATCH", `${base}/api/admin/books/${existing.id}`], bookBody);
} else {
  console.log("Creating new book");
  result = curlJson(["-X", "POST", `${base}/api/admin/books`], bookBody);
}

if (result.error) {
  console.error("Import failed:", result);
  process.exit(1);
}

console.log("Be Thou My Vision catalog entry ready:", result.slug, "—", result.pages?.length, "pages");
