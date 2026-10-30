import type { Book, BookPage, PageElement, PageLayout } from "./types";
import { isWillowBook } from "./reader-pages";

export const WILLOW_SONG_PAGE_COUNT = 13;
export const WILLOW_SONG_TAGLINE =
  "A Sing-Along Book!\nA little tiger. A very big roar.\nThe happiest hug... and so much more!";
export const WILLOW_SONG_MARKER = "Hugs for Willow, and hugs galore!";
export const WILLOW_SONG_AUDIO_ASSET = "willows-forest-adventure.mp3";
export const WILLOW_SONG_AUDIO_URL = `/media/audio/${WILLOW_SONG_AUDIO_ASSET}`;
/** Printed on Willow’s title page. Kept on one line above the date. */
export const WILLOW_AUTHOR = "Wernard A. Broodryk";
export const WILLOW_FRONT_COVER_ASSET = "willow-front-cover.webp";
export const WILLOW_FRONT_COVER_URL = `/media/images/${WILLOW_FRONT_COVER_ASSET}`;
export const WILLOW_BACK_COVER_ASSET = "willow-back-cover.webp";
export const WILLOW_BACK_COVER_URL = `/media/images/${WILLOW_BACK_COVER_ASSET}`;
export const WILLOW_NAP_ASSET = "willow-bear-nap.webp";
export const WILLOW_NAP_URL = `/media/images/${WILLOW_NAP_ASSET}`;
/** Seconds into the song when the title page should be showing. */
export const WILLOW_SONG_TITLE_CUE = 0;
/**
 * Start times (seconds) for visible story pages, in reading order.
 * Matched to the recorded lyrics so Sing Along can turn the page with the song.
 */
export const WILLOW_SONG_PAGE_CUES = [8, 30, 46, 60, 68, 83, 91, 106, 113, 128, 135, 153];
/** Seconds when the last sung word (“more”) ends. */
export const WILLOW_SONG_LAST_WORD_AT = 163;
/** Turn to the nap spread as soon as the outro line finishes (no extra dwell on the lyric page). */
export const WILLOW_SONG_END_DELAY = 0;
/** Seconds into the song when the bear nap spread should appear. */
export const WILLOW_SONG_END_CUE = WILLOW_SONG_LAST_WORD_AT + WILLOW_SONG_END_DELAY;
/** Seconds to linger on the bear nap art before the back cover. */
export const WILLOW_SONG_NAP_HOLD = 10;
/** Portrait phones: bear art leaf uses the same moment as the nap spread. */
export const WILLOW_SONG_NAP_PICTURE_CUE = WILLOW_SONG_END_CUE;
/** Seconds when Sing Along should turn from the nap spread onto the back cover. */
export const WILLOW_SONG_BACK_COVER_CUE = WILLOW_SONG_END_CUE + WILLOW_SONG_NAP_HOLD;

function willowFullPageImageLayout(id: string, asset: string, url: string): PageLayout {
  return {
    background: "",
    elements: [{
      id,
      type: "image",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      imageAsset: asset,
      imageUrl: url,
      fit: "contain",
      focusX: 50,
      focusY: 50,
      opacity: 100,
    }],
  };
}

export function willowFrontCoverLayout(): PageLayout {
  return willowFullPageImageLayout("cover-art", WILLOW_FRONT_COVER_ASSET, WILLOW_FRONT_COVER_URL);
}

export function willowBackCoverLayout(): PageLayout {
  return willowFullPageImageLayout("back-cover-art", WILLOW_BACK_COVER_ASSET, WILLOW_BACK_COVER_URL);
}

/** Matches the reader nap spread: “The End” on the left, nap art on the right. */
export function willowNapEndLayout(pageBackground?: string): PageLayout {
  return {
    background: pageBackground || "",
    elements: [
      {
        id: "nap-end-text",
        type: "text",
        x: 2,
        y: 38,
        w: 46,
        h: 24,
        z: 2,
        text: "The End",
        align: "center",
        fontSize: 9,
        role: "end",
      },
      {
        id: "nap-art",
        type: "image",
        x: 50,
        y: 0,
        w: 50,
        h: 100,
        z: 1,
        imageAsset: WILLOW_NAP_ASSET,
        imageUrl: WILLOW_NAP_URL,
        fit: "contain",
        focusX: 50,
        focusY: 50,
        opacity: 100,
      },
    ],
  };
}

