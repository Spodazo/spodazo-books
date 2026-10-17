import assert from "node:assert/strict";
import test from "node:test";
import {
  WILLOW_SONG_AUDIO_URL,
  WILLOW_SONG_PAGE_COUNT,
  isWillowSongBook,
  needsWillowSongUpdate,
  willowSongPages,
  willowSongPayload,
} from "./willow-song-book";
import type { Book } from "./types";

test("Willow song pages follow the lyrics including extra chorus art", () => {
  const pages = willowSongPages();
  const text = pages.map((page) => page.paragraphs.join("\n")).join("\n---\n");
  assert.equal(pages.length, WILLOW_SONG_PAGE_COUNT);
  assert.match(text, /One sunny day, the forest was bright/);
  assert.match(text, /GRRR-ROAR! Roar, roar, little tiger, roar!/);
  assert.match(text, /Was that me\?/);
  assert.match(text, /I wish Mummy and Mamma were here/);
  assert.match(text, /Hugs for Willow, and hugs galore!/);
  assert.match(text, /The happiest hug\.\.\. and so much more!/);
  assert.equal(pages[5]?.imageAsset, "willow-chorus-bear-falls.webp");
  assert.equal(pages[6]?.imageAsset, "willow-chorus-puff.webp");
  assert.equal(pages[8]?.imageAsset, "willow-chorus-dance-roar.webp");
  assert.equal(pages[12]?.imageAsset, "willow-final-chorus.webp");
  assert.ok(isWillowSongBook({ slug: "willows-big-forest-adventure", title: "Willow", pages, tagline: "" }));
  assert.equal(WILLOW_SONG_AUDIO_URL, "/media/audio/willows-forest-adventure.mp3");
});

test("needsWillowSongUpdate is true until the chorus pages are in place", () => {
  const old = {
    id: "book-1",
    slug: "willows-big-forest-adventure",
    title: "Willow’s Big Forest Adventure",
    tagline: "A little tiger. A very big roar.",
    author: "",
    date: "",
    cover: "",
    pdf: "",
    color: "honey",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children" as const,
    pageTemplate: "one-up" as const,
    characterRender: "scene" as const,
    pageBackground: "",
    pageTexture: "",
    spreadBackground: "",
    textFont: "",
    textColor: "",
    titleLayout: { elements: [{ id: "title-tagline", type: "text" as const, x: 1, y: 1, w: 10, h: 10, z: 1, text: "old", role: "tagline" as const }] },
    coverLayout: { elements: [{ id: "cover-tagline", type: "text" as const, x: 1, y: 1, w: 10, h: 10, z: 1, text: "old", role: "tagline" as const }] },
    backCoverLayout: { elements: [] },
    endLayout: { elements: [] },
    pages: willowSongPages().slice(0, 10),
  } satisfies Book;
  assert.equal(needsWillowSongUpdate(old), true);
  const next = { ...old, ...willowSongPayload(old), pages: willowSongPages() };
  assert.equal(needsWillowSongUpdate(next), false);
});
