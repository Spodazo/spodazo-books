import html2canvas from "html2canvas";
import { PDFDocument, rgb } from "pdf-lib";
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, fontStack, fontsUsed, googleFontsHref } from "@shared/book-fonts";
import {
  DEFAULT_PAGE_BACKGROUND,
  ensureBookLayouts,
  pageFill,
  publishedLabel,
} from "@shared/page-layout";
import { characterUrlFor, visibleStoryPages } from "@shared/reader-pages";
import { frameClass, frameMarkup } from "@shared/text-frames";
import type { PageElement, PageLayout, PublicBook } from "@shared/types";
import { fetchPlayerSetup } from "../lib/api";
import { bookletSheets, paddedPageCount } from "../lib/booklet";

export type BookPdfKind = "standard" | "a3-a4" | "a4-a5";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const A3_LANDSCAPE: [number, number] = [1190.55, 841.89];

type Rendered = { png: Uint8Array; width: number; height: number };

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
    ...[book.coverLayout, book.titleLayout, book.endLayout, ...book.pages].flatMap((layout) =>
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
  const node = document.createElement(element.type === "image" ? "img" : "div");
  node.style.position = "absolute";
  node.style.left = `${element.x}%`;
  node.style.top = `${element.y}%`;
  node.style.width = `${element.w}%`;
  node.style.height = `${element.h}%`;
  node.style.zIndex = String(element.z || 1);
  node.style.boxSizing = "border-box";
  if (element.type === "image" && node instanceof HTMLImageElement) {
    node.src = element.imageUrl || "";
    node.alt = "";
    node.style.objectFit = element.fit === "contain" ? "contain" : "cover";
    node.style.opacity = String((element.opacity ?? 100) / 100);
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
    node.style.whiteSpace = "pre-wrap";
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

function addLegal(root: HTMLElement, book: PublicBook, credits: string, copyright: string, logoUrl: string) {
  const footer = document.createElement("footer");
  footer.style.cssText = "position:absolute;left:50%;width:50%;bottom:18px;text-align:center;padding:0 8%;box-sizing:border-box;color:#203b2a;z-index:30;";
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

async function snapshot(node: HTMLElement): Promise<Rendered> {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", resolve, { once: true });
  })));
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
  const png = await new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) reject(new Error("Could not draw a page"));
      else resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
  return { png, width: canvas.width, height: canvas.height };
}

async function renderLayout(layout: PageLayout, book: PublicBook, kind: "cover" | "spread", legal = false, extras?: { credits: string; copyright: string; logoUrl: string }) {
  const width = kind === "cover" ? 800 : 1600;
  const height = 1000;
  const root = document.createElement("div");
  root.style.cssText = `position:fixed;left:0;top:0;z-index:-1;pointer-events:none;width:${width}px;height:${height}px;overflow:hidden;background:${pageFill(layout.background, book.pageBackground || DEFAULT_PAGE_BACKGROUND)};`;
  const ink = book.textColor || DEFAULT_TEXT_COLOR;
  const font = book.textFont || DEFAULT_TEXT_FONT;
  layout.elements.slice().sort((a, b) => a.z - b.z).forEach((element) => addElement(root, element, height, ink, font));
  if (legal && extras) addLegal(root, book, extras.credits, extras.copyright, extras.logoUrl);
  document.body.appendChild(root);
  try {
    return await snapshot(root);
  } finally {
    root.remove();
  }
}

function blankLeaf(color: string): Rendered {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare a blank page");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

async function standardPdf(cover: Rendered, spreads: Rendered[]) {
  const pdf = await PDFDocument.create();
  const pages = [cover, ...spreads];
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

async function bookletPdf(leaves: Rendered[], sheet: [number, number], paper: string) {
  const total = paddedPageCount(leaves.length);
  const blanks = Array.from({ length: total - leaves.length }, () => blankLeaf(paper));
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
  const cover = await renderLayout(book.coverLayout, book, "cover");
  const spreads: Rendered[] = [];
  spreads.push(await renderLayout(book.titleLayout, book, "spread"));
  for (const page of visibleStoryPages(book)) {
    spreads.push(await renderLayout(page, book, "spread"));
  }
  spreads.push(await renderLayout(book.endLayout, book, "spread", true, legal));
  const name = slugFile(book.title);
  if (kind === "standard") {
    downloadBlob(await standardPdf(cover, spreads), `${name}-standard.pdf`);
    return;
  }
  const leaves = [cover];
  for (const spread of spreads) {
    const [left, right] = await halves(spread);
    leaves.push(left, right);
  }
  const sheet = kind === "a3-a4" ? A3_LANDSCAPE : A4_LANDSCAPE;
  const label = kind === "a3-a4" ? "A3-folded-to-A4" : "A4-folded-to-A5";
  downloadBlob(await bookletPdf(leaves, sheet, book.pageBackground || DEFAULT_PAGE_BACKGROUND), `${name}-${label}.pdf`);
}
