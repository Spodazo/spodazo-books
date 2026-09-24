import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { claimAmbientAudioSession } from "./ambientAudio";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });
}

test("Books asks the phone to mix, never to take over music", () => {
  const session = { type: "auto" };
  assert.equal(claimAmbientAudioSession(session), "ambient");
  assert.equal(session.type, "ambient");
});

test("Books client code never creates audio or a playback session", () => {
  const root = join(import.meta.dirname, "..");
  const forbidden = /AudioContext|webkitAudioContext|new Audio\(|HTMLAudioElement|mediaSession/;
  for (const file of walk(root)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const text = readFileSync(file, "utf8");
    if (file.endsWith("ambientAudio.ts")) {
      assert.match(text, /ambient/);
      assert.equal(text.includes('"playback"'), false);
      continue;
    }
    assert.equal(forbidden.test(text), false, `${file} must stay silent`);
  }
});
