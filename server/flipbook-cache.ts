import fs from "fs";
import path from "path";
import type { Response } from "express";

export const FLIPBOOK_CACHE_BUST_SCRIPT = "/flipbooks/cache-bust.js";

export const FLIPBOOK_NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export function webPublicDir(): string {
  return process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "dist/public")
    : path.resolve(process.cwd(), "client/public");
}

/** Insert the shared cache-bust script into a bundled flipbook document. */
export function withFlipbookCacheBust(html: string): string {
  if (html.includes(FLIPBOOK_CACHE_BUST_SCRIPT)) return html;
  const tag = `<script src="${FLIPBOOK_CACHE_BUST_SCRIPT}"></script>`;
  if (html.includes("<head>")) return html.replace("<head>", `<head>${tag}`);
  return `${tag}${html}`;
}

export function readFlipbookIndex(dirName: string): string | null {
  const safe = path.basename(dirName);
  if (!safe || safe !== dirName) return null;
  const file = path.join(webPublicDir(), "flipbooks", safe, "index.html");
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export function sendFlipbookHtml(res: Response, html: string): void {
  res.set(FLIPBOOK_NO_STORE);
  res.type("html").send(withFlipbookCacheBust(html));
}
