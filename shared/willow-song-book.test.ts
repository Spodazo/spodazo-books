import assert from "node:assert/strict";
import test from "node:test";
import { visibleStoryPages } from "./reader-pages";
import {
  WILLOW_SONG_AUDIO_URL,
  WILLOW_SONG_TAGLINE,
  WILLOW_SONG_END_CUE,
  WILLOW_SONG_END_DELAY,
  WILLOW_SONG_LAST_WORD_AT,
  WILLOW_SONG_PAGE_COUNT,
  WILLOW_SONG_PAGE_CUES,
  WILLOW_SONG_TITLE_CUE,
  isWillowSongBook,
  needsWillowSongUpdate,
  willowSongPages,
  willowSongPayload,
  willowStoryPageCue,
} from "./willow-song-book";
import type { Book } from "./types";

test("Willow song pages follow the lyrics with the dance chorus after Hooray", () => {
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
  assert.equal(pages[6]?.imageAsset, "art-006.webp");
  assert.equal(pages[7]?.imageAsset, "willow-chorus-dance-roar.webp");
  assert.match(pages[7]?.paragraphs.join("\n") || "", /GRRR-ROAR! Roar, roar, little tiger, roar!/);
  assert.match(pages[7]?.paragraphs.join("\n") || "", /The loudest growl you've heard before!/);
  assert.equal(pages[8]?.imageAsset, "art-007.webp");
  assert.equal(pages[11]?.imageAsset, "willow-final-chorus.webp");
  assert.ok(!pages.some((page) => page.imageAsset === "willow-chorus-puff.webp"));
  assert.ok(isWillowSongBook({ slug: "willows-big-forest-adventure", title: "Willow", pages, tagline: "" }));
  assert.match(WILLOW_SONG_TAGLINE, /A Sing-Along Book!/);
  assert.equal(WILLOW_SONG_AUDIO_URL, "/media/audio/willows-forest-adventure.mp3");
});

test("Willow sing-along cues follow the recorded lyrics", () => {
  const visible = visibleStoryPages({ slug: "willows-big-forest-adventure", title: "Willow", pages: willowSongPages() });
  assert.equal(WILLOW_SONG_TITLE_CUE, 0);
  assert.equal(WILLOW_SONG_PAGE_CUES.length, visible.length);
  assert.equal(willowStoryPageCue(0), 8);
  assert.equal(willowStoryPageCue(4), 68);
  assert.equal(willowStoryPageCue(5), 83);
  assert.equal(willowStoryPageCue(6), 91);
  for (let i = 1; i < WILLOW_SONG_PAGE_CUES.length; i += 1) {
    assert.ok(WILLOW_SONG_PAGE_CUES[i] > WILLOW_SONG_PAGE_CUES[i - 1]);
  }
  assert.ok(WILLOW_SONG_PAGE_CUES[WILLOW_SONG_PAGE_CUES.length - 1] < WILLOW_SONG_LAST_WORD_AT);
  assert.equal(WILLOW_SONG_LAST_WORD_AT, 163);
  assert.equal(WILLOW_SONG_END_DELAY, 3);
  assert.equal(WILLOW_SONG_END_CUE, 166);
  assert.ok(WILLOW_SONG_END_CUE > WILLOW_SONG_LAST_WORD_AT);
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
  assert.match(next.tagline || "", /A Sing-Along Book!/);
  assert.match(next.titleLayout?.elements.find((item) => item.role === "tagline")?.text || "", /A Sing-Along Book!/);
  const missingSingAlong = {
    ...next,
    titleLayout: {
      elements: [{ id: "title-tagline", type: "text" as const, x: 1, y: 1, w: 10, h: 10, z: 1, text: "A little tiger.\nThe happiest hug... and so much more!", role: "tagline" as const }],
    },
  };
  assert.equal(needsWillowSongUpdate(missingSingAlong), true);
});
