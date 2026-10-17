/**
 * Generate Willow chorus illustrations with the existing character as reference.
 * Usage: node --import tsx scripts/generate-willow-chorus-art.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAiImage } from "../server/ai-book.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "media/images");

const STYLE =
  "Warm painterly children's picture-book oil illustration, golden forest light, mossy rocks, wildflowers, soft brushwork. Keep Willow's exact design from the references: small orange tiger cub, green eyes, blue bow in her tuft, purple t-shirt, beige overalls with Willow embroidered on the bib, pastel scarf. No title text, no captions, no letters in the scene except that embroidery.";

const jobs = [
  {
    filename: "willow-chorus-bear-falls.webp",
    name: "willow-chorus-bear-falls",
    references: ["willow-character.webp", "willow-ref-roar-bear.png"],
    prompt: `${STYLE} Keep Willow and the falling bear in the center-left, both fully visible. Comic surprise: the bear falls backward onto his rump, legs and paws in the air, face visible, startled by Willow's roar — not hurt, not running away. Willow stands at the left, brave, looking at him. She is NOT covering her cheeks.`,
  },
  {
    filename: "willow-chorus-roar.webp",
    name: "willow-chorus-roar",
    references: ["willow-character.webp", "willow-ref-roar.png"],
    prompt: `${STYLE} Willow plants her paws wide, puffs her chest, and lets out a brave happy roar with her mouth open. She looks proud and playful, not scared. Full body in a sunlit forest clearing. No bear, or only a tiny surprised bear far away in the background.`,
  },
  {
    filename: "willow-chorus-dance.webp",
    name: "willow-chorus-dance",
    references: ["willow-character.webp", "willow-ref-run.png"],
    prompt: `${STYLE} Willow is dancing with joy in a sunlit forest clearing: hopping and spinning, scarf flying, paws in the air, big grin. Musical, giggly energy. Full body, playful pose, same forest world.`,
  },
  {
    filename: "willow-final-chorus.webp",
    name: "willow-final-chorus",
    references: ["willow-character.webp", "willow-ref-hug.png", "willow-ref-reunion.png"],
    prompt: `${STYLE} Willow dances and roars happily in a warm stripy hug with her two tiger mothers from the hug reference: one in a teal cardigan and jeans, the other in a rust-orange cardigan and jeans. All three smiling and singing together in golden forest light. Full painted scene.`,
  },
];

async function main() {
  fs.mkdirSync(destDir, { recursive: true });
  for (const job of jobs) {
    console.log("Drawing", job.filename);
    const generated = await generateAiImage({
      kind: "page",
      prompt: job.prompt,
      audience: "children",
      artStyle: "painterly children's picture-book oil illustration",
      name: job.name,
      referenceFiles: job.references,
    });
    const from = path.join(root, ".books-data/images", generated.filename);
    const to = path.join(destDir, job.filename);
    fs.copyFileSync(from, to);
    fs.copyFileSync(to, path.join(root, ".books-data/images", job.filename));
    console.log("Saved", job.filename, "from", generated.filename);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
