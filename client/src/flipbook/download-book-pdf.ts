import html2canvas from "html2canvas";
import { PDFDocument, rgb } from "pdf-lib";
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, fontStack, fontsUsed, googleFontsHref } from "@shared/book-fonts";
import {
  DEFAULT_PAGE_BACKGROUND,
  ensureBookLayouts,
  hasLayout,
  pageFill,
  publishedLabel,
} from "@shared/page-layout";
import { PAPER_TILE_PX, normalizePaperTexture, paperTextureUrl } from "@shared/paper";
import { characterUrlFor, visibleStoryPages } from "@shared/reader-pages";
import { frameClass, frameMarkup } from "@shared/text-frames";
import type { PageElement, PageLayout, PublicBook } from "@shared/types";
import { fetchPlayerSetup } from "../lib/api";
import { bookletSheets, paddedPageCount, withOutsideBack } from "../lib/booklet";

export type BookPdfKind = "standard" | "a3-a4" | "a4-a5";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const A3_LANDSCAPE: [number, number] = [1190.55, 841.89];

type Rendered = { png: Uint8Array; width: number; height: number };
type PaperPaint = { id: string; image: HTMLImageElement | null };

function paintPaper(ctx: CanvasRenderingContext2D, color: string, width: number, height: number, paper?: PaperPaint) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const image = paper?.image;
  if (!image) return;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let y = 0; y < height; y += PAPER_TILE_PX) {
    for (let x = 0; x < width; x += PAPER_TILE_PX) {
      ctx.drawImage(image, x, y, PAPER_TILE_PX, PAPER_TILE_PX);
    }
  }
  if (paper?.id === "deckle") {
    const shade = ctx.createLinearGradient(0, 0, width * 0.24, 0);
    shade.addColorStop(0, "#c4b496");
    shade.addColorStop(1, "#ffffff");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width * 0.24, height);
  }
  ctx.restore();
}

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function slugFile(title: string) {
  return title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "book";
}

