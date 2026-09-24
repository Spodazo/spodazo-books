export const PAPER_TEXTURES = [
  { id: "speckle", label: "Speckled", w: 168, h: 160 },
  { id: "laid", label: "Laid", w: 162, h: 160 },
  { id: "coldpress", label: "Cold press", w: 164, h: 160 },
  { id: "deckle", label: "Deckle", w: 92, h: 160 },
  { id: "felt", label: "Felt", w: 172, h: 160 },
] as const;

export type PaperTextureId = (typeof PAPER_TEXTURES)[number]["id"];

const IDS = new Set<string>(PAPER_TEXTURES.map((item) => item.id));

export function normalizePaperTexture(raw?: string | null): PaperTextureId | "" {
  const value = String(raw || "").trim();
  return IDS.has(value) ? (value as PaperTextureId) : "";
}

export function paperTexture(id?: string | null) {
  const texture = normalizePaperTexture(id);
  return PAPER_TEXTURES.find((item) => item.id === texture) || null;
}

export function paperTextureUrl(id?: string | null): string {
  const texture = normalizePaperTexture(id);
  return texture ? `/paper/${texture}.png` : "";
}

/** The photograph, repeated at its own pixel size, so a patch matches the sample. */
export function paperSurfaceStyle(color: string, texture?: string | null): Record<string, string> {
  const paper = paperTexture(texture);
  const url = paperTextureUrl(texture);
  if (!paper || !url) return { backgroundColor: color };
  const tile = `${paper.w}px ${paper.h}px`;
  if (paper.id === "deckle") {
    return {
      backgroundColor: color,
      backgroundImage: `url("/paper/deckle-edge.png"), url("${url}")`,
      backgroundRepeat: "repeat-y, repeat",
      backgroundSize: `auto, ${tile}`,
      backgroundPosition: "left top, 0 0",
      backgroundBlendMode: "normal, normal",
    };
  }
  return {
    backgroundColor: color,
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "repeat",
    backgroundSize: tile,
    backgroundPosition: "0 0",
    backgroundBlendMode: "normal",
  };
}

/** Editor buttons show the whole sample, including the deckle edge. */
export function paperSwatchStyle(texture?: string | null): Record<string, string> {
  if (normalizePaperTexture(texture) === "deckle") {
    return {
      backgroundImage: 'url("/paper/deckle-full.png")',
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { ...paperSurfaceStyle("#ffffff", texture), backgroundSize: "100% 100%" };
}
