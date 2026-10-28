import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("portrait flip books fade in a landscape hint and dismiss on the cover", async () => {
  const hint = await readFile(new URL("../../public/flipbooks/landscape-hint.js", import.meta.url), "utf8");
  assert.match(hint, /For the best experience, turn your phone to landscape mode/);
  assert.match(hint, /HOLD_MS = 5000/);
  assert.match(hint, /pointerdown/);
  assert.match(hint, /orientation:portrait/);

  const mount = await readFile(new URL("./facsimile-flipbook.js", import.meta.url), "utf8");
  const reader = await readFile(new URL("./reader.js", import.meta.url), "utf8");
  const revised = await readFile(new URL("../../../server/revised-flipbook.ts", import.meta.url), "utf8");
  const beThou = await readFile(new URL("../../public/flipbooks/be-thou-my-vision/index.html", import.meta.url), "utf8");
  const rudolph = await readFile(new URL("../../public/flipbooks/rudolph-the-red-nosed-reindeer/index.html", import.meta.url), "utf8");

  for (const src of [mount, reader, revised]) {
    assert.match(src, /\/flipbooks\/landscape-hint\.js/);
  }
  assert.match(beThou, /\.\.\/landscape-hint\.js/);
  assert.match(rudolph, /\.\.\/landscape-hint\.js/);
});
