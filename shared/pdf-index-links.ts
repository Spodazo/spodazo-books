export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  size: number;
};

export type PdfLinkAnnotation = {
  destPage: number;
  left: number;
  top: number;
  width: number;
  height: number;
  label?: string;
};

export type PdfIndexPageInput = {
  sourcePage: number;
  width: number;
  height: number;
  title?: string;
  items: PdfTextItem[];
  annotations?: PdfLinkAnnotation[];
};

export type PageJumpLink = {
  page: number;
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type IndexLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  right: number;
};

const INDEX_HEADING = /^(table of contents|contents|songs?|song list|index|playlist|catalogue|catalog)$/i;
const PAGE_COUNTER = /^\d{1,3}\s*\/\s*\d{1,3}$/;
const NUMBERED_ENTRY = /^(?:song\s+)?(\d{1,2})\s*[.):\-–]?\s+(.{3,80})$/i;
const DOTTED_ENTRY = /^(.{3,80}?)\s+[\.·…•]{2,}\s*(\d{1,3})$/;
const TITLE_PAGE_ENTRY = /^(.{3,80}?)\s+(\d{1,3})$/;

export function normalizeIndexTitle(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/^[0-9]{1,2}\s*[.):\-–]?\s+/, "")
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function groupPdfLines(items: PdfTextItem[]): IndexLine[] {
  const rows: Array<{ y: number; size: number; items: PdfTextItem[] }> = [];
  const sorted = items
    .filter((item) => String(item.text || "").trim())
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const item of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) < Math.max(item.size, candidate.size) * 0.45);
    if (!row) rows.push({ y: item.y, size: item.size, items: [item] });
    else {
      row.items.push(item);
      row.size = Math.max(row.size, item.size);
    }
  }
  return rows.map((row) => {
    const parts = row.items.slice().sort((a, b) => a.x - b.x);
    return {
      text: parts.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(),
      x: Math.min(...parts.map((item) => item.x)),
      y: row.y,
      size: row.size,
      right: Math.max(...parts.map((item) => item.x + Math.max(item.size, 8) * Math.max(1, item.text.length) * 0.42)),
    };
  });
}

