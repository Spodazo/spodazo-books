import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js";
import { dataDir } from "./paths";

/** Read a contents page that was flattened to an image, one line at a time in order. */
export async function recognizeContentsLines(imagePath: string): Promise<Array<{ text: string; top: number }>> {
  const cachePath = path.join(dataDir(), "tesseract");
  fs.mkdirSync(cachePath, { recursive: true });
  const worker = await createWorker("eng", 1, { cachePath });
  try {
    const { data } = await worker.recognize(imagePath);
    return String(data.text || "")
      .split(/\n+/)
      .map((text, top) => ({ text: text.trim(), top }))
      .filter((line) => line.text);
  } finally {
    await worker.terminate();
  }
}
