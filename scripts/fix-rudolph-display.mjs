/**
 * Fix Rudolph front cover (full PDF cover art, no red text band) on production.
 *
 * Usage: BOOKS_URL=https://books.spodazo.com railway run -- node scripts/fix-rudolph-display.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnv() {
  const path = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const base = process.env.BOOKS_URL || "https://books.spodazo.com";
const password = process.env.ADMIN_PASSWORD;
const cookieJar = "/tmp/spodazo-rudolph-fix.jar";

if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

function curlJson(args, body) {
  const argv = ["-sS", "-b", cookieJar, "-c", cookieJar, ...args];
  if (body !== undefined) {
    argv.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }
  return JSON.parse(execFileSync("curl", argv, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }) || "{}");
}

const login = curlJson(["-X", "POST", `${base}/api/admin/login`], { password });
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

const list = curlJson(["-X", "GET", `${base}/api/books`]);
const book = Array.isArray(list) ? list.find((b) => /rudolph/i.test(b.slug || "")) : null;
if (!book?.id) {
  console.error("Rudolph book not found");
  process.exit(1);
}

const full = curlJson(["-X", "GET", `${base}/api/books/${book.slug}`]);
const coverUrl = full.coverUrl || book.coverUrl;
const coverAsset = full.cover || book.cover || "Rudolph-cover.webp";

const coverLayout = {
  background: "#efdda6",
  elements: [
    {
      id: "cover-art",
      type: "image",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      imageAsset: coverAsset,
      imageUrl: coverUrl,
      fit: "contain",
      focusX: 50,
      focusY: 50,
      opacity: 100,
    },
  ],
};

const updated = curlJson(["-X", "PATCH", `${base}/api/admin/books/${book.id}`], {
  pageTemplate: "one-up",
  coverLayout,
});

if (updated.error) {
  console.error("PATCH failed:", updated);
  process.exit(1);
}

console.log("Updated", updated.slug, "— cover is full-page art only, pageTemplate one-up");
