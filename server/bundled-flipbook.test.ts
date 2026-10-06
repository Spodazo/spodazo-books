import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { BE_THOU_SONG_NAV } from "../shared/song-nav";
import {
  prepareBundledDraft,
  publishBundledDraft,
  readBundleMeta,
  updateDraftSongNav,
  writeBundledFlipbookFromPdf,
} from "./bundled-flipbook";
import { ensureDataDirs } from "./paths";

async function tinyPdf(dest: string): Promise<void> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]);
  doc.addPage([400, 600]);
  fs.writeFileSync(dest, await doc.save());
}

test("writeBundledFlipbookFromPdf rasterizes pages and injects song nav", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-b1-"));
  const pdfPath = path.join(dir, "Be-Thou-My-Vision-Songbook.pdf");
  await tinyPdf(pdfPath);
  const out = path.join(dir, "flipbook");
  const meta = await writeBundledFlipbookFromPdf({
    pdfPath,
    destDir: out,
    title: "Be Thou My Vision Songbook",
    songNav: BE_THOU_SONG_NAV,
  });
  assert.equal(meta.pageCount, 2);
  assert.equal(fs.existsSync(path.join(out, "pages", "p-01.jpg")), true);
  assert.equal(fs.existsSync(path.join(out, "pages", "p-02.jpg")), true);
  const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.match(html, /var SONG_LIST_PAGE = 3;/);
  assert.match(html, /01 Be Thou My Vision/);
  assert.match(html, /attachFlipbookMobileZoom/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("admin draft publish writes a runtime bundle", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-b2-"));
  process.env.BOOKS_DATA_DIR = dir;
  ensureDataDirs();
  const pdfPath = path.join(dir, "songbook.pdf");
  await tinyPdf(pdfPath);
  const draft = await prepareBundledDraft(pdfPath, "Songbook.pdf");
  assert.match(draft.draftId, /^draft-/);
  assert.equal(draft.pageCount, 2);
  updateDraftSongNav(draft.draftId, { songListPage: 1, entries: [{ page: 2, top: 40, label: "Song A" }] }, "Songbook");
  const published = await publishBundledDraft({
    draftId: draft.draftId,
    dir: "test-songbook",
    title: "Songbook",
    songNav: { songListPage: 1, entries: [{ page: 2, top: 40, label: "Song A" }] },
  });
  assert.equal(published.dir, "test-songbook");
  const meta = readBundleMeta("test-songbook");
  assert.equal(meta.songNav.entries[0]?.label, "Song A");
  assert.equal(fs.existsSync(path.join(dir, "bundled-flipbooks", "test-songbook", "pages", "p-01.jpg")), true);
  assert.ok(published.coverAsset);
  delete process.env.BOOKS_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});
