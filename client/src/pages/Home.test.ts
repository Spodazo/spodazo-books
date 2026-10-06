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
});
