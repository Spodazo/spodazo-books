/**
 * Import Rudolph portrait PDF into Spodazo Books (production or local).
 *
 * Usage:
 *   BOOKS_URL=https://books.spodazo.com railway run -- node scripts/import-rudolph-book.mjs
 *   BOOKS_URL=http://localhost:3001 ADMIN_PASSWORD=... node scripts/import-rudolph-book.mjs
 *
 * Optional: RUDOLPH_PDF=/path/to/portrait.pdf
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
const pdfPath =
  process.env.RUDOLPH_PDF ||
  join(process.env.HOME || "", "Desktop", "Rudolph the Red Nosed Reindeer-portrait.pdf");
const cookieJar = "/tmp/spodazo-rudolph-import.jar";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const assetsDir = "/tmp/rudolph-book-import";

if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

function curlJson(args, body) {
  const argv = ["-sS", "-b", cookieJar, "-c", cookieJar, ...args];
  if (body !== undefined) {
    argv.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }
  const raw = execFileSync("curl", argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw || "{}");
}

function uploadFile(filePath, filename) {
  const raw = execFileSync(
    "curl",
    [
      "-sS",
      "-b",
      cookieJar,
      "-c",
      cookieJar,
      "-F",
      `file=@${filePath};filename=${filename}`,
      `${base}/api/admin/book-assets`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw || "{}");
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}

console.log("Rendering pages from PDF…");
execFileSync("python3", [join(scriptDir, "rudolph-render-assets.py"), pdfPath, assetsDir], {
  stdio: "inherit",
});

const manifest = JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8"));

const login = curlJson(["-X", "POST", `${base}/api/admin/login`], { password });
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

const uploaded = new Map();
for (const name of [
  "Rudolph-cover.webp",
  "Rudolph-cover-art.webp",
  "rudolph-character.webp",
  "Rudolph-The-Red-Nosed-Reindeer.pdf",
  ...manifest.pages.map((p) => p.imageAsset),
]) {
  const full = join(assetsDir, name);
  if (!existsSync(full)) continue;
  console.log("Uploading", name);
  uploaded.set(name, uploadFile(full, name));
}

function mediaUrl(name) {
  return uploaded.get(name)?.url || "";
}

const coverFilename = uploaded.get("Rudolph-cover.webp")?.filename || "Rudolph-cover.webp";
const coverArtFilename = uploaded.get("Rudolph-cover-art.webp")?.filename || "Rudolph-cover-art.webp";
const characterFilename = uploaded.get("rudolph-character.webp")?.filename || "rudolph-character.webp";
const pdfFilename =
  uploaded.get("Rudolph-The-Red-Nosed-Reindeer.pdf")?.filename || "Rudolph-The-Red-Nosed-Reindeer.pdf";

const title = "Rudolph\nThe Red-Nosed Reindeer";
const tagline = "A glowing nose. A foggy night. And the guide who saved Christmas Eve.";
const author = "Wernard A Broodryk";
const date = "Christmas 2024";

const coverUrl = mediaUrl("Rudolph-cover.webp");
const coverArtUrl = mediaUrl("Rudolph-cover-art.webp");
const characterUrl = mediaUrl("rudolph-character.webp");

const pages = manifest.pages.map((page) => ({
  ...page,
  imageUrl: mediaUrl(page.imageAsset),
  fullPageUrl: mediaUrl(page.fullPageAsset),
}));

const body = {
  title,
  slug: "Rudolph-The-Red-Nosed-Reindeer",
  tagline,
  author,
  date,
  coverUrl,
  pdfUrl: `/media/pdfs/${encodeURIComponent(pdfFilename)}`,
  color: "honey",
  sortOrder: 1,
  hidden: false,
  published: true,
  audience: "children",
  pageTemplate: "one-up",
  characterRender: "scene",
  pageBackground: "#fefcdd",
  pageTexture: "felt",
  spreadBackground: "#bd9a61",
  textFont: "Quicksand",
  textColor: "#203b2a",
  cover: coverFilename,
  pdf: pdfFilename,
  pages,
  coverLayout: {
    background: "#efdda6",
    elements: [
      {
        id: "cover-art",
        type: "image",
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        z: 1,
        imageAsset: coverFilename,
        imageUrl: coverUrl,
        fit: "contain",
        focusX: 50,
        focusY: 50,
        opacity: 100,
      },
    ],
  },
  titleLayout: {
    elements: [
      {
        id: "title-cover",
        type: "image",
        x: 7,
        y: 10,
        w: 42,
        h: 80,
        z: 1,
        imageAsset: coverFilename,
        imageUrl: coverUrl,
        fit: "contain",
        focusX: 50,
        focusY: 50,
        opacity: 100,
      },
      {
        id: "title-title",
        type: "text",
        x: 52,
        y: 16,
        w: 44,
        h: 28,
        z: 2,
        text: title,
        role: "title",
        align: "center",
        fontSize: 10,
        fontFamily: "Dancing Script",
      },
      {
        id: "title-tagline",
        type: "text",
        x: 54,
        y: 48,
        w: 42,
        h: 18,
        z: 3,
        text: tagline,
        role: "tagline",
        align: "center",
        fontSize: 4.2,
      },
      {
        id: "title-author",
        type: "text",
        x: 54,
        y: 72,
        w: 42,
        h: 8,
        z: 4,
        text: author,
        role: "author",
        align: "center",
        fontSize: 2.4,
      },
      {
        id: "title-date",
        type: "text",
        x: 54,
        y: 82,
        w: 42,
        h: 8,
        z: 5,
        text: date,
        role: "date",
        align: "center",
        fontSize: 2.2,
      },
    ],
    background: "",
  },
  backCoverLayout: {
    elements: [
      {
        id: "back-art",
        type: "image",
        x: 20,
        y: 38,
        w: 60,
        h: 22,
        z: 1,
        imageAsset: coverFilename,
        imageUrl: coverUrl,
        fit: "contain",
        focusX: 50,
        focusY: 50,
        opacity: 100,
      },
      {
        id: "back-title",
        type: "text",
        x: 4,
        y: 62,
        w: 92,
        h: 4,
        z: 2,
        text: "Rudolph The Red-Nosed Reindeer",
        role: "title",
        align: "center",
        fontSize: 2,
        fontFamily: "Nunito",
      },
    ],
    background: "#5c1824",
  },
  endLayout: {
    elements: [
      {
        id: "end-art",
        type: "image",
        x: 6,
        y: 10,
        w: 42,
        h: 80,
        z: 1,
        imageAsset: characterFilename,
        imageUrl: characterUrl,
        fit: "contain",
        focusX: 50,
        focusY: 50,
        opacity: 100,
      },
      {
        id: "end-title",
        type: "text",
        x: 53,
        y: 34,
        w: 42,
        h: 22,
        z: 2,
        text: "The End",
        role: "end",
        align: "center",
        fontSize: 6,
        fontFamily: "Dancing Script",
      },
    ],
    background: "#e8d4b4",
  },
};

const existing = curlJson(["-X", "GET", `${base}/api/books`]);
const already = Array.isArray(existing) && existing.find((b) => /rudolph/i.test(b.slug || ""));
if (already) {
  console.log("Book already exists:", already.slug, already.id, "— skipping create.");
  process.exit(0);
}

console.log("Creating book on", base);
const created = curlJson(["-X", "POST", `${base}/api/admin/books`], body);
if (created.error) {
  console.error("Create failed:", created);
  process.exit(1);
}

console.log("Done:", created.slug, "—", created.pages?.length, "story pages,", created.id);
