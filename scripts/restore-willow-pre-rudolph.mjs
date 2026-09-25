/**
 * Restore Willow on production from scripts/willow-pre-rudolph-snapshot.json
 * (24 Sep 2026, before Rudolph import and later editor accidents).
 *
 * Usage: BOOKS_URL=https://books.spodazo.com railway run -- node scripts/restore-willow-pre-rudolph.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const base = process.env.BOOKS_URL || "https://books.spodazo.com";
const password = process.env.ADMIN_PASSWORD;
const cookieJar = "/tmp/spodazo-willow-prerudolph.jar";
const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), "willow-pre-rudolph-snapshot.json");

if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

function curl(args, body) {
  const argv = ["-sS", "-b", cookieJar, "-c", cookieJar, ...args];
  if (body !== undefined) {
    argv.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }
  return execFileSync("curl", argv, { encoding: "utf8" });
}

const src = JSON.parse(readFileSync(snapshotPath, "utf8"));
const body = {
  title: src.title,
  slug: src.slug,
  tagline: src.tagline,
  author: src.author,
  date: src.date,
  pages: src.pages,
  color: src.color,
  hidden: src.hidden,
  published: src.published,
  audience: src.audience,
  pageTemplate: src.pageTemplate,
  characterRender: src.characterRender,
  pageBackground: src.pageBackground,
  pageTexture: src.pageTexture,
  spreadBackground: src.spreadBackground,
  textFont: src.textFont,
  textColor: src.textColor,
  titleLayout: src.titleLayout,
  coverLayout: src.coverLayout,
  backCoverLayout: src.backCoverLayout,
  endLayout: src.endLayout,
  coverUrl: `/media/images/${encodeURIComponent(src.cover)}`,
  pdfUrl: `/media/pdfs/${src.pdf}`,
};

const login = JSON.parse(curl(["-X", "POST", `${base}/api/admin/login`], { password }));
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

const updated = JSON.parse(curl(["-X", "PATCH", `${base}/api/admin/books/${src.id}`], body));
if (updated.error) {
  console.error("PATCH failed:", updated);
  process.exit(1);
}

console.log("Restored Willow —", updated.pages?.length, "pages,", updated.pages?.[1]?.elements?.[1]?.text?.slice(0, 48));
