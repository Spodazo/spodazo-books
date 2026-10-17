import type { Book, BookPage, PageElement, PageLayout } from "./types";
import { isWillowBook } from "./reader-pages";

export const WILLOW_SONG_PAGE_COUNT = 14;
export const WILLOW_SONG_TAGLINE = "A little tiger. A very big roar.\nThe happiest hug... and so much more!";
export const WILLOW_SONG_MARKER = "Hugs for Willow, and hugs galore!";

const CHORUS = [
  "GRRR-ROAR! Roar, roar, little tiger, roar!",
  "(Grrr-roar!)",
  "",
  "The loudest growl you've heard before!",
  "(Grrr-roar!)",
  "",
  "Plant your paws and puff your chest,",
  "Be brave and give it your best!",
].join("\n");

const DANCE_CHORUS = [
  "Roar, roar, little tiger, roar!",
  "(Grrr-roar!)",
  "",
  "Plant your paws and puff your chest,",
  "Be brave and give it your best!",
].join("\n");

function art(id: string, asset: string, box: { x?: number; y?: number; w?: number; h?: number } = {}): PageElement {
  return {
    id,
    type: "image",
    x: box.x ?? 0,
    y: box.y ?? 0,
    w: box.w ?? 49,
    h: box.h ?? 100,
    z: 1,
    imageAsset: asset,
    imageUrl: "",
    fit: "cover",
    focusX: 50,
    focusY: 50,
    opacity: 100,
  };
}

function body(id: string, text: string, box: { x?: number; y?: number; w?: number; h?: number; fontSize?: number } = {}): PageElement {
  return {
    id,
    type: "text",
    x: box.x ?? 56,
    y: box.y ?? 12,
    w: box.w ?? 38,
    h: box.h ?? 76,
    z: 2,
    text,
    imageUrl: "",
    fontSize: box.fontSize ?? 4.4,
    fontFamily: "",
    color: "",
    align: "left",
    frame: "",
    frameColor: "",
    role: "body",
  };
}

function sticker(id: string, asset: string, box: { x: number; y: number; w: number; h: number }): PageElement {
  return {
    id,
    type: "image",
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    z: 3,
    imageAsset: asset,
    imageUrl: "",
    fit: "cover",
    focusX: 50,
    focusY: 50,
    opacity: 100,
  };
}

function page(
  index: number,
  title: string,
  text: string,
  imageAsset: string,
  extras: PageElement[] = [],
  opts: { position?: BookPage["position"]; artBox?: { x?: number; y?: number; w?: number; h?: number }; textBox?: { x?: number; y?: number; w?: number; h?: number; fontSize?: number } } = {},
): BookPage {
  const id = `page-${index}`;
  const paragraphs = [text.replace(/\n{3,}/g, "\n\n").trim()];
  return {
    id,
    sourcePage: index,
    kind: "story",
    title,
    paragraphs,
    imageAsset,
    fullPageAsset: imageAsset,
    imageUrl: "",
    fullPageUrl: "",
    position: opts.position ?? "bottom",
    focalPoint: "50% 50%",
    elements: [art(`${id}-art`, imageAsset, opts.artBox), body(`${id}-text`, paragraphs[0], opts.textBox), ...extras],
    background: "",
  };
}

