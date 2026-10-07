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

function parsePageSuffix(label: string): { label: string; destPage?: number } {
  const dotted = DOTTED_ENTRY.exec(label);
  if (dotted) return { label: dotted[1].trim(), destPage: Number(dotted[2]) };
  const titled = TITLE_PAGE_ENTRY.exec(label);
  if (titled && Number(titled[2]) >= 1 && Number(titled[2]) <= 200) {
    return { label: titled[1].trim(), destPage: Number(titled[2]) };
  }
  return { label };
}

function parseEntry(text: string): { label: string; destPage?: number; number?: string } | null {
  const numbered = NUMBERED_ENTRY.exec(text);
  if (numbered) return { number: numbered[1], ...parsePageSuffix(numbered[2].trim()) };
  const dotted = DOTTED_ENTRY.exec(text);
  if (dotted) return { label: dotted[1].trim(), destPage: Number(dotted[2]) };
  const titled = TITLE_PAGE_ENTRY.exec(text);
  if (titled && Number(titled[2]) >= 1 && Number(titled[2]) <= 200) {
    return { label: titled[1].trim(), destPage: Number(titled[2]) };
  }
  return null;
}

function entryNumber(value?: string): string {
  if (!value) return "";
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? String(n) : "";
}

function rawHeadings(page: PdfIndexPageInput, bookTitle: string): string[] {
  const lines = groupPdfLines(page.items)
    .map((line) => line.text.trim())
    .filter((text) => !isNoiseLine(text, bookTitle));
  return [page.title || "", ...lines.slice(0, 8)].map((text) => String(text || "").trim()).filter(Boolean);
}

/** PDF.js y after the viewport transform is the glyph baseline from the top of the page. */
export function lineBoxTopPercent(line: Pick<IndexLine, "y" | "size">, height: number): number {
  return clampPercent(((line.y - line.size * 0.95) / height) * 100, 20);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function destScore(
  entry: { label: string; destPage?: number; number?: string },
  page: PdfIndexPageInput,
  contentsPage: number,
  bookTitle: string,
): number {
  if (page.sourcePage === contentsPage) return 0;
  const needle = normalizeIndexTitle(entry.label);
  const number = entryNumber(entry.number);
  const headings = rawHeadings(page, bookTitle);
  let score = 0;
  for (const raw of headings) {
    const parsed = parseEntry(raw);
    const title = normalizeIndexTitle(raw);
    if (number && entryNumber(parsed?.number) === number) score = Math.max(score, 220);
    if (needle && title === needle) score = Math.max(score, 180);
    if (needle.length >= 4 && title.startsWith(`${needle} `)) score = Math.max(score, 90);
    if (needle.length >= 6 && new RegExp(`(?:^| )${escapeRegExp(needle)}(?: |$)`).test(title)) {
      score = Math.max(score, 70);
    }
  }
  const listed = Math.floor(Number(entry.destPage) || 0);
  if (listed === page.sourcePage && score > 0) score += 15;
  if (page.sourcePage > contentsPage && score > 0) score += 5;
  return score;
}

function assignDestinations(
  entries: Array<{ label: string; destPage?: number; number?: string }>,
  pages: PdfIndexPageInput[],
  contentsPage: number,
  bookTitle: string,
): number[] {
  const dests = entries.map(() => 0);
  const scored: Array<{ index: number; page: number; score: number }> = [];
  entries.forEach((entry, index) => {
    for (const page of pages) {
      const score = destScore(entry, page, contentsPage, bookTitle);
      if (score > 0) scored.push({ index, page: page.sourcePage, score });
    }
  });
  scored.sort((a, b) => b.score - a.score || a.page - b.page || a.index - b.index);
  const usedPages = new Set<number>();
  const usedEntries = new Set<number>();
  for (const hit of scored) {
    if (usedEntries.has(hit.index) || usedPages.has(hit.page)) continue;
    dests[hit.index] = hit.page;
    usedEntries.add(hit.index);
    usedPages.add(hit.page);
  }
  return dests;
}

function boxFromLine(line: IndexLine, next: IndexLine | undefined, width: number, height: number): Pick<PageJumpLink, "top" | "left" | "width" | "height"> {
  const top = lineBoxTopPercent(line, height);
  const bottom = next
    ? lineBoxTopPercent(next, height)
    : clampPercent(((line.y + line.size * 1.2) / height) * 100, top + 3.2);
  const left = clampPercent((line.x / width) * 100 - 3, 10, 4, 40);
  const right = clampPercent((line.right / width) * 100 + 8, 90, left + 24, 96);
  return {
    top,
    left,
    width: Math.max(28, right - left),
    height: Math.max(2.8, bottom - top),
  };
}

function expandAnnotationBox(item: PdfLinkAnnotation): PageJumpLink {
  let top = clampPercent(item.top, 20);
  let height = clampPercent(item.height, 3.2, 2, 20);
  if (height < 4.2) {
    const grow = 4.2 - height;
    top = clampPercent(top - grow * 0.8, top);
    height = 4.2;
  }
  return {
    page: item.destPage,
    label: String(item.label || `Page ${item.destPage}`).trim(),
    top,
    left: clampPercent(item.left, 12),
    width: clampPercent(item.width, 56, 8, 96),
    height,
  };
}

function annotationLinks(page: PdfIndexPageInput): PageJumpLink[] {
  const anns = (page.annotations || []).filter((item) => item.destPage >= 1 && item.destPage !== page.sourcePage);
  if (anns.length < 2) return [];
  return anns.map(expandAnnotationBox);
}

function nearestAnnotation(anns: PdfLinkAnnotation[], top: number): PdfLinkAnnotation | undefined {
  let best: PdfLinkAnnotation | undefined;
  let bestDist = 6;
  for (const ann of anns) {
    const dist = Math.abs(ann.top - top);
    if (dist < bestDist) {
      best = ann;
      bestDist = dist;
    }
  }
  return best;
}

function textLinkCandidates(page: PdfIndexPageInput, bookTitle: string) {
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
    if (numbered < 3) return [];
  }
  return candidates;
}

