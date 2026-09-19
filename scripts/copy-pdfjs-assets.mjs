import { access } from "node:fs/promises";
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  const src = new URL(`node_modules/pdfjs-dist/${name}/`, root);
  try {
    await access(fileURLToPath(src));
  } catch {
    console.warn(`[pdfjs] skip ${name}: not installed yet`);
    continue;
  }
  const dest = new URL(`client/public/pdfjs/${name}/`, root);
  await mkdir(dest, { recursive: true });
  await cp(fileURLToPath(src), fileURLToPath(dest), { recursive: true });
}
