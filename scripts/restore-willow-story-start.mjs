/**
 * Re-insert Willow PDF story pages 2–4 (page-2 … page-4) removed during editor testing.
 */
import { execFileSync } from "node:child_process";

const base = process.env.BOOKS_URL || "https://spodazo-books-production.up.railway.app";
const slug = "willows-big-forest-adventure";
const password = process.env.ADMIN_PASSWORD;
const cookieJar = "/tmp/spodazo-restore-willow.jar";

if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

function curl(args, body) {
  const argv = ["-sS", "-b", cookieJar, "-c", cookieJar, ...args];
  if (body !== undefined) {
    argv.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }
  return execFileSync("curl", argv, { encoding: "utf8" });
}

function storyPage(id, sourcePage, art, bodyText, template) {
  const artEl = template.elements.find((e) => e.type === "image");
  const textEl = template.elements.find((e) => e.type === "text");
  const imageUrl = `/media/images/${art}`;
  return {
    id,
    sourcePage,
    kind: "story",
    title: "WILLOW’S FOREST ADVENTURE",
    paragraphs: [bodyText],
    imageAsset: art,
    fullPageAsset: art,
    imageUrl,
    fullPageUrl: imageUrl,
    position: sourcePage <= 3 ? "top" : "bottom",
    focalPoint: "50% 50%",
    background: "",
    elements: [
      { ...artEl, id: `${id}-art`, imageAsset: art, imageUrl },
      { ...textEl, id: `${id}-text`, text: bodyText, role: "body" },
    ],
  };
}

const login = JSON.parse(curl(["-X", "POST", `${base}/api/admin/login`], { password }));
if (!login.ok) {
  console.error("Login failed:", login);
  process.exit(1);
}

const fetched = JSON.parse(curl([`${base}/api/books/${encodeURIComponent(slug)}`]));
const template = fetched.pages.find((p) => p.id === "page-5") || fetched.pages.find((p) => p.elements?.length);
if (!template) {
  console.error("No story page template found");
  process.exit(1);
}

const restored = [
  storyPage(
    "page-2",
    2,
    "art-002.webp",
    "Willow spotted a butterfly dancing between the trees.\n\n“Wait for me!” she giggled, pattering after it.",
    template,
  ),
  storyPage(
    "page-3",
    3,
    "art-003.webp",
    "But the butterfly fluttered away.\n\nWillow stopped. The forest was very quiet.\n\n“Mommy? Mamma?” she called.",
    template,
  ),
  storyPage(
    "page-4",
    4,
    "art-004.webp",
    "Rustle, rustle. Crack!\n\nA big brown bear stepped out from behind a tree.\n\nWillow’s little knees began to wobble.",
    template,
  ),
];

const byId = new Map(fetched.pages.map((p) => [p.id, p]));
for (const page of restored) byId.set(page.id, page);

const order = ["page-1", "page-2", "page-3", "page-4", "page-5", "page-6", "page-7", "page-8", "page-9", "page-10"];
const pages = order.filter((id) => byId.has(id)).map((id, index) => ({
  ...byId.get(id),
  sourcePage: index + 1,
}));

const updated = JSON.parse(
  curl(["-X", "PATCH", `${base}/api/admin/books/${fetched.id}`], { pages }),
);

if (updated.error) {
  console.error("PATCH failed:", updated);
  process.exit(1);
}

console.log("Restored", restored.map((p) => p.id).join(", "), "— book now has", updated.pages.length, "pages");
