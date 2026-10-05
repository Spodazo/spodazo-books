import { bundledFlipbookPages } from "../shared/bundled-flipbooks";
import type { BookStore } from "./storage";

export const BE_THOU_SLUG = "Be-Thou-My-Vision";
const COVER_ASSET = "Be-Thou-My-Vision-cover.webp";

function catalogPayload(sortOrder: number) {
  const pages = bundledFlipbookPages(BE_THOU_SLUG, "/");
  return {
    slug: BE_THOU_SLUG,
    title: "Be Thou My Vision",
    tagline: "Songs of contemplation and adoration.",
    author: "Brody Vale & Eden Blue",
    date: "5 Oct 2026",
    cover: COVER_ASSET,
    color: "honey",
    sortOrder,
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
    pages,
    coverLayout: {
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
          fit: "cover",
          focusX: 50,
          focusY: 50,
          opacity: 100,
        },
      ],
    },
    titleLayout: { elements: [], background: "" },
    backCoverLayout: { elements: [], background: "" },
    endLayout: { elements: [], background: "" },
  } as const;
}

function catalogEntryReady(book: { pages?: Array<{ kind?: string }> }): boolean {
  const pages = book.pages || [];
  return pages.length === 18 && pages.every((page) => page.kind === "facsimile");
}

/** Idempotent: ensure Be Thou My Vision appears in the library after deploy (no manual import script). */
export async function ensureBeThouMyVisionCatalog(store: BookStore): Promise<void> {
  const existing = await store.getBookBySlug(BE_THOU_SLUG);
  if (existing && catalogEntryReady(existing)) return;

  const payload = catalogPayload(existing?.sortOrder ?? (await store.listBooks()).length + 1);

  if (existing) {
    await store.updateBook(existing.id, payload);
    console.log("[catalog] Be Thou My Vision updated to bundled flipbook catalog entry");
    return;
  }

  await store.createBook(payload);
  console.log("[catalog] Be Thou My Vision added to library catalog");
}
