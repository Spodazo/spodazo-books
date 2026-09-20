import fs from "fs";
import path from "path";
import { convertUploadedImage } from "./media";
import { imagesDir, uniqueFileName } from "./paths";

export const MIN_AI_PAGES = 4;
export const MAX_AI_PAGES = 12;
export const DEFAULT_AI_PAGES = 8;
export const AI_IMAGE_SIZE = "1024x1536";

export type AiAudience = "children" | "adults";
export type AiImageKind = "caricature" | "character" | "cover" | "page";

export type AiCharacterInput = {
  name: string;
  description: string;
};

export type AiOutlinePage = {
  title: string;
  paragraphs: string[];
  illustrationPrompt: string;
};

export type AiOutline = {
  title: string;
  tagline: string;
  author: string;
  date: string;
  artStyle: string;
  characterDescription: string;
  pages: AiOutlinePage[];
};

export type OutlineRequest = {
  prompt: string;
  pageCount: number;
  audience: AiAudience;
  style: string;
  characters: AiCharacterInput[];
};

export type ImageRequest = {
  kind: AiImageKind;
  prompt: string;
  audience: AiAudience;
  artStyle: string;
  name: string;
  referenceFiles: string[];
};

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function clampPageCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_AI_PAGES;
  return Math.min(MAX_AI_PAGES, Math.max(MIN_AI_PAGES, Math.round(n)));
}

export function parseAudienceRequired(raw: unknown): AiAudience {
  if (raw === "children" || raw === "adults") return raw;
  throw new Error("Choose Children or Adults");
}

export function parseCharacters(raw: unknown): AiCharacterInput[] {
  if (raw === undefined || raw === null) return [];
  const list = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = String(record.name || "").trim() || `Character ${index + 1}`;
      const description = String(record.description || "").trim();
      return { name, description };
    })
    .filter((item) => item.name);
}

export function parseOutlineRequest(body: unknown): OutlineRequest {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const prompt = String(record.prompt || "").trim();
  if (!prompt) throw new Error("Write a prompt for the book");
  return {
    prompt,
    pageCount: clampPageCount(record.pageCount),
    audience: parseAudienceRequired(record.audience),
    style: String(record.style || "").trim(),
    characters: parseCharacters(record.characters),
  };
}

export function parseImageRequest(body: unknown): ImageRequest {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const kind = String(record.kind || "");
  if (kind !== "caricature" && kind !== "character" && kind !== "cover" && kind !== "page") {
    throw new Error("Choose what picture to generate");
  }
  const references = record.referenceFiles ?? record.references;
  const referenceFiles = Array.isArray(references)
    ? references.map((item) => path.basename(String(item || ""))).filter(Boolean)
    : String(record.filename || record.sourceFile || "").trim()
      ? [path.basename(String(record.filename || record.sourceFile))]
      : [];
  if (kind === "caricature" && !referenceFiles.length) {
    throw new Error("Upload a photo to turn into a caricature");
  }
  return {
    kind,
    prompt: String(record.prompt || "").trim(),
    audience: parseAudienceRequired(record.audience),
    artStyle: String(record.artStyle || record.style || "").trim(),
    name: String(record.name || "").trim(),
    referenceFiles,
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Story output was not a book");
    return parsed as Record<string, unknown>;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Story output was not a book");
  return raw as Record<string, unknown>;
}

function parseOutlinePages(raw: unknown, pageCount: number): AiOutlinePage[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error("Story did not include any pages");
  const pages = raw.map((item, index) => {
    const page = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const paragraphs = Array.isArray(page.paragraphs)
      ? page.paragraphs.map((line) => String(line || "").trim()).filter(Boolean)
      : String(page.text || page.paragraph || "").trim()
        ? [String(page.text || page.paragraph).trim()]
        : [];
    const illustrationPrompt = String(page.illustrationPrompt || page.imagePrompt || "").trim();
    if (!paragraphs.length || !illustrationPrompt) {
      throw new Error(`Story page ${index + 1} is missing text or an illustration prompt`);
    }
    return {
      title: String(page.title || `Page ${index + 1}`).trim(),
      paragraphs,
      illustrationPrompt,
    };
  });
  const trimmed = pages.slice(0, pageCount);
  if (trimmed.length < pageCount) throw new Error("Story did not include enough pages");
  return trimmed;
}

export function parseAiOutline(raw: unknown, pageCount: number, characters: AiCharacterInput[] = []): AiOutline {
  const record = asRecord(raw);
  const title = String(record.title || "").trim();
  if (!title) throw new Error("Story is missing a title");
  const named = characters.map((item) => item.name).filter(Boolean).join(", ");
  return {
    title,
    tagline: String(record.tagline || record.subtitle || "").trim(),
    author: String(record.author || "Spodazo").trim() || "Spodazo",
    date: String(record.date || new Date().getFullYear()).trim(),
    artStyle: String(record.artStyle || "").trim(),
    characterDescription: String(record.characterDescription || named).trim() || named,
    pages: parseOutlinePages(record.pages, pageCount),
  };
}

export function storySystemPrompt(audience: AiAudience): string {
  if (audience === "adults") {
    return [
      "You write illustrated picture books for grown-ups: humor, memoir, travel, friendship, and everyday life.",
      "Do not write erotic, pornographic, or sexually explicit material.",
      "Keep each page to one or two short overlay sentences.",
      "Return JSON only.",
      "illustrationPrompt must name the same characters every time, describe a full painted scene, and say there is no text or letters in the image.",
    ].join(" ");
  }
  return [
    "You write gentle children's picture books for ages 4 to 8.",
    "No violence, no fear, no adult themes, no romantic or sexual content.",
    "Keep each page to one or two short overlay sentences a child can hear read aloud.",
    "Return JSON only.",
    "illustrationPrompt must name the same characters every time, describe a full painted scene, and say there is no text or letters in the image.",
  ].join(" ");
}

export function buildOutlineUserPrompt(input: OutlineRequest): string {
  const people = input.characters.length
    ? `These named characters must appear in the story: ${input.characters
        .map((item) => (item.description ? `${item.name} (${item.description})` : item.name))
        .join("; ")}.`
    : "Invent a small cast of characters and describe them clearly.";
  const style = input.style ? `Art direction: ${input.style}.` : "";
  return [
    `Write a ${input.pageCount}-page ${input.audience === "adults" ? "grown-up" : "children's"} picture book from this idea:`,
    input.prompt,
    people,
    style,
    `Return JSON with keys title, tagline, author, date, artStyle, characterDescription, and pages.`,
    `pages must be an array of exactly ${input.pageCount} objects with title, paragraphs (string array), and illustrationPrompt.`,
  ].filter(Boolean).join("\n");
}

export function buildImagePrompt(request: ImageRequest): string {
  const audienceLook =
    request.audience === "adults"
      ? "tasteful grown-up picture-book illustration"
      : "warm children's picture-book illustration";
  const style = request.artStyle ? ` Style: ${request.artStyle}.` : "";
  const extra = request.prompt ? ` ${request.prompt}` : "";
  if (request.kind === "caricature") {
    const who = request.name ? ` of ${request.name}` : "";
    return `Turn this photo into a ${audienceLook} caricature${who}. Keep a clear likeness. Full body, facing forward, plain light background, no text or letters.${style}${extra}`;
  }
  if (request.kind === "character") {
    const who = request.name ? ` named ${request.name}` : "";
    return `${audienceLook} character sheet${who}.${extra} Full body, plain light background, consistent design, no text or letters.${style}`;
  }
  if (request.kind === "cover") {
    return `${audienceLook} cover. Paint the reference characters into a full scene. No title text, no letters.${style}${extra}`;
  }
  return `${audienceLook}. Use the reference characters with a clear likeness. Full painted scene background, no text or letters.${style}${extra}`;
}

function storyModel(): string {
  return process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o";
}

function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
}

