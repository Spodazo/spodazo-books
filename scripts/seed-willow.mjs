import { createRequire } from "node:module";
const require = createRequire("/tmp/pw-seed/package.json");
const { chromium } = require("playwright");
import path from "node:path";

const base = process.env.BOOKS_URL || "https://spodazo-books-production.up.railway.app";
const password = process.env.ADMIN_PASSWORD;
const pdf = path.resolve("media/pdfs/Willows-Big-Forest-Adventure.pdf");
if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(180000);
await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
await page.getByLabel("Admin password").fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByRole("button", { name: "Add book from PDF" }).waitFor();
await page.getByRole("button", { name: "Add book from PDF" }).click();
await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdf);
await page.getByRole("button", { name: "Save book" }).waitFor({ timeout: 180000 });
await page.waitForFunction(() => {
  const status = document.body.innerText;
  return /\d+ pages ready/.test(status);
}, null, { timeout: 180000 });
await page.getByRole("button", { name: "Save book" }).click();
await page.getByRole("heading", { name: /Willow/i }).first().waitFor({ timeout: 120000 });
console.log("seeded");
await browser.close();