async function ensureFonts(book: PublicBook) {
  const families = fontsUsed(
    book.textFont,
    ...[book.coverLayout, book.backCoverLayout, book.titleLayout, book.endLayout, ...book.pages].flatMap((layout) =>
      (layout?.elements || []).map((item) => item.fontFamily),
    ),
  );
  let link = document.getElementById("print-book-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "print-book-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = googleFontsHref(families);
  await document.fonts.ready;
  await Promise.all(families.map((family) => document.fonts.load(`16px ${fontStack(family)}`)));
}

function addElement(root: HTMLElement, element: PageElement, height: number, ink: string, font: string) {
  const node = document.createElement("div");
  node.style.position = "absolute";
  node.style.left = `${element.x}%`;
  node.style.top = `${element.y}%`;
  node.style.width = `${element.w}%`;
  node.style.height = `${element.h}%`;
  node.style.zIndex = String(element.z || 1);
  node.style.boxSizing = "border-box";
  if (element.type === "image") {
    node.style.overflow = "hidden";
    node.style.opacity = String((element.opacity ?? 100) / 100);
    const img = document.createElement("img");
    img.src = element.imageUrl || "";
    img.alt = "";
    img.dataset.fit = element.fit === "contain" || element.id === "cover-art" || element.id === "title-cover" || element.id === "end-art" || element.id === "back-art" ? "contain" : "cover";
    img.style.position = "absolute";
    img.style.maxWidth = "none";
    node.appendChild(img);
  } else if (element.type === "shape") {
    node.style.background = element.color || "#ffffff";
    node.style.opacity = String((element.opacity ?? 100) / 100);
    node.style.borderRadius = element.shape === "circle" ? "50%" : "2%";
  } else {
    node.style.display = "flex";
    node.style.flexDirection = "column";
    node.style.justifyContent = "center";
    node.style.overflow = "hidden";
    node.style.fontFamily = fontStack(element.fontFamily || font);
    node.style.fontSize = `${(element.fontSize || 4) * (height / 100)}px`;
    node.style.lineHeight = "1.25";
    node.style.color = element.color || ink;
    node.style.textAlign = element.align || "left";
    node.style.whiteSpace = element.id === "back-title" ? "nowrap" : "pre-wrap";
    const frame = frameMarkup(element.frame, element.w / element.h);
    if (frame) node.insertAdjacentHTML("afterbegin", frame);
    const text = document.createElement("div");
    (element.text || "").split(/\n{2,}/).forEach((para) => {
      const p = document.createElement("p");
      p.style.margin = "0 0 1.6em";
      p.style.font = "inherit";
      p.textContent = para;
      text.appendChild(p);
    });
    const last = text.lastElementChild as HTMLElement | null;
    if (last) last.style.marginBottom = "0";
    node.appendChild(text);
    node.className = frameClass(element.frame);
  }
  root.appendChild(node);
}

function addLegal(root: HTMLElement, book: PublicBook, credits: string, copyright: string, logoUrl: string, leaf = false) {
  const footer = document.createElement("footer");
  footer.style.cssText = leaf
    ? "position:absolute;left:8%;right:8%;width:auto;bottom:36px;text-align:center;padding:0;box-sizing:border-box;color:#203b2a;z-index:30;"
    : "position:absolute;left:50%;width:50%;bottom:36px;text-align:center;padding:0 8%;box-sizing:border-box;color:#203b2a;z-index:30;";
  const published = publishedLabel(book.date);
  if (logoUrl) {
    const logo = document.createElement("img");
    logo.src = logoUrl;
    logo.alt = "";
    logo.style.cssText = "display:block;width:96px;height:auto;margin:0 auto 12px;";
    footer.appendChild(logo);
  }
  if (published) {
    const line = document.createElement("p");
    line.textContent = published;
    line.style.cssText = "margin:0 0 6px;font:600 18px Nunito,sans-serif;";
    footer.appendChild(line);
  }
  if (credits) {
    const line = document.createElement("p");
    line.textContent = credits;
    line.style.cssText = "margin:0 0 6px;font:600 16px Nunito,sans-serif;";
    footer.appendChild(line);
  }
  if (copyright) {
    const line = document.createElement("p");
    line.textContent = copyright;
    line.style.cssText = "margin:0;font:400 14px/1.4 Nunito,sans-serif;";
    footer.appendChild(line);
  }
  if (footer.childElementCount) root.appendChild(footer);
}

function fitTextBox(el: HTMLElement) {
  const start = parseFloat(getComputedStyle(el).fontSize);
  if (!start || el.clientHeight < 8) return;
  let size = start;
  const min = Math.max(8, start * 0.45);
  let n = 0;
  while (el.scrollHeight > el.clientHeight + 1 && size > min && n < 30) {
    size = Math.round(size * 0.94 * 10) / 10;
    el.style.fontSize = `${size}px`;
    n += 1;
  }
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a picture"));
    img.src = src;
  });
}

function drawFittedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, element: PageElement, pageW: number, pageH: number) {
  const boxX = (element.x / 100) * pageW;
  const boxY = (element.y / 100) * pageH;
  const boxW = (element.w / 100) * pageW;
  const boxH = (element.h / 100) * pageH;
  const contain = element.fit === "contain" || element.id === "cover-art" || element.id === "title-cover" || element.id === "end-art" || element.id === "back-art";
  const scale = contain
    ? Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight)
    : Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = (element.opacity ?? 100) / 100;
  ctx.beginPath();
  ctx.rect(boxX, boxY, boxW, boxH);
  ctx.clip();
  ctx.drawImage(img, boxX + (boxW - width) / 2, boxY + (boxH - height) / 2, width, height);
  ctx.restore();
}

