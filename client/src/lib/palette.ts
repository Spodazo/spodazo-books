import { normalizePaletteId, paletteById } from "@shared/palettes";

const PALETTE_KEY = "spodazo-palette";

function paint(id: string): void {
  const palette = paletteById(id);
  document.documentElement.dataset.palette = palette.id;
  document.documentElement.style.background = palette.bg;
  document.body.style.background = palette.bg;
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute("content", palette.bg);
}

export function applyPalette(id?: string | null): void {
  const next = normalizePaletteId(id);
  paint(next);
  try {
    localStorage.setItem(PALETTE_KEY, next);
  } catch {
    /* private mode */
  }
}

export function restorePalette(): void {
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    if (saved) paint(normalizePaletteId(saved));
  } catch {
    /* private mode */
  }
}