/** One portrait leaf per spread so saddle-stitch imposition does not split art and lyrics across sheets. */
export function willowBookletSingleLeafSpreads(book: Pick<Book, "slug" | "title">): boolean {
  return isWillowBook(book);
}

/** Same art and spreads as the online Willow reader, for PDF export. */
export function prepareWillowBookForPrint<T extends Book>(book: T): T {
  if (!isWillowBook(book)) return book;
  const { author, titleLayout } = withWillowTitleCredits(book);
  return {
    ...book,
    author,
    titleLayout: titleLayout || book.titleLayout,
    coverLayout: willowFrontCoverLayout(),
    backCoverLayout: willowBackCoverLayout(),
    endLayout: willowNapEndLayout(book.pageBackground),
  };
}

export function willowStoryPageCue(index: number): number | undefined {
  if (index < 0 || index >= WILLOW_SONG_PAGE_CUES.length) return undefined;
  return WILLOW_SONG_PAGE_CUES[index];
}

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
      8,
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
      9,
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
      10,
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
      11,
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
      12,
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
      13,
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

export function isWillowSongBook(book: Pick<Book, "slug" | "title" | "pages" | "tagline">): boolean {
  if (!isWillowBook(book)) return false;
  const text = book.pages.map((item) => (item.paragraphs || []).join(" ")).join(" ");
  return (
    book.pages.length === WILLOW_SONG_PAGE_COUNT &&
    text.includes(WILLOW_SONG_MARKER) &&
    book.pages.some((item) => item.imageAsset === "willow-chorus-bear-falls.webp") &&
    book.pages.some(
      (item) =>
        item.imageAsset === "willow-chorus-dance-roar.webp" &&
        (item.paragraphs || []).join(" ").includes("The loudest growl you've heard before"),
    ) &&
    !book.pages.some((item) => item.imageAsset === "willow-chorus-puff.webp")
  );
}

export function willowAuthorLine(text?: string | null): string {
  const current = String(text || "").replace(/\s+/g, " ").trim();
  if (!current || current === "Wernard Broodryk") return WILLOW_AUTHOR;
  return current;
}

/** Widen the title-page name so it stays one line, just above the date. */
export function withWillowTitleCredits(book: Pick<Book, "author" | "titleLayout">): { author: string; titleLayout?: PageLayout } {
  const authorName = willowAuthorLine(book.author);
  const layout = book.titleLayout;
  if (!layout?.elements?.length) return { author: authorName };
  const elements = layout.elements.map((el) => ({ ...el }));
  const author = elements.find((el) => el.role === "author" || el.id === "title-author");
  const date = elements.find((el) => el.role === "date" || el.id === "title-date");
  if (author) {
    if (!author.role) author.role = "author";
    author.text = willowAuthorLine(author.text || book.author);
    author.align = "center";
    author.x = 52;
    author.w = 44;
    author.y = 82;
    author.h = 6;
  }
  if (date) {
    if (!date.role) date.role = "date";
    date.align = "center";
    date.x = 52;
    date.w = 44;
    date.y = 89;
    date.h = 5;
  }
  return { author: author ? willowAuthorLine(author.text) : authorName, titleLayout: { ...layout, elements } };
}

export function needsWillowTitleCredits(book: Pick<Book, "slug" | "title" | "author" | "titleLayout">): boolean {
  if (!isWillowBook(book)) return false;
  const name = String(book.author || "").replace(/\s+/g, " ").trim();
  if (name === "Wernard Broodryk") return true;
  const author = book.titleLayout?.elements?.find((el) => el.role === "author" || el.id === "title-author");
  if (!author) return false;
  const text = String(author.text || "").replace(/\s+/g, " ").trim();
  if (text === "Wernard Broodryk") return true;
  return (Number(author.w) || 0) < 30 && (text === WILLOW_AUTHOR || text === name);
}

export function withWillowSongTagline(layout: PageLayout | undefined): PageLayout {
  const elements = (layout?.elements || []).map((item) => {
    if (item.role !== "tagline") return item;
    const next = { ...item, text: WILLOW_SONG_TAGLINE };
    if (item.id === "cover-tagline") {
      next.y = Math.min(Number(item.y) || 82, 79.5);
      next.h = Math.max(Number(item.h) || 8, 11);
    }
    if (item.id === "title-tagline") {
      next.h = Math.max(Number(item.h) || 16, 28);
    }
    return next;
  });
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
  return !isWillowSongBook(book);
}