async function snapshot(node: HTMLElement): Promise<Rendered> {
  node.querySelectorAll<HTMLElement>(":scope > div").forEach((el) => {
    if (el.querySelector("p")) fitTextBox(el);
  });
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: null,
    useCORS: true,
    logging: false,
    width: node.offsetWidth,
    height: node.offsetHeight,
    windowWidth: node.offsetWidth,
    windowHeight: node.offsetHeight,
  });
  const png = await new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) reject(new Error("Could not draw a page"));
      else resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
  return { png, width: canvas.width, height: canvas.height };
}

async function renderLayout(layout: PageLayout, book: PublicBook, kind: "cover" | "spread", legal: false | "end" | "back" = false, extras?: { credits: string; copyright: string; logoUrl: string }, paperPaint?: PaperPaint) {
  const width = kind === "cover" ? 800 : 1600;
  const height = 1000;
  const paper = pageFill(layout.background, book.pageBackground || DEFAULT_PAGE_BACKGROUND);
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw a page");
  ctx.scale(2, 2);
  paintPaper(ctx, paper, width, height, paperPaint);
  const ink = book.textColor || DEFAULT_TEXT_COLOR;
  const font = book.textFont || DEFAULT_TEXT_FONT;
  const elements = layout.elements.slice().sort((a, b) => a.z - b.z);
  for (const element of elements) {
    if (element.type !== "image" || !element.imageUrl) continue;
    const img = await loadHtmlImage(element.imageUrl);
    drawFittedImage(ctx, img, element, width, height);
  }
  for (const element of elements) {
    if (element.type !== "shape") continue;
    const boxX = (element.x / 100) * width;
    const boxY = (element.y / 100) * height;
    const boxW = (element.w / 100) * width;
    const boxH = (element.h / 100) * height;
    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 100) / 100;
    ctx.fillStyle = element.color || "#ffffff";
    ctx.beginPath();
    if (element.shape === "circle") ctx.ellipse(boxX + boxW / 2, boxY + boxH / 2, boxW / 2, boxH / 2, 0, 0, Math.PI * 2);
    else ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.restore();
  }
  const root = document.createElement("div");
  root.style.cssText = `position:fixed;left:0;top:0;z-index:-1;pointer-events:none;width:${width}px;height:${height}px;overflow:hidden;background:transparent;`;
  elements.filter((element) => element.type === "text").forEach((element) => addElement(root, element, height, ink, font));
  if (legal && extras) addLegal(root, book, extras.credits, extras.copyright, extras.logoUrl, legal === "back");
  document.body.appendChild(root);
  try {
    const text = await snapshot(root);
    const textImg = await loadImage(text.png);
    ctx.drawImage(textImg, 0, 0, width, height);
  } finally {
    root.remove();
  }
  const png = await new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) reject(new Error("Could not draw a page"));
      else resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
  return { png, width: canvas.width, height: canvas.height };
}

function blankLeaf(color: string, paperPaint?: PaperPaint): Rendered {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare a blank page");
  paintPaper(ctx, color, canvas.width, canvas.height, paperPaint);
  const data = canvas.toDataURL("image/png");
  const binary = atob(data.split(",")[1] || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { png: bytes, width: canvas.width, height: canvas.height };
}

async function halves(spread: Rendered): Promise<[Rendered, Rendered]> {
  const img = await loadImage(spread.png);
  const cut = async (sx: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(img.width / 2);
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not split a page");
    ctx.drawImage(img, sx, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) reject(new Error("Could not split a page"));
        else resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
    return { png, width: canvas.width, height: canvas.height };
  };
  return [await cut(0), await cut(Math.floor(img.width / 2))];
}

function loadImage(png: Uint8Array) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read a rendered page"));
    };
    img.src = url;
  });
}

function fitRect(image: { width: number; height: number }, boxW: number, boxH: number) {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2 };
}

