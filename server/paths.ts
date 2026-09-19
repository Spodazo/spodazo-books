import fs from "fs";
import path from "path";

export function dataDir(): string {
  return process.env.BOOKS_DATA_DIR || path.resolve(process.cwd(), ".books-data");
}

export function imagesDir(): string {
  return path.join(dataDir(), "images");
}

export function pdfsDir(): string {
  return path.join(dataDir(), "pdfs");
}

export function faviconDir(): string {
  return path.join(dataDir(), "favicons");
}

export function catalogPath(): string {
  return path.join(dataDir(), "catalog.json");
}

export function ensureDataDirs(): void {
  for (const dir of [dataDir(), imagesDir(), pdfsDir(), faviconDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function syncBundledMedia(): void {
  ensureDataDirs();
  copyDir(path.resolve(process.cwd(), "media/images"), imagesDir());
  copyDir(path.resolve(process.cwd(), "media/pdfs"), pdfsDir());
}

function copyDir(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  for (const name of fs.readdirSync(srcDir)) {
    if (name.startsWith(".")) continue;
    fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  }
}

export function safeFileName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._ ()|-]/g, "_");
}

export function uniqueFileName(dir: string, original: string): string {
  const safe = safeFileName(original);
  let name = safe;
  let i = 2;
  while (fs.existsSync(path.join(dir, name))) {
    const ext = path.extname(safe);
    const stem = ext ? safe.slice(0, -ext.length) : safe;
    name = `${stem}-${i++}${ext}`;
  }
  return name;
}