function imageQuality(): "low" | "medium" | "high" {
  const value = process.env.OPENAI_IMAGE_QUALITY?.trim();
  return value === "low" || value === "high" ? value : "medium";
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

export async function saveGeneratedImage(b64: string, originalName: string): Promise<string> {
  const buffer = Buffer.from(String(b64 || "").replace(/^data:image\/\w+;base64,/, ""), "base64");
  if (buffer.length < 32) throw new Error("Generated image was empty");
  fs.mkdirSync(imagesDir(), { recursive: true });
  const dest = uniqueFileName(imagesDir(), originalName.endsWith(".png") ? originalName : `${originalName}.png`);
  fs.writeFileSync(path.join(imagesDir(), dest), buffer);
  return convertUploadedImage(dest);
}

function mimeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function localReference(filename: string): string {
  const full = path.join(imagesDir(), path.basename(filename));
  if (!fs.existsSync(full)) throw new Error(`Character image ${path.basename(filename)} was not found`);
  return full;
}

async function openaiJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = body.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : {};
    throw new Error(String(err.message || body.error || `OpenAI request failed (${res.status})`));
  }
  return body;
}

function firstImageB64(body: Record<string, unknown>): string {
  const data = Array.isArray(body.data) ? body.data : [];
  const first = data[0] && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : {};
  const b64 = String(first.b64_json || "").trim();
  if (!b64) throw new Error("OpenAI did not return an image");
  return b64;
}

export async function generateAiOutline(input: OutlineRequest): Promise<AiOutline> {
  const body = await openaiJson("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: storyModel(),
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: storySystemPrompt(input.audience) },
        { role: "user", content: buildOutlineUserPrompt(input) },
      ],
    }),
  });
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message : null;
  const content = message && typeof message === "object" ? String((message as Record<string, unknown>).content || "") : "";
  if (!content) throw new Error("OpenAI did not return a story");
  return parseAiOutline(content, input.pageCount, input.characters);
}

async function generatePlainImage(prompt: string): Promise<string> {
  const body = await openaiJson("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: imageModel(),
      prompt,
      size: AI_IMAGE_SIZE,
      quality: imageQuality(),
      n: 1,
    }),
  });
  return firstImageB64(body);
}

async function generateEditedImage(prompt: string, referenceFiles: string[]): Promise<string> {
  const form = new FormData();
  form.set("model", imageModel());
  form.set("prompt", prompt);
  form.set("size", AI_IMAGE_SIZE);
  form.set("quality", imageQuality());
  form.set("input_fidelity", "high");
  for (const filename of referenceFiles) {
    const full = localReference(filename);
    const bytes = fs.readFileSync(full);
    form.append("image[]", new Blob([new Uint8Array(bytes)], { type: mimeFor(full) }), path.basename(full));
  }
  const body = await openaiJson("https://api.openai.com/v1/images/edits", {
    method: "POST",
    body: form,
  });
  return firstImageB64(body);
}

export async function generateAiImage(request: ImageRequest): Promise<{ filename: string; urlName: string }> {
  const prompt = buildImagePrompt(request);
  const b64 = request.referenceFiles.length
    ? await generateEditedImage(prompt, request.referenceFiles)
    : await generatePlainImage(prompt);
  const stem =
    request.kind === "caricature" || request.kind === "character"
      ? `character-${request.name || request.kind}`
      : request.kind === "cover"
        ? "ai-cover"
        : `ai-page-${request.name || "scene"}`;
  const filename = await saveGeneratedImage(b64, `${stem.replace(/[^a-zA-Z0-9._-]+/g, "-")}.png`);
  return { filename, urlName: filename };
}