async function standardPdf(cover: Rendered, spreads: Rendered[], back: Rendered | null) {
  const pdf = await PDFDocument.create();
  const pages = back ? [cover, ...spreads, back] : [cover, ...spreads];
  for (const shot of pages) {
    const embedded = await pdf.embedPng(shot.png);
    const page = pdf.addPage([shot.width > shot.height ? 960 : 480, 600]);
    const box = fitRect(shot, page.getWidth(), page.getHeight());
    page.drawImage(embedded, box);
  }
  return pdf.save();
}

function paperRgb(color: string) {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  return rgb(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  );
}

async function bookletPdf(leaves: Rendered[], sheet: [number, number], paper: string, paperPaint?: PaperPaint) {
  const total = paddedPageCount(leaves.length);
  const blanks = Array.from({ length: total - leaves.length }, () => blankLeaf(paper, paperPaint));
  const pages = [...leaves, ...blanks];
  const pdf = await PDFDocument.create();
  const [sheetW, sheetH] = sheet;
  const halfW = sheetW / 2;
  for (const side of bookletSheets(total).flatMap((item) => [item.front, item.back])) {
    const page = pdf.addPage([sheetW, sheetH]);
    page.drawRectangle({ x: 0, y: 0, width: sheetW, height: sheetH, color: paperRgb(paper) });
    for (const [index, place] of [[side.left, 0], [side.right, halfW]] as const) {
      const shot = pages[index];
      const embedded = await pdf.embedPng(shot.png);
      const box = fitRect(shot, halfW - 24, sheetH - 24);
      page.drawImage(embedded, { x: place + 12 + box.x, y: 12 + box.y, width: box.width, height: box.height });
    }
  }
  pdf.setSubject("Print double-sided, flip on the long edge, actual size. Fold each sheet in half and nest them in order, with the cover sheet on the outside.");
  return pdf.save();
}

export async function downloadBookPdf(source: PublicBook, kind: BookPdfKind) {
  const setup = await fetchPlayerSetup();
  const book = ensureBookLayouts(source, { coverUrl: source.coverUrl, characterUrl: characterUrlFor(source) });
  await ensureFonts(book);
  const legal = { credits: setup.credits || "", copyright: setup.copyright || "", logoUrl: setup.logoUrl || "" };
  const textureId = normalizePaperTexture(book.pageTexture);
  const paperPaint: PaperPaint = {
    id: textureId,
    image: textureId ? await loadHtmlImage(paperTextureUrl(textureId)).catch(() => null) : null,
  };
  const cover = await renderLayout(book.coverLayout, book, "cover", false, undefined, paperPaint);
  const back = hasLayout(book.backCoverLayout) ? await renderLayout(book.backCoverLayout, book, "cover", "back", legal, paperPaint) : null;
  const spreads: Rendered[] = [];
  spreads.push(await renderLayout(book.titleLayout, book, "spread", false, undefined, paperPaint));
  for (const page of visibleStoryPages(book)) {
    spreads.push(await renderLayout(page, book, "spread", false, undefined, paperPaint));
  }
  spreads.push(await renderLayout(book.endLayout, book, "spread", "end", legal, paperPaint));
  const name = slugFile(book.title);
  if (kind === "standard") {
    downloadBlob(await standardPdf(cover, spreads, back), `${name}-standard.pdf`);
    return;
  }
  const leaves = [cover];
  for (const spread of spreads) {
    const [left, right] = await halves(spread);
    leaves.push(left, right);
  }
  const paper = book.pageBackground || DEFAULT_PAGE_BACKGROUND;
  const ordered = back ? withOutsideBack(leaves, back, blankLeaf(paper, paperPaint)) : leaves;
  const sheet = kind === "a3-a4" ? A3_LANDSCAPE : A4_LANDSCAPE;
  const label = kind === "a3-a4" ? "A3-folded-to-A4" : "A4-folded-to-A5";
  downloadBlob(await bookletPdf(ordered, sheet, paper, paperPaint), `${name}-${label}.pdf`);
}