export function willowSongPages(): BookPage[] {
  return [
    page(1, "Willow’s Forest Adventure", "Willow’s Big\n\nForest Adventure\n\nA little tiger. A very big roar.\nThe happiest hug... and so much more!", "art-001.webp", [], {
      position: "top",
      artBox: { x: 0, y: 0, w: 50, h: 100 },
      textBox: { x: 56, y: 18, w: 38, h: 64, fontSize: 4.6 },
    }),
    page(
      2,
      "Verse 1",
      [
        "One sunny day, the forest was bright,",
        "Willow went strolling, what a lovely sight!",
        "",
        "With Mummy and Mamma, a stripy crew,",
        "A butterfly danced right into view!",
        "",
        "“Wait for me!” she giggled with glee,",
        "Chasing that butterfly round the tree!",
      ].join("\n"),
      "art-002.webp",
      [sticker("el-willow-butterfly", "Butterfly-1.webp", { x: 91.85, y: 85.58, w: 8, h: 14.42 })],
      {
        position: "top",
        artBox: { x: 0, y: 0, w: 49.07, h: 99.58 },
        textBox: { x: 55.23, y: 8.5, w: 41, h: 80, fontSize: 4.2 },
      },
    ),
    page(
      3,
      "Verse 2",
      [
        "Then the butterfly fluttered high,",
        "Where was everyone? Oh my, oh my!",
        "",
        "“Mummy? Mamma?” Willow cried,",
        "But no one answered, far and wide.",
      ].join("\n"),
      "art-003.webp",
      [sticker("el-willow-butterfly-2", "Butterfly-1-3.webp", { x: 46.29, y: 3.58, w: 8, h: 8 })],
      {
        position: "top",
        artBox: { x: 0, y: 0, w: 48.92, h: 100 },
        textBox: { x: 57.4, y: 18, w: 35.8, h: 64, fontSize: 4.4 },
      },
    ),
    page(
      4,
      "Verse 3",
      [
        "Rustle, rustle... CRACK! What's that sound?",
        "A big brown bear came creeping around!",
        "",
        "Her knees went wobbly, shake, shake, shake,",
        "But she took a breath for goodness' sake!",
      ].join("\n"),
      "art-004.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 48.97, h: 100 },
        textBox: { x: 55.8, y: 16, w: 37.9, h: 72, fontSize: 4.4 },
      },
    ),
    page(
      5,
      "Pre-Chorus",
      ["She planted her paws, she stood up tall,", "And out came the biggest growl of all!"].join("\n\n"),
      "art-005.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 48.91, h: 100 },
        textBox: { x: 56.15, y: 22, w: 38.5, h: 56, fontSize: 4.6 },
      },
    ),
    page(
      6,
      "Chorus",
      CHORUS,
      "willow-chorus-bear-falls.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 49, h: 100 },
        textBox: { x: 55.5, y: 10, w: 39, h: 80, fontSize: 4.2 },
      },
    ),
    page(
      7,
      "Chorus — Roar",
      DANCE_CHORUS,
      "willow-chorus-puff.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 49, h: 100 },
        textBox: { x: 55.5, y: 16, w: 39, h: 68, fontSize: 4.4 },
      },
    ),
    page(
      8,
      "Break",
      ['The bear jumped back and ran away,', "“Was that me?!” she whispered... “Hooray!”"].join("\n\n"),
      "art-006.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 48.91, h: 99.54 },
        textBox: { x: 56.24, y: 22, w: 38, h: 56, fontSize: 4.6 },
      },
    ),
    page(
      9,
      "Chorus — Dance",
      CHORUS,
      "willow-chorus-dance-roar.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 49, h: 100 },
        textBox: { x: 55.5, y: 10, w: 39, h: 80, fontSize: 4.2 },
      },
    ),
    page(
      10,
      "Bridge",
      ['She curled up small in a leafy bed,', "“I wish Mummy and Mamma were here,” she said."].join("\n\n"),
      "art-007.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 48.87, h: 99.62 },
        textBox: { x: 56, y: 24, w: 37.7, h: 52, fontSize: 4.6 },
      },
    ),
    page(
      11,
      "Verse 4",
      [
        "Then a roar rolled in through the trees,",
        "“Willow! Willow!” on the breeze!",
        "",
        "Her ears popped up, her voice rang clear,",
        "“I'm here! I'm here! Over here!”",
      ].join("\n"),
      "art-008.webp",
      [sticker("el-willow-moms", "Moms-1-2.webp", { x: 81.5, y: 84.31, w: 10.14, h: 15.69 })],
      {
        artBox: { x: 0, y: 0, w: 48.74, h: 99.74 },
        textBox: { x: 57.78, y: 14, w: 34.73, h: 68, fontSize: 4.4 },
      },
    ),
    page(
      12,
      "Verse 4",
      ["Mummy and Mamma came running fast,", "Found their Willow safe at last!"].join("\n\n"),
      "art-009.webp",
      [sticker("el-willow-running", "Willow Talde-1.webp", { x: 88.94, y: 82.62, w: 11.06, h: 17.38 })],
      {
        artBox: { x: 0, y: 0, w: 48.82, h: 100 },
        textBox: { x: 56.92, y: 24, w: 35.13, h: 50, fontSize: 4.6 },
      },
    ),
    page(
      13,
      "Final Chorus",
      [
        "GRRR-ROAR! Roar, roar, little tiger, roar!",
        "(Grrr-roar!)",
        "",
        "Hugs for Willow, and hugs galore!",
        "(Grrr-roar!)",
        "",
        "Stripy hugs, so warm and tight,",
        "Now the whole wide forest feels just right!",
      ].join("\n"),
      "willow-final-chorus.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 49, h: 100 },
        textBox: { x: 55.5, y: 10, w: 39, h: 80, fontSize: 4.2 },
      },
    ),
    page(
      14,
      "Outro",
      ["A little tiger, a very big roar,", "The happiest hug... and so much more!"].join("\n\n"),
      "art-010.webp",
      [],
      {
        artBox: { x: 0, y: 0, w: 48.97, h: 100 },
        textBox: { x: 56.13, y: 24, w: 38, h: 52, fontSize: 4.6 },
      },
    ),
  ];
}

function layoutHasSongTagline(layout?: PageLayout): boolean {
  return (layout?.elements || []).some((item) => item.role === "tagline" && String(item.text || "").includes("so much more"));
}

export function isWillowSongBook(book: Pick<Book, "slug" | "title" | "pages" | "tagline">): boolean {
  if (!isWillowBook(book)) return false;
  const text = book.pages.map((item) => (item.paragraphs || []).join(" ")).join(" ");
  return (
    book.pages.length === WILLOW_SONG_PAGE_COUNT &&
    text.includes(WILLOW_SONG_MARKER) &&
    book.pages.some((item) => item.imageAsset === "willow-chorus-bear-falls.webp") &&
    book.pages.some((item) => item.imageAsset === "willow-chorus-puff.webp") &&
    book.pages.some((item) => item.imageAsset === "willow-chorus-dance-roar.webp")
  );
}

export function withWillowSongTagline(layout: PageLayout | undefined): PageLayout {
  const elements = (layout?.elements || []).map((item) =>
    item.role === "tagline" ? { ...item, text: WILLOW_SONG_TAGLINE } : item,
  );
  return { ...layout, elements };
}

export function willowSongPayload(book: Book): Partial<Book> {
  return {
    tagline: WILLOW_SONG_TAGLINE,
    pages: willowSongPages(),
    titleLayout: withWillowSongTagline(book.titleLayout),
    coverLayout: withWillowSongTagline(book.coverLayout),
  };
}

export function needsWillowSongUpdate(book: Book): boolean {
  if (!isWillowBook(book)) return false;
  if (!isWillowSongBook(book)) return true;
  return !layoutHasSongTagline(book.coverLayout) || !layoutHasSongTagline(book.titleLayout);
}
