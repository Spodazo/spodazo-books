/**
 * Point the Rudolph catalog entry at the bundled zip flipbook (static JPGs + index.html).
 *
 * Usage: BOOKS_URL=https://books.spodazo.com railway run -- node scripts/sync-rudolph-bundled-catalog.mjs
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

const base = process.env.BOOKS_URL || "https://books.spodazo.com";
const password = process.env.ADMIN_PASSWORD;
const cookieJar = "/tmp/spodazo-rudolph-bundle-sync.jar";
const coverPath = "/flipbooks/rudolph-the-red-nosed-reindeer/pages/p-01.jpg";

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

function rudolphPages() {
  const pages = [];
  for (let i = 1; i <= 20; i++) {
    const file = `p-${String(i).padStart(2, "0")}.jpg`;
    const url = `/flipbooks/rudolph-the-red-nosed-reindeer/pages/${file}`;
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

const login = curlJson(["-X", "POST", `${base}/api/admin/login`], { password });
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

const list = curlJson(["-X", "GET", `${base}/api/books`]);
const book = Array.isArray(list) ? list.find((b) => /rudolph/i.test(b.slug || "")) : null;
if (!book?.id) {
  console.error("Rudolph book not found");
  process.exit(1);
}

const pages = rudolphPages();
const coverLayout = {
  background: "#0a0f1c",
  elements: [
    {
      id: "cover-art",
      type: "image",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      imageAsset: "p-01.jpg",
      imageUrl: coverPath,
      fit: "cover",
      focusX: 50,
      focusY: 50,
      opacity: 100,
    },
  ],
};

const updated = curlJson(["-X", "PATCH", `${base}/api/admin/books/${book.id}`], {
  cover: "p-01.jpg",
  coverUrl: coverPath,
  pageTemplate: "one-up",
  pages,
  coverLayout,
  titleLayout: { elements: [], background: "" },
  backCoverLayout: { elements: [], background: "" },
  endLayout: { elements: [], background: "" },
  pdf: "",
  pdfUrl: "",
});

if (updated.error) {
  console.error("PATCH failed:", updated);
  process.exit(1);
}

console.log("Rudolph catalog now uses bundled flipbook:", updated.slug, "—", updated.pages?.length, "pages");
