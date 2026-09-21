export type BookFontKind = "straight" | "cursive";

export type BookFont = {
  id: string;
  label: string;
  kind: BookFontKind;
};

export const DEFAULT_TEXT_FONT = "Nunito";
export const DEFAULT_TEXT_COLOR = "#203b2a";

export const BOOK_FONTS: BookFont[] = [
  { id: "Nunito", label: "Nunito", kind: "straight" },
  { id: "Quicksand", label: "Quicksand", kind: "straight" },
  { id: "Poppins", label: "Poppins", kind: "straight" },
  { id: "Outfit", label: "Outfit", kind: "straight" },
  { id: "Nunito Sans", label: "Nunito Sans", kind: "straight" },
  { id: "DM Sans", label: "DM Sans", kind: "straight" },
  { id: "Rubik", label: "Rubik", kind: "straight" },
  { id: "Karla", label: "Karla", kind: "straight" },
  { id: "Mulish", label: "Mulish", kind: "straight" },
  { id: "Lexend", label: "Lexend", kind: "straight" },
  { id: "Dancing Script", label: "Dancing Script", kind: "cursive" },
  { id: "Pacifico", label: "Pacifico", kind: "cursive" },
  { id: "Great Vibes", label: "Great Vibes", kind: "cursive" },
  { id: "Caveat", label: "Caveat", kind: "cursive" },
  { id: "Satisfy", label: "Satisfy", kind: "cursive" },
  { id: "Sacramento", label: "Sacramento", kind: "cursive" },
  { id: "Allura", label: "Allura", kind: "cursive" },
  { id: "Lobster", label: "Lobster", kind: "cursive" },
  { id: "Cookie", label: "Cookie", kind: "cursive" },
  { id: "Courgette", label: "Courgette", kind: "cursive" },
];

export const TEXT_INK_PALETTE = [
  "#203b2a", "#102517", "#000000", "#271911", "#3a2010", "#4a3728",
  "#12213d", "#1d4ed8", "#6d28d9", "#8b2d2d", "#be185d", "#b45309",
  "#fff8e4", "#efdda6", "#ffffff", "#ece8e0",
];

const FONT_IDS = new Set(BOOK_FONTS.map((item) => item.id));

export function normalizeFont(raw?: string | null, fallback = ""): string {
  const value = String(raw || "").trim();
  return FONT_IDS.has(value) ? value : fallback;
}

export function fontStack(family?: string | null): string {
  const id = normalizeFont(family, DEFAULT_TEXT_FONT);
  return `'${id}', sans-serif`;
}

export function fontsUsed(...values: Array<string | undefined | null>): string[] {
  const ids = values.map((value) => normalizeFont(value)).filter(Boolean);
  return [...new Set(ids.length ? ids : [DEFAULT_TEXT_FONT])];
}

export function googleFontsHref(families: string[]): string {
  const ids = fontsUsed(...families);
  const query = ids
    .map((id) => `family=${encodeURIComponent(id).replace(/%20/g, "+")}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

export function straightFonts(): BookFont[] {
  return BOOK_FONTS.filter((item) => item.kind === "straight");
}

export function cursiveFonts(): BookFont[] {
  return BOOK_FONTS.filter((item) => item.kind === "cursive");
}