function clampPercent(value: number, fallback: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isNoiseLine(text: string, bookTitle = ""): boolean {
  const trimmed = text.trim();
  if (!trimmed || PAGE_COUNTER.test(trimmed)) return true;
  if (INDEX_HEADING.test(trimmed)) return true;
  if (NUMBERED_ENTRY.test(trimmed) || DOTTED_ENTRY.test(trimmed) || TITLE_PAGE_ENTRY.test(trimmed)) return false;
  const title = normalizeIndexTitle(bookTitle);
  return Boolean(title && normalizeIndexTitle(trimmed) === title);
}

function pageHaystack(page: PdfIndexPageInput, bookTitle: string): string {
  const lines = groupPdfLines(page.items)
    .map((line) => line.text)
    .filter((text) => !isNoiseLine(text, bookTitle));
  return normalizeIndexTitle([page.title || "", ...lines.slice(0, 8)].join(" "));
}

function parseEntry(text: string): { label: string; destPage?: number; number?: string } | null {
  const numbered = NUMBERED_ENTRY.exec(text);
  if (numbered) return { number: numbered[1], label: numbered[2].trim() };
  const dotted = DOTTED_ENTRY.exec(text);
  if (dotted) return { label: dotted[1].trim(), destPage: Number(dotted[2]) };
  const titled = TITLE_PAGE_ENTRY.exec(text);
  if (titled && Number(titled[2]) >= 1 && Number(titled[2]) <= 200) {
    return { label: titled[1].trim(), destPage: Number(titled[2]) };
  }
  return null;
}

function findDestPage(
  entry: { label: string; destPage?: number },
  pages: PdfIndexPageInput[],
  contentsPage: number,
  bookTitle: string,
): number {
  const listed = Math.floor(Number(entry.destPage) || 0);
  if (listed >= 1 && listed <= pages.length && listed !== contentsPage) return listed;
  const needle = normalizeIndexTitle(entry.label);
  if (needle.length < 4) return 0;
  let best = 0;
  let bestScore = 0;
  for (const page of pages) {
    if (page.sourcePage === contentsPage) continue;
    const hay = pageHaystack(page, bookTitle);
    if (!hay.includes(needle)) continue;
    const score = needle.length + (page.sourcePage > contentsPage ? 12 : 0);
    if (score > bestScore) {
      best = page.sourcePage;
      bestScore = score;
    }
  }
  return best;
}

function boxFromLine(line: IndexLine, next: IndexLine | undefined, width: number, height: number): Pick<PageJumpLink, "top" | "left" | "width" | "height"> {
  const top = clampPercent(((line.y - line.size * 0.35) / height) * 100, 20);
  const bottom = next
    ? clampPercent((next.y / height) * 100, top + 3.2)
    : clampPercent(top + (line.size * 2.4 / height) * 100, top + 3.2);
  const left = clampPercent((line.x / width) * 100 - 2, 10, 4, 40);
  const right = clampPercent((line.right / width) * 100 + 4, 88, left + 20, 96);
  return {
    top,
    left,
    width: Math.max(20, right - left),
    height: Math.max(2.6, bottom - top),
  };
}

function annotationLinks(page: PdfIndexPageInput): PageJumpLink[] {
  const anns = (page.annotations || []).filter((item) => item.destPage >= 1 && item.destPage !== page.sourcePage);
  if (anns.length < 2) return [];
  return anns.map((item) => ({
    page: item.destPage,
    label: String(item.label || `Page ${item.destPage}`).trim(),
    top: clampPercent(item.top, 20),
    left: clampPercent(item.left, 12),
    width: clampPercent(item.width, 56, 8, 96),
    height: clampPercent(item.height, 3.2, 2, 20),
  }));
}

function textLinks(page: PdfIndexPageInput, pages: PdfIndexPageInput[], bookTitle: string): PageJumpLink[] {
  const lines = groupPdfLines(page.items);
  const heading = lines.some((line) => INDEX_HEADING.test(line.text.trim()));
  const candidates: Array<{ line: IndexLine; entry: NonNullable<ReturnType<typeof parseEntry>> }> = [];
  for (const line of lines) {
    if (isNoiseLine(line.text, bookTitle)) continue;
    const entry = parseEntry(line.text);
    if (!entry) continue;
    candidates.push({ line, entry });
  }
  if (candidates.length < 2) return [];
  if (!heading) {
    const numbered = candidates.filter((item) => item.entry.number).length;
    if (numbered < 3 && candidates.length < 3) return [];
  }
  const links: PageJumpLink[] = [];
  candidates.forEach((item, index) => {
    const dest = findDestPage(item.entry, pages, page.sourcePage, bookTitle);
    if (!dest) return;
    links.push({
      page: dest,
      label: item.entry.number ? `${item.entry.number} ${item.entry.label}` : item.entry.label,
      ...boxFromLine(item.line, candidates[index + 1]?.line, page.width, page.height),
    });
  });
  return links;
}

/** Find song-list / contents / index taps on imported PDF pages. */
export function detectPdfIndexLinks(pages: PdfIndexPageInput[], bookTitle = ""): Map<number, PageJumpLink[]> {
  const found = new Map<number, PageJumpLink[]>();
  for (const page of pages) {
    const fromAnnots = annotationLinks(page);
    const links = fromAnnots.length ? fromAnnots : textLinks(page, pages, bookTitle);
    if (links.length >= 2) found.set(page.sourcePage, links);
  }
  return found;
}

export function facsimilePageLinks(
  pages: Array<{ sourcePage?: number; links?: PageJumpLink[] }>,
): Record<string, PageJumpLink[]> {
  const map: Record<string, PageJumpLink[]> = {};
  pages.forEach((page, index) => {
    const links = (page.links || []).filter((link) => Number(link.page) >= 1);
    if (!links.length) return;
    map[String(page.sourcePage || index + 1)] = links;
  });
  return map;
}

export function normalizePageJumpLinks(raw: unknown): PageJumpLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        page: Math.max(0, Math.floor(Number(record.page) || 0)),
        label: String(record.label || "").trim() || `Page ${record.page || ""}`,
        top: clampPercent(Number(record.top), 0),
        left: clampPercent(Number(record.left), 10),
        width: clampPercent(Number(record.width), 56, 8, 100),
        height: clampPercent(Number(record.height), 3.2, 2, 24),
      };
    })
    .filter((link) => link.page >= 1);
}
