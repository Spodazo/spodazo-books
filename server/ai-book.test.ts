import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildImagePrompt,
  clampPageCount,
  DEFAULT_AI_PAGES,
  MAX_AI_PAGES,
  MIN_AI_PAGES,
  parseAiOutline,
  parseImageRequest,
  parseOutlineRequest,
  saveGeneratedImage,
  storySystemPrompt,
} from "./ai-book";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("clampPageCount keeps books between 4 and 12 pages", () => {
  assert.equal(clampPageCount(undefined), DEFAULT_AI_PAGES);
  assert.equal(clampPageCount(2), MIN_AI_PAGES);
  assert.equal(clampPageCount(40), MAX_AI_PAGES);
  assert.equal(clampPageCount(6), 6);
});

test("parseOutlineRequest requires a prompt and audience", () => {
  assert.throws(() => parseOutlineRequest({ prompt: "A fox", audience: "robots" }), /Children or Adults/);
  assert.throws(() => parseOutlineRequest({ audience: "children" }), /prompt/);
  const parsed = parseOutlineRequest({
    prompt: "A fox finds a lantern",
    audience: "adults",
    pageCount: 20,
    characters: [{ name: "Nia", description: "short hair" }, { name: "" }],
  });
  assert.equal(parsed.audience, "adults");
  assert.equal(parsed.pageCount, MAX_AI_PAGES);
  assert.deepEqual(parsed.characters.map((item) => item.name), ["Nia", "Character 2"]);
});

test("parseAiOutline keeps character names and rejects a thin story", () => {
  assert.throws(() => parseAiOutline({ title: "" }, 4), /title/);
  assert.throws(() => parseAiOutline({ title: "Hello", pages: [] }, 4), /pages/);
  assert.throws(
    () => parseAiOutline({
      title: "Hello",
      pages: [{ title: "One", paragraphs: ["Hi"], illustrationPrompt: "A fox, no text" }],
    }, 4),
    /enough pages/,
  );
  const outline = parseAiOutline(
    {
      title: "Lantern Walk",
      tagline: "A quiet evening",
      pages: Array.from({ length: 4 }, (_, index) => ({
        title: `Page ${index + 1}`,
        paragraphs: [`Line ${index + 1}`],
        illustrationPrompt: "The friends walk on, no text",
      })),
    },
    4,
    [{ name: "Nia", description: "" }],
  );
  assert.equal(outline.title, "Lantern Walk");
  assert.equal(outline.characterDescription, "Nia");
  assert.equal(outline.pages.length, 4);
});

test("audience prompts stay age-appropriate", () => {
  const children = storySystemPrompt("children");
  const adults = storySystemPrompt("adults");
  assert.match(children, /children/i);
  assert.match(children, /No violence/);
  assert.match(adults, /grown-ups/i);
  assert.match(adults, /not write erotic/i);
});

test("buildImagePrompt asks for likeness and no letters", () => {
  const caricature = buildImagePrompt({
    kind: "caricature",
    prompt: "",
    audience: "children",
    artStyle: "watercolour",
    name: "Nia",
    referenceFiles: ["nia.webp"],
  });
  assert.match(caricature, /Nia/);
  assert.match(caricature, /no text or letters/i);
  const page = buildImagePrompt({
    kind: "page",
    prompt: "They share the lantern",
    audience: "adults",
    artStyle: "",
    name: "2",
    referenceFiles: ["nia.webp"],
  });
  assert.match(page, /reference characters/);
});

test("parseImageRequest requires a photo for caricatures", () => {
  assert.throws(() => parseImageRequest({ kind: "caricature", audience: "children" }), /photo/);
  const parsed = parseImageRequest({
    kind: "page",
    audience: "children",
    referenceFiles: ["../secret/nia.webp"],
  });
  assert.deepEqual(parsed.referenceFiles, ["nia.webp"]);
});

test("saveGeneratedImage writes a converted image", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spodazo-ai-"));
  const previous = process.env.BOOKS_DATA_DIR;
  process.env.BOOKS_DATA_DIR = dir;
  try {
    const filename = await saveGeneratedImage(TINY_PNG_B64, "page.png");
    assert.match(filename, /\.webp$/);
    assert.ok(fs.existsSync(path.join(dir, "images", filename)));
  } finally {
    if (previous === undefined) delete process.env.BOOKS_DATA_DIR;
    else process.env.BOOKS_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
