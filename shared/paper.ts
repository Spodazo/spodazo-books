export const PAPER_TEXTURES = [
  { id: "speckle", label: "Speckled" },
  { id: "laid", label: "Laid" },
  { id: "coldpress", label: "Cold press" },
  { id: "deckle", label: "Deckle" },
  { id: "felt", label: "Felt" },
] as const;

export type PaperTextureId = (typeof PAPER_TEXTURES)[number]["id"];

const IDS = new Set<string>(PAPER_TEXTURES.map((item) => item.id));

/** Repeat size, in CSS pixels. Keeps the grain at the scale of the paper samples. */
export const PAPER_TILE_PX = 160;

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
  const tile = `${PAPER_TILE_PX}px ${PAPER_TILE_PX}px`;
  const grain = `url("${url}")`;
  if (normalizePaperTexture(texture) !== "deckle") {
    return {
      backgroundColor: color,
      backgroundImage: grain,
      backgroundRepeat: "repeat",
      backgroundSize: tile,
      backgroundPosition: "0 0",
      backgroundBlendMode: "multiply",
    };
  }
  return {
    backgroundColor: color,
    backgroundImage: `linear-gradient(90deg, #c4b496, #ffffff 24%), ${grain}`,
    backgroundRepeat: "no-repeat, repeat",
    backgroundSize: `100% 100%, ${tile}`,
    backgroundPosition: "0 0, 0 0",
    backgroundBlendMode: "multiply, multiply",
  };
}
