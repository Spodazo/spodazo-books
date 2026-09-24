import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });
}

test("Books client never joins the system audio stack", () => {
  const root = join(import.meta.dirname, "..");
  const forbidden =
    /AudioContext|webkitAudioContext|new Audio\(|HTMLAudioElement|mediaSession|audioSession|navigator\.audioSession/;
  for (const file of walk(root)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const text = readFileSync(file, "utf8");
    assert.equal(forbidden.test(text), false, `${file} must stay silent`);
  }
});

test("Books HTML shell is ambient-only so iOS does not treat reload as playback", () => {
  const html = readFileSync(join(import.meta.dirname, "..", "..", "index.html"), "utf8");
  assert.match(html, /audioSession[\s\S]*ambient/);
  assert.equal(html.includes('"playback"'), false);
});
