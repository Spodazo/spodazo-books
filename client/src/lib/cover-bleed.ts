/** Fit an image inside a box without cropping, centered. */
export function fittedBox(image: { width: number; height: number }, boxW: number, boxH: number) {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2 };
}