function preferDest(textDest: number, annDest: number, entry: { label: string; number?: string }, pages: PdfIndexPageInput[]): number {
  if (!textDest) return annDest;
  if (!annDest) return textDest;
  if (textDest === annDest) return textDest;
  if (entry.number) return textDest;
  const page = pages.find((item) => item.sourcePage === textDest);
  if (page && normalizeIndexTitle(page.title || "") === normalizeIndexTitle(entry.label)) return textDest;
  return annDest;
}

function textLinks(page: PdfIndexPageInput, pages: PdfIndexPageInput[], bookTitle: string): PageJumpLink[] {
  const candidates = textLinkCandidates(page, bookTitle);
  if (!candidates.length) return [];
  const dests = assignDestinations(candidates.map((item) => item.entry), pages, page.sourcePage, bookTitle);
  const anns = (page.annotations || []).filter((item) => item.destPage >= 1 && item.destPage !== page.sourcePage);
  const links: PageJumpLink[] = [];
  candidates.forEach((item, index) => {
    const box = boxFromLine(item.line, candidates[index + 1]?.line, page.width, page.height);
    const ann = nearestAnnotation(anns, box.top);
    const dest = preferDest(dests[index] || 0, ann?.destPage || 0, item.entry, pages);
    if (!dest) return;
    links.push({
      page: dest,
      label: item.entry.number ? `${item.entry.number} ${item.entry.label}` : item.entry.label,
      ...box,
    });
  });
  return links;
}

/** Find song-list / contents / index taps on imported PDF pages. */
export function detectPdfIndexLinks(pages: PdfIndexPageInput[], bookTitle = ""): Map<number, PageJumpLink[]> {
  const found = new Map<number, PageJumpLink[]>();
  for (const page of pages) {
    const fromText = textLinks(page, pages, bookTitle);
    const links = fromText.length >= 2 ? fromText : annotationLinks(page);
    if (links.length >= 2) found.set(page.sourcePage, links);
  }
  return found;
}

function pageFromTitles(pages: Array<{ sourcePage?: number; title?: string; paragraphs?: string[] }>): PdfIndexPageInput[] {
  return pages.map((page, index) => ({
    sourcePage: page.sourcePage || index + 1,
    width: 100,
    height: 100,
    title: page.title,
    items: [
      { text: page.title || "", x: 8, y: 10, size: 16 },
      ...(page.paragraphs || []).slice(0, 4).map((text, line) => ({
        text,
        x: 8,
        y: 28 + line * 14,
        size: 12,
      })),
    ],
  }));
}

function repairContentsLine(text: string): string {
  return text.replace(/^([0-9Il|]{1,2})(?=\s)/, (raw) => raw.replace(/[Il|]/g, "1"));
}

function isSongTitle(title: string): boolean {
  const value = title.trim();
  if (!value || isNumberedPageLabel(value)) return false;
  return !/^(lyrics|verse\b|forward|contents|songs?)$/i.test(value);
}

export type MatchedContentsRow = { label: string; page: number; top: number };

/**
 * Point each contents row at the song page with that title.
 * A row that names a song not in the book stays unmatched. It is not given another song.
 */
