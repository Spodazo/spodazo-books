import fs from "fs";
import path from "path";
import sharp from "sharp";
import { dataDir, faviconDir, imagesDir, pdfsDir, uniqueFileName } from "./paths";

function usableFile(full: string): string | null {
  if (!fs.existsSync(full)) return null;
  const size = fs.statSync(full).size;
  return size > 32 ? full : null;
}

export function localImagePath(filename: string): string | null {
  if (!filename) return null;
  return usableFile(path.join(imagesDir(), path.basename(filename)));
}

export function localPdfPath(filename: string): string | null {
  if (!filename) return null;
  return usableFile(path.join(pdfsDir(), path.basename(filename)));
}

export function assetVersion(): string {
  return process.env.BUILD_ID || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_DEPLOYMENT_ID || "dev";
}

export const HOME_CARD_WIDTH = 720;
export const COLLECTION_COVER_WIDTH = 1200;
const IMAGE_WIDTHS = new Set([360, HOME_CARD_WIDTH, COLLECTION_COVER_WIDTH]);

export function imageUrl(filename: string, width?: number): string {
  if (!filename) return "";
  const params = new URLSearchParams({ v: assetVersion() });
  if (width && IMAGE_WIDTHS.has(width)) params.set("w", String(width));
  return `/media/images/${encodeURIComponent(filename)}?${params}`;
}

export function pdfUrl(filename: string): string {
  if (!filename) return "";
  return `/media/pdfs/${encodeURIComponent(filename)}`;
}

export function parseImageWidth(value: unknown): number | undefined {
  const width = Number(value);
  return IMAGE_WIDTHS.has(width) ? width : undefined;
}

export async function preparedImagePath(full: string, width?: number): Promise<string> {
  if (!width || !fs.existsSync(full)) return full;
  const thumbs = path.join(dataDir(), "image-thumbs");
  fs.mkdirSync(thumbs, { recursive: true });
  const stamp = Math.round(fs.statSync(full).mtimeMs);
  const dest = path.join(thumbs, `${width}-${stamp}-${path.basename(full, path.extname(full))}.webp`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 32) return dest;
  const tmp = `${dest}.tmp`;
  await sharp(full)
    .rotate()
    .resize(width, width, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(tmp);
  fs.renameSync(tmp, dest);
  return dest;
}

export async function warmHomeCardImages(
  books: Array<{ cover?: string }>,
  extra: Array<string | undefined> = [],
): Promise<void> {
  const names = new Set<string>();
  for (const book of books) {
    if (book.cover) names.add(book.cover);
  }
  for (const name of extra) {
    if (name) names.add(name);
  }
  await Promise.all(
    [...names].map(async (name) => {
      const full = localImagePath(name);
      if (!full) return;
      try {
        await preparedImagePath(full, HOME_CARD_WIDTH);
      } catch {
        /* listing and boot must stay fast */
      }
    }),
  );
}

export function shouldConvertImageUpload(file: {
  fieldname: string;
  mimetype: string;
  originalname: string;
}): boolean {
  if (file.fieldname === "asset" || file.fieldname === "pdf") return false;
  return file.mimetype.startsWith("image/") || /\.(jpe?g|png|gif|webp|tiff?|avif|bmp)$/i.test(file.originalname);
}

export async function convertUploadedImage(filename: string, dir = imagesDir()): Promise<string> {
  const source = path.join(dir, filename);
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  const destName = ext.toLowerCase() === ".webp" ? filename : uniqueFileName(dir, `${stem}.webp`);
  const dest = path.join(dir, destName);
  const tmp = `${dest}.converting`;
  await sharp(source)
    .rotate()
    .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(tmp);
  try {
    fs.renameSync(tmp, dest);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* already gone */
    }
    throw err;
  }
  if (dest !== source) fs.unlinkSync(source);
  return destName;
}

function writeAtomic(full: string, body: Buffer) {
  const tmp = `${full}.preparing`;
  fs.writeFileSync(tmp, body);
  try {
    fs.renameSync(tmp, full);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* already gone */
    }
    throw err;
  }
}

export const FAVICON_PNGS = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "favicon-96x96.png", size: 96 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
] as const;

export const FAVICON_PUBLIC_FILES = ["favicon.ico", ...FAVICON_PNGS.map((item) => item.name)] as const;

const ICO_PNG_SIZES = new Set([16, 32, 48]);

export function encodeIco(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + entries.length;
  const images: Buffer[] = [];
  pngs.forEach((png, index) => {
    const width = png.length >= 24 ? png.readUInt32BE(16) : 0;
    const height = png.length >= 24 ? png.readUInt32BE(20) : 0;
    const at = index * 16;
    entries.writeUInt8(width >= 256 ? 0 : width, at);
    entries.writeUInt8(height >= 256 ? 0 : height, at + 1);
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(png.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    images.push(png);
    offset += png.length;
  });
  return Buffer.concat([header, entries, ...images]);
}

export function faviconPublicPath(name: string): string | null {
  if (!FAVICON_PUBLIC_FILES.includes(name as (typeof FAVICON_PUBLIC_FILES)[number])) return null;
  const full = path.join(faviconDir(), name);
  return fs.existsSync(full) ? full : null;
}

export async function prepareFaviconSet(filename: string): Promise<string[]> {
  const source = filename ? path.join(imagesDir(), path.basename(filename)) : "";
  if (!source || !fs.existsSync(source) || fs.statSync(source).size < 32) {
    throw new Error("Favicon image not found");
  }
  const destDir = faviconDir();
  fs.mkdirSync(destDir, { recursive: true });
  const icoPngs: Buffer[] = [];
  for (const item of FAVICON_PNGS) {
    const png = await sharp(source)
      .rotate()
      .resize(item.size, item.size, { fit: "cover", position: "left" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeAtomic(path.join(destDir, item.name), png);
    if (ICO_PNG_SIZES.has(item.size)) icoPngs.push(png);
  }
  writeAtomic(path.join(destDir, "favicon.ico"), encodeIco(icoPngs));
  return [...FAVICON_PUBLIC_FILES];
}
