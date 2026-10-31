#!/usr/bin/env node
/**
 * Estimate when each story page’s last word note ends in the Rudolph MP3.
 * Run: node scripts/rudolph-sync-story-cues.mjs [path/to/mp3]
 */
import { spawnSync } from "node:child_process";
import { RUDOLPH_STORY_LAST_WORDS } from "../shared/rudolph-story-sync.ts";

const mp3 = process.argv[2] || "media/audio/rudolph-the-red-nosed-reindeer.mp3";

const raw = spawnSync(
  "ffmpeg",
  ["-v", "error", "-i", mp3, "-ac", "1", "-ar", "16000", "-af", "highpass=f=200,lowpass=f=3500", "-f", "s16le", "-"],
  { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
);
if (raw.status !== 0) {
  console.error("ffmpeg failed");
  process.exit(1);
}
const samples = new Int16Array(raw.stdout.buffer, raw.stdout.byteOffset, raw.stdout.length / 2);
const sr = 16000;
const hop = Math.floor(sr * 0.05);
const dt = hop / sr;
const vals = [];
for (let i = 0; i + hop <= samples.length; i += hop) {
  let e = 0;
  for (let j = 0; j < hop; j += 1) {
    const s = samples[i + j];
    e += s * s;
  }
  vals.push(Math.sqrt(e / hop));
}
const mx = Math.max(...vals) || 1;

function noteEndAfter(t0, t1, thresh = 0.28, sustain = 0.35) {
  const i0 = Math.floor(t0 / dt);
  const i1 = Math.floor(t1 / dt);
  let peakI = i0;
  for (let i = i0; i < i1; i += 1) {
    if (vals[i] > vals[peakI]) peakI = i;
  }
  let lowSince = null;
  for (let i = peakI; i < vals.length; i += 1) {
    const t = i * dt;
    if (t > t1 + 8) break;
    if (vals[i] / mx < thresh) {
      if (lowSince == null) lowSince = t;
      if (t - lowSince >= sustain) return Math.round(lowSince * 100) / 100;
    } else lowSince = null;
  }
  return Math.round(t1 * 100) / 100;
}

/** Rough search windows (seconds) per story page last word on v2. */
const WINDOWS = {
  16: [305, 325],
  17: [325, 345],
  18: [355, 372],
  19: [378, 395],
};

console.log("Story page last-word note ends (estimated):\n");
for (const [page, word] of Object.entries(RUDOLPH_STORY_LAST_WORDS)) {
  const p = Number(page);
  const [a, b] = WINDOWS[p] || [0, 0];
  const end = noteEndAfter(a, b);
  console.log(`  page ${p} (“${word}”): ~${end}s  → turn to page ${p + 1} at ${end}s`);
}
