import type { BookListItem, Curator, PlayerSetup, PublicBook } from "@shared/types";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function fetchPlayerSetup(): Promise<PlayerSetup> {
  return fetch("/api/player-setup").then((res) => parse<PlayerSetup>(res));
}

export function updatePlayerSetup(form: FormData): Promise<PlayerSetup> {
  return fetch("/api/admin/player-setup", { method: "PATCH", body: form }).then((res) => parse<PlayerSetup>(res));
}

export function fetchBooks(): Promise<BookListItem[]> {
  return fetch("/api/books").then((res) => parse<BookListItem[]>(res));
}

const bookLoads = new Map<string, Promise<PublicBook>>();

function bookCacheKey(slug: string): string {
  return String(slug || "").toLowerCase();
}

export function invalidateBookCache(slug?: string): void {
  if (slug) bookLoads.delete(bookCacheKey(slug));
  else bookLoads.clear();
}

export function fetchBook(slug: string): Promise<PublicBook> {
  const key = bookCacheKey(slug);
  const pending = bookLoads.get(key);
  if (pending) return pending;
  const load = fetch(`/api/books/${encodeURIComponent(slug)}`)
    .then((res) => parse<PublicBook>(res))
    .finally(() => {
      bookLoads.delete(key);
    });
  bookLoads.set(key, load);
  return load;
}

export function adminMe(): Promise<{ admin: boolean }> {
  return fetch("/api/admin/me").then((res) => parse<{ admin: boolean }>(res));
}

export function adminLogin(password: string): Promise<void> {
  return fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
    .then((res) => parse<{ ok: boolean }>(res))
    .then(() => undefined);
}

export function adminLogout(): Promise<void> {
  return fetch("/api/admin/logout", { method: "POST" })
    .then((res) => parse(res))
    .then(() => undefined);
}

export function fetchCurator(): Promise<Curator> {
  return fetch("/api/admin/curator").then((res) => parse<Curator>(res));
}

export function verifyCuratorPassword(password: string): Promise<void> {
  return fetch("/api/admin/curator/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
    .then((res) => parse<{ ok: boolean }>(res))
    .then(() => undefined);
}

export function updateCurator(fields: {
  currentPassword: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}): Promise<Curator> {
  return fetch("/api/admin/curator", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((res) => parse<Curator>(res));
}

export function recoverCuratorPassword(fields: {
  password: string;
  email?: string;
  recoveryPassword?: string;
}): Promise<void> {
  return fetch("/api/admin/curator/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
    .then((res) => parse<{ ok: boolean }>(res))
    .then(() => undefined);
}

export function uploadBookAsset(blob: Blob, filename: string): Promise<{ url: string; filename: string }> {
  const data = new FormData();
  data.append("file", blob, filename);
  return fetch("/api/admin/book-assets", { method: "POST", body: data, credentials: "same-origin" }).then((res) =>
    parse<{ url: string; filename: string }>(res),
  );
}

export type AiOutline = {
  title: string;
  tagline: string;
  author: string;
  date: string;
  artStyle: string;
  characterDescription: string;
  pages: Array<{ title: string; paragraphs: string[]; illustrationPrompt: string }>;
};

export function generateAiOutline(body: {
  prompt: string;
  audience: "children" | "adults";
  pageCount: number;
  style?: string;
  characters?: Array<{ name: string; description?: string }>;
}): Promise<AiOutline> {
  return fetch("/api/admin/ai-books/outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  }).then((res) => parse<AiOutline>(res));
}

export function generateAiImage(body: {
  kind: "caricature" | "character" | "cover" | "page";
  audience: "children" | "adults";
  prompt?: string;
  artStyle?: string;
  name?: string;
  referenceFiles?: string[];
  filename?: string;
}): Promise<{ url: string; filename: string }> {
  return fetch("/api/admin/ai-books/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  }).then((res) => parse<{ url: string; filename: string }>(res));
}

export function createBook(body: Record<string, unknown>): Promise<PublicBook> {
  return fetch("/api/admin/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  }).then((res) => parse<PublicBook>(res));
}

export function updateBook(id: string, body: Record<string, unknown>): Promise<PublicBook> {
  return fetch(`/api/admin/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  }).then((res) => parse<PublicBook>(res)).then((saved) => {
    invalidateBookCache(saved.slug);
    return saved;
  });
}

export function deleteBook(id: string): Promise<void> {
  return fetch(`/api/admin/books/${encodeURIComponent(id)}`, { method: "DELETE" })
    .then((res) => parse(res))
    .then(() => undefined);
}
