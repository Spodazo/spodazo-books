import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a cold mobile song start stays quiet through the header, then fades in", async () => {
  const src = await readFile(new URL("../../public/flipbooks/play-book-song.js", import.meta.url), "utf8");
  const sandbox: { playBookSong?: (audio: FakeAudio) => Promise<void> } = {};
  const run = new Function("window", "navigator", `${src}; return window.playBookSong;`);
  sandbox.playBookSong = run(
    { navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 } },
    { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 },
  );
  const audio = fakeAudio();
  const started = sandbox.playBookSong!(audio);
  assert.equal(audio.volume, 0);
  await started;
  assert.equal(audio.volume, 0);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(audio.volume > 0.9);
});

test("desktop and mid-song starts stay at full volume", async () => {
  const src = await readFile(new URL("../../public/flipbooks/play-book-song.js", import.meta.url), "utf8");
  const run = new Function("window", "navigator", `${src}; return window.playBookSong;`);
  const play = run(
    { navigator: { userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 } },
    { userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 },
  ) as (audio: FakeAudio) => Promise<void>;
  const audio = fakeAudio();
  await play(audio);
  assert.equal(audio.volume, 1);

  const phone = run(
    { navigator: { userAgent: "Mozilla/5.0 (iPhone)", platform: "iPhone", maxTouchPoints: 5 } },
    { userAgent: "Mozilla/5.0 (iPhone)", platform: "iPhone", maxTouchPoints: 5 },
  ) as (audio: FakeAudio) => Promise<void>;
  const later = fakeAudio();
  later.currentTime = 12;
  await phone(later);
  assert.equal(later.volume, 1);
});

test("Willow, Rudolph, and uploaded song books use the clean opener", async () => {
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("./reader-runtime.js", import.meta.url), "utf8");
  const engine = await readFile(new URL("./facsimile-flipbook-engine.js", import.meta.url), "utf8");
  const mount = await readFile(new URL("./facsimile-flipbook.js", import.meta.url), "utf8");
  const revised = await readFile(new URL("../../../server/revised-flipbook.ts", import.meta.url), "utf8");
  const rudolph = await readFile(new URL("../../public/flipbooks/rudolph-the-red-nosed-reindeer/index.html", import.meta.url), "utf8");
  assert.match(reader, /\/flipbooks\/play-book-song\.js/);
  assert.match(mount, /\/flipbooks\/play-book-song\.js/);
  assert.match(revised, /\/flipbooks\/play-book-song\.js/);
  assert.match(rudolph, /\.\.\/play-book-song\.js/);
  assert.match(runtime, /playBookSong\(audio\)/);
  assert.match(engine, /playBookSong\(song\)/);
  assert.match(rudolph, /playBookSong\(song\)/);
  assert.doesNotMatch(runtime, /audio\.play\(\)/);
  assert.doesNotMatch(engine, /song\.play\(\)/);
});

type FakeAudio = {
  currentTime: number;
  ended: boolean;
  paused: boolean;
  muted: boolean;
  volume: number;
  play: () => Promise<void>;
};

function fakeAudio(): FakeAudio {
  return {
    currentTime: 0,
    ended: false,
    paused: true,
    muted: false,
    volume: 1,
    play() {
      this.paused = false;
      return Promise.resolve();
    },
  };
}
