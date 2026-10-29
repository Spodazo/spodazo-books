export const BOOK_AUDIENCE_PRESETS = ["children", "adults"] as const;
export type BookAudiencePreset = (typeof BOOK_AUDIENCE_PRESETS)[number];

/** Stored slug for a shelf section (presets or custom). */
export type BookAudience = string;

export function isBookAudiencePreset(value: string): value is BookAudiencePreset {
  return value === "children" || value === "adults";
}

export function normalizeAudience(raw?: string | null): BookAudience {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "children";
  const slug = trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "children";
}

export function audienceLabel(raw?: string | null): string {
  const value = normalizeAudience(raw);
  if (value === "children") return "Children";
  if (value === "adults") return "Adults";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
