import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home page uses Admin sortOrder and does not zoom covers on hover", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../index.css", import.meta.url), "utf8");
  assert.match(source, /sortBooksByAdminOrder/);
  assert.doesNotMatch(source, /groupBooksByAudience/);
  assert.doesNotMatch(source, /is-cover-zoomed/);
  assert.doesNotMatch(source, /useLibraryCoverZoomEnabled/);
  assert.doesNotMatch(css, /is-cover-zoomed/);
  assert.doesNotMatch(css, /scale\(1\.2\)/);
  assert.match(css, /\.library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.doesNotMatch(css, /minmax\(240px,\s*280px\)/);
  assert.match(css, /\.cover-face:has\(\.cover-pdf\)\s*\{[^}]*aspect-ratio:\s*auto/);
  assert.match(css, /\.cover-face:has\(\.cover-pdf\)\s*\{[^}]*container-type:\s*normal/);
  assert.match(css, /\.book-card\s*\{[^}]*min-width:\s*0/);
  assert.match(source, /homeCoverLayout/);
  assert.match(source, /coverWidth/);
  assert.doesNotMatch(source, /playLibraryEnter|willowFrontCoverLayout/);
});
