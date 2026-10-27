import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { readFileSync } from "fs";
import { rm } from "fs/promises";

async function buildAll() {
  const buildId =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.BUILD_ID ||
    String(Date.now());
  process.env.BUILD_ID = buildId;
  await rm("dist", { recursive: true, force: true });
  console.log("building client...");
  await viteBuild();
  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.BUILD_ID": JSON.stringify(buildId),
      "process.env.FACSIMILE_CSS": JSON.stringify(readFileSync("client/src/flipbook/facsimile-flipbook.css", "utf8")),
      "process.env.FACSIMILE_ENGINE": JSON.stringify(readFileSync("client/src/flipbook/facsimile-flipbook-engine.js", "utf8")),
    },
    external: [
      "pg-native",
      "vite",
      "sharp",
      "@napi-rs/canvas",
      "pdfjs-dist/legacy/build/pdf.mjs",
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "tesseract.js",
    ],
    target: "node22",
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
