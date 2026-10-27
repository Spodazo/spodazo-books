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

export function audioDir(): string {
  return path.join(dataDir(), "audio");
}

export function faviconDir(): string {
  return path.join(dataDir(), "favicons");
}

export function catalogPath(): string {
  return path.join(dataDir(), "catalog.json");
}

export function ensureDataDirs(): void {
  for (const dir of [dataDir(), imagesDir(), pdfsDir(), audioDir(), faviconDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function syncBundledMedia(): void {
  ensureDataDirs();
  copyDir(path.resolve(process.cwd(), "media/images"), imagesDir());
  copyDir(path.resolve(process.cwd(), "media/pdfs"), pdfsDir());
  copyDir(path.resolve(process.cwd(), "media/audio"), audioDir());
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

/** A new file name for every revised upload, so page-001.jpg can never be reused. */
export function revisionPageFileName(revision: string, pageNumber: number): string {
  const stamp = String(revision || "rev").replace(/[^a-zA-Z0-9]/g, "") || "rev";
  return `${stamp}-page-${String(Math.max(1, pageNumber)).padStart(3, "0")}.jpg`;
}

/** Create a new file. An existing name is left untouched and the next free name is used. */
export async function writeExclusiveFile(dir: string, preferred: string, data: Buffer): Promise<string> {
  await fs.promises.mkdir(dir, { recursive: true });
  const safe = safeFileName(preferred);
  const ext = path.extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const name = attempt === 0 ? safe : `${stem}-${attempt + 1}${ext}`;
    const dest = path.join(dir, name);
    try {
      const handle = await fs.promises.open(dest, "wx");
      try {
        await handle.writeFile(data);
      } finally {
        await handle.close();
      }
      return name;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw err;
    }
  }
  throw new Error("Could not store a new file.");
}
