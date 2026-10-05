/**
 * Seed Be Thou My Vision into the local JSON catalog (.books-data/catalog.json).
 * Does not require admin login. Safe to re-run (updates or inserts by slug).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, ".books-data", "catalog.json");
const COVER_ASSET = "Be-Thou-My-Vision-cover.webp";
const SLUG = "Be-Thou-My-Vision";
const FLIPBOOK_DIR = "be-thou-my-vision";
const PAGE_COUNT = 18;

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

if (!existsSync(catalogPath)) {
  console.error("Missing catalog — start the app once or create .books-data/catalog.json");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const pages = bundledPages();
const now = new Date().toISOString();

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
      imageAsset: COVER_ASSET,
      imageUrl: "",
      fit: "cover",
      focusX: 50,
      focusY: 50,
      opacity: 100,
    },
  ],
};

const book = {
  id: "",
  slug: SLUG,
  title: "Be Thou My Vision",
  tagline: "Songs of contemplation and adoration.",
  author: "Brody Vale & Eden Blue",
  date: "5 Oct 2026",
  cover: COVER_ASSET,
  pdf: "",
  pages,
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
  titleLayout: { elements: [], background: "" },
  coverLayout,
  backCoverLayout: { elements: [], background: "" },
  endLayout: { elements: [], background: "" },
  createdAt: now,
  updatedAt: now,
};

const idx = (catalog.books || []).findIndex((b) => b.slug === SLUG);
if (idx >= 0) {
  book.id = catalog.books[idx].id;
  book.createdAt = catalog.books[idx].createdAt || now;
  catalog.books[idx] = book;
  console.log("Updated existing catalog entry");
} else {
  book.id = `book-${crypto.randomUUID()}`;
  catalog.books = catalog.books || [];
  catalog.books.push(book);
  console.log("Added new catalog entry");
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("Seeded", SLUG, "with", pages.length, "pages");
