import type { BookListItem, PlayerSetup } from "@shared/types";
import { fetchBooks, fetchPlayerSetup } from "./api";
import { applySiteIcons } from "./siteIcons";

export const HOME_BOOKS_KEY = "spodazo-home-books-v2";
export const HOME_SETUP_KEY = "spodazo-home-setup-v1";

const decodedSrcs = new Set<string>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isImageDecoded(src: string): boolean {
  return Boolean(src) && decodedSrcs.has(src);
}

export function markImageDecoded(src: string) {
  if (src) decodedSrcs.add(src);
}

export function readCachedBooks(): BookListItem[] {
  try {
    const raw = storage()?.getItem(HOME_BOOKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BookListItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedBooks(books: BookListItem[]) {
  try {
    storage()?.setItem(HOME_BOOKS_KEY, JSON.stringify(books));
  } catch {
    /* private mode */
  }
}

export function readCachedSetup(): PlayerSetup | null {
  try {
    const raw = storage()?.getItem(HOME_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSetup;
    if (!parsed || typeof parsed !== "object" || typeof parsed.appName !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedSetup(setup: PlayerSetup) {
  try {
    storage()?.setItem(HOME_SETUP_KEY, JSON.stringify(setup));
  } catch {
    /* private mode */
  }
}

export async function loadHomeSetup(): Promise<PlayerSetup> {
  const setup = await fetchPlayerSetup();
  writeCachedSetup(setup);
  applySiteIcons(setup);
  return setup;
}

export async function loadHomeBooks(): Promise<BookListItem[]> {
  const books = await fetchBooks();
  writeCachedBooks(books);
  return books;
}

export function prefetchHome() {
  void loadHomeSetup();
  void loadHomeBooks();
}