export function matchSongListToPages(
  lines: Array<{ text: string; top: number }>,
  pages: Array<{ sourcePage?: number; title?: string }>,
): MatchedContentsRow[] {
  const songs = pages
    .map((page, index) => ({ sourcePage: page.sourcePage || index + 1, title: String(page.title || "").trim() }))
    .filter((page) => isSongTitle(page.title));
  const rows = lines
    .map((line) => {
      const text = repairContentsLine(line.text).trim();
      if (!text) return null;
      const hay = normalizeIndexTitle(text);
      const namesASong = songs.some((song) => {
        const title = normalizeIndexTitle(song.title);
        return title.length >= 8 && hay.includes(title);
      });
      if (!namesASong && !/\d{1,2}\s+[A-Za-z]/.test(text)) return null;
      const entry = parseEntry(text);
      return {
        label: entry?.number ? `${entry.number} ${entry.label}` : text,
        text,
        top: line.top,
      };
    })
    .filter((row): row is { label: string; text: string; top: number } => Boolean(row));
  const dests = rows.map(() => 0);
  const labels = rows.map((row) => row.label);
  const scored: Array<{ index: number; song: number; score: number }> = [];
  rows.forEach((row, index) => {
    const hay = normalizeIndexTitle(row.text);
    songs.forEach((song, songIndex) => {
      const title = normalizeIndexTitle(song.title);
      if (title.length < 4) return;
      let score = 0;
      if (hay === title || hay.endsWith(` ${title}`) || hay.includes(title)) score = 200;
      else {
        const left = new Set(hay.split(" ").filter((word) => word.length > 2));
        const right = title.split(" ").filter((word) => word.length > 2);
        const hit = right.filter((word) => left.has(word)).length;
        if (hit >= 3 && hit / right.length >= 0.6) score = 140;
      }
      if (score) scored.push({ index, song: songIndex, score });
    });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const usedRows = new Set<number>();
  const usedSongs = new Set<number>();
  for (const hit of scored) {
    if (usedRows.has(hit.index) || usedSongs.has(hit.song)) continue;
    dests[hit.index] = songs[hit.song].sourcePage;
    labels[hit.index] = songs[hit.song].title;
    usedRows.add(hit.index);
    usedSongs.add(hit.song);
  }
  return rows.map((row, index) => ({ label: labels[index], page: dests[index], top: row.top }));
}

/** Move existing contents taps onto the matched song without shifting later rows. */
export function realignIndexLinks<T extends PageJumpLink>(links: T[], rows: MatchedContentsRow[]): T[] {
  const used = new Set<number>();
  return links.map((link) => {
    let best = -1;
    let dist = 2.6;
    rows.forEach((row, index) => {
      if (used.has(index) || !row.page) return;
      const gap = Math.abs(row.top - link.top);
      if (gap < dist) {
        dist = gap;
        best = index;
      }
    });
    if (best < 0) return link;
    used.add(best);
    return { ...link, page: rows[best].page, label: rows[best].label };
  });
}

/** Same reading order: the first tap goes to the first song row, and so on. */
export function realignIndexLinksByOrder<T extends PageJumpLink>(links: T[], rows: MatchedContentsRow[]): T[] {
  const orderedLinks = links.map((link, index) => ({ link, index })).sort((a, b) => a.link.top - b.link.top || a.index - b.index);
  const orderedRows = rows.filter((row) => row.page > 0).slice().sort((a, b) => a.top - b.top);
  if (orderedRows.length !== orderedLinks.length) return links;
  const next = links.slice();
  orderedLinks.forEach((item, index) => {
    next[item.index] = { ...item.link, page: orderedRows[index].page, label: orderedRows[index].label };
  });
  return next;
}

/** "Page 4" is a page number, not a title. Matching it to every "Page N" title shifts the tap onto the previous leaf. */
function isNumberedPageLabel(label: string): boolean {
  return /^page(?:\s+\d{1,3})?$/i.test(String(label || "").trim());
}

/** Re-aim stored taps using later page titles when a better unique match exists. */
export function retargetStoredIndexLinks<T extends { sourcePage?: number; title?: string; paragraphs?: string[]; links?: PageJumpLink[] }>(
  pages: T[],
): T[] {
  const indexPages = pageFromTitles(pages);
  return pages.map((page, index) => {
    const links = page.links || [];
    if (links.length < 2) return page;
    const sourcePage = page.sourcePage || index + 1;
    const entries = links.map((link) => {
      const parsed = parseEntry(link.label) || { label: link.label };
      if (isNumberedPageLabel(link.label) || isNumberedPageLabel(parsed.label || "")) {
        return { label: "" };
      }
      return parsed;
    });
    const dests = assignDestinations(entries, indexPages, sourcePage, "");
    let changed = false;
    const next = links.map((link, linkIndex) => {
      const dest = dests[linkIndex];
      if (!dest || dest === link.page) return link;
      changed = true;
      return { ...link, page: dest };
    });
    return changed ? { ...page, links: next } : page;
  });
}

export function facsimilePageLinks(
  pages: Array<{ sourcePage?: number; title?: string; paragraphs?: string[]; links?: PageJumpLink[] }>,
): Record<string, PageJumpLink[]> {
  const map: Record<string, PageJumpLink[]> = {};
  retargetStoredIndexLinks(pages).forEach((page, index) => {
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

export function indexLinksEqual(left?: PageJumpLink[] | null, right?: PageJumpLink[] | null): boolean {
  const a = left || [];
  const b = right || [];
  if (a.length !== b.length) return false;
  return a.every((link, index) => {
    const other = b[index];
    return (
      link.page === other.page &&
      link.label === other.label &&
      Math.abs(link.top - other.top) < 0.05 &&
      Math.abs(link.left - other.left) < 0.05 &&
      Math.abs(link.width - other.width) < 0.05 &&
      Math.abs(link.height - other.height) < 0.05
    );
  });
}
