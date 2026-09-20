import { DEFAULT_PALETTE_ID, normalizePaletteId } from "./palettes";
import type { BookAudience, BookPage, CharacterRender, Curator, CuratorRecord, PageTemplate, PlayerSetup } from "./types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeAudience(raw?: string | null): BookAudience {
  return raw === "adults" ? "adults" : "children";
}

export function normalizePageTemplate(raw?: string | null): PageTemplate {
  return raw === "two-up" || raw === "three-up" ? raw : "one-up";
}

export function normalizeCharacterRender(raw?: string | null): CharacterRender {
  return raw === "cutout" ? "cutout" : "scene";
}

export function groupBooksByAudience<T extends { audience?: string | null }>(books: T[]): { children: T[]; adults: T[] } {
  const children: T[] = [];
  const adults: T[] = [];
  for (const book of books) {
    if (normalizeAudience(book.audience) === "adults") adults.push(book);
    else children.push(book);
  }
  return { children, adults };
}

export function uniqueSlug(base: string, used: Set<string>): string {
  const root = slugify(base) || "book";
  let candidate = root;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${n++}`;
  }
  used.add(candidate);
  return candidate;
}

export const SITE_COPYRIGHT =
  "Produced by Spodazo LLC © 2026. All Rights Reserved. This material may not be copied — in whole or in part — or distributed without previous permission from the Producers.";

export const DEFAULT_PLAYER_SETUP: PlayerSetup = {
  appName: "Spodazo Books",
  theme: "Online storybooks for children",
  credits: "Stories and graphics by Spodazo.",
  copyright: SITE_COPYRIGHT,
  collectionCover: "",
  collectionCoverUrl: "",
  logo: "spodazo-bookings-logo.png",
  logoUrl: "",
  favicon: "spodazo-bookings-logo.png",
  faviconUrl: "",
  footerImage: "",
  footerImageUrl: "",
  collectionColor: DEFAULT_PALETTE_ID,
};

export const DEFAULT_CURATOR: CuratorRecord = {
  firstName: "",
  lastName: "",
  email: "",
  passwordHash: "",
};

export function normalizeCurator(raw?: Partial<CuratorRecord> | null): CuratorRecord {
  return {
    firstName: raw?.firstName?.trim() || "",
    lastName: raw?.lastName?.trim() || "",
    email: raw?.email?.trim() || "",
    passwordHash: raw?.passwordHash?.trim() || "",
  };
}

export function publicCurator(raw?: Partial<CuratorRecord> | null): Curator {
  const record = normalizeCurator(raw);
  return {
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
  };
}

export function normalizePlayerSetup(raw?: Partial<PlayerSetup> | null): PlayerSetup {
  return {
    appName: /^spodazo bookings$/i.test(raw?.appName?.trim() || "")
      ? DEFAULT_PLAYER_SETUP.appName
      : raw?.appName?.trim() || DEFAULT_PLAYER_SETUP.appName,
    theme: raw?.theme?.trim() || DEFAULT_PLAYER_SETUP.theme,
    credits: raw?.credits?.trim() || DEFAULT_PLAYER_SETUP.credits,
    copyright: raw?.copyright?.trim() || DEFAULT_PLAYER_SETUP.copyright,
    collectionCover: raw?.collectionCover?.trim() || "",
    collectionCoverUrl: "",
    logo: raw?.logo?.trim() || DEFAULT_PLAYER_SETUP.logo,
    logoUrl: "",
    favicon: raw?.favicon?.trim() || DEFAULT_PLAYER_SETUP.favicon,
    faviconUrl: "",
    footerImage: raw?.footerImage?.trim() || "",
    footerImageUrl: "",
    collectionColor: normalizePaletteId(raw?.collectionColor),
  };
}

export function normalizeBookPage(raw: Partial<BookPage>, index: number): BookPage {
  const paragraphs = Array.isArray(raw.paragraphs)
    ? raw.paragraphs.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return {
    id: String(raw.id || `page-${index + 1}`),
    sourcePage: Number(raw.sourcePage) || index + 1,
    kind: raw.kind === "facsimile" ? "facsimile" : "story",
    title: String(raw.title || `Page ${index + 1}`).trim(),
    paragraphs,
    imageAsset: String(raw.imageAsset || ""),
    fullPageAsset: String(raw.fullPageAsset || raw.imageAsset || ""),
    imageUrl: "",
    fullPageUrl: "",
    position: raw.position === "top" ? "top" : "bottom",
    focalPoint: /^\d{1,3}% \d{1,3}%$/.test(raw.focalPoint || "") ? String(raw.focalPoint) : "50% 50%",
    alt: raw.alt ? String(raw.alt) : undefined,
  };
}

export function parsePagesJson(raw?: string | null): BookPage[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((page, index) => normalizeBookPage(page as Partial<BookPage>, index));
  } catch {
    return [];
  }
}

export function pagesToJson(pages: BookPage[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      id: page.id,
      sourcePage: page.sourcePage,
      kind: page.kind,
      title: page.title,
      paragraphs: page.paragraphs,
      imageAsset: page.imageAsset,
      fullPageAsset: page.fullPageAsset,
      position: page.position,
      focalPoint: page.focalPoint,
      alt: page.alt,
    })),
  );
}
