export const PAPER_TEXTURES = [
  { id: "speckle", label: "Speckled" },
  { id: "laid", label: "Laid" },
  { id: "coldpress", label: "Cold press" },
  { id: "deckle", label: "Deckle" },
  { id: "felt", label: "Felt" },
] as const;

export type PaperTextureId = (typeof PAPER_TEXTURES)[number]["id"];

const IDS = new Set<string>(PAPER_TEXTURES.map((item) => item.id));

export function normalizePaperTexture(raw?: string | null): PaperTextureId | "" {
  const value = String(raw || "").trim();
  return IDS.has(value) ? (value as PaperTextureId) : "";
}

export function paperTextureUrl(id?: string | null): string {
  const texture = normalizePaperTexture(id);
  return texture ? `/paper/${texture}.png` : "";
}

/** Solid color, with a grain map multiplied on top so the same paper can be recolored. */
export function paperSurfaceStyle(color: string, texture?: string | null): Record<string, string> {
  const url = paperTextureUrl(texture);
  if (!url) return { backgroundColor: color };
  const deckle = normalizePaperTexture(texture) === "deckle";
  return {
    backgroundColor: color,
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundPosition: deckle ? "left center" : "center",
    backgroundBlendMode: "multiply",
  };
}
