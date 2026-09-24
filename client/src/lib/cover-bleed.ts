/** Fit an image inside a box without cropping, centered. */
export function fittedBox(image: { width: number; height: number }, boxW: number, boxH: number) {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2 };
}

/** Scale an image to cover a box, cropping overflow so backgrounds reach every edge. */
export function filledBox(image: { width: number; height: number }, boxW: number, boxH: number) {
  const scale = Math.max(boxW / image.width, boxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2 };
}

export type CoverBox = { width: number; height: number; x: number; y: number; leftGap: number; rightGap: number };

/** Fit the full cover height on the page; side gaps are filled separately. */
export function fitHeightBox(image: { width: number; height: number }, boxW: number, boxH: number): CoverBox {
  if (!image.width || !image.height) return { width: boxW, height: boxH, x: 0, y: 0, leftGap: 0, rightGap: 0 };
  const scale = boxH / image.height;
  const width = image.width * scale;
  const height = boxH;
  if (width > boxW) {
    const inner = fittedBox(image, boxW, boxH);
    return { ...inner, leftGap: inner.x, rightGap: boxW - inner.x - inner.width };
  }
  const x = (boxW - width) / 2;
  return { width, height, x, y: 0, leftGap: x, rightGap: boxW - x - width };
}

/** Source strip width for extending textured cover edges into side gaps. */
export function sideBleedStrip(sourceWidth: number) {
  return Math.max(1, Math.min(Math.round(sourceWidth * 0.08), 64));
}
