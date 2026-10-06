/** Left/right edge band used for mobile double-tap jump-to-start/end. */
export const FLIP_EDGE_FRACTION = 0.18;
export const FLIP_EDGE_MIN_PX = 56;
export const FLIP_DOUBLE_MS = 350;
export const FLIP_ARROW_CLICK_MS = 400;

/** -1 = left edge (start), 1 = right edge (end), 0 = not an edge tap. */
export function edgeJumpSide(x: number, width: number): -1 | 0 | 1 {
  const span = Math.max(0, Number(width) || 0);
  const pos = Number(x);
  if (!span || !Number.isFinite(pos)) return 0;
  const band = Math.max(FLIP_EDGE_MIN_PX, span * FLIP_EDGE_FRACTION);
  if (pos <= band) return -1;
  if (pos >= span - band) return 1;
  return 0;
}

export function isDoubleTap(
  previousAt: number,
  previousSide: number,
  now: number,
  side: number,
  windowMs = FLIP_DOUBLE_MS,
): boolean {
  return Boolean(side) && side === previousSide && now - previousAt > 0 && now - previousAt <= windowMs;
}
