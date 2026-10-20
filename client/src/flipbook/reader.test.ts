import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Willow title page has a Sing Along control wired to the song", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("./reader-runtime.js", import.meta.url), "utf8");
  const css = await readFile(new URL("./reader.css", import.meta.url), "utf8");
  assert.match(reader, /WILLOW_SONG_AUDIO_URL/);
  assert.match(reader, /class="sing-along"/);
  assert.match(reader, /data-cue/);
  assert.match(reader, /WILLOW_SONG_END_CUE/);
  assert.match(reader, /Sing Along/);
  assert.match(runtime, /toggleSingAlong/);
  assert.match(runtime, /followSong/);
  assert.match(runtime, /pageForSongTime/);
  assert.match(runtime, /song\.ended/);
  assert.match(runtime, /end-page/);
  assert.match(runtime, /\.sing-along/);
  assert.match(css, /\.sing-along/);
});
