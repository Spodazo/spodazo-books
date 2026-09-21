import { bodyParagraphs } from "./page-layout";
import type { Book, BookPage } from "./types";

export function isWillowBook(book: { slug?: string | null; title?: string | null }): boolean {
  return /willow/i.test(String(book.slug || "")) || /willow/i.test(String(book.title || ""));
}

function pageStoryText(page: BookPage): string {
  return [page.title, ...(page.paragraphs || []), ...bodyParagraphs(page.elements || [])]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateTitlePage(book: Pick<Book, "title" | "slug">, page: BookPage, index: number): boolean {
  if (index !== 0) return false;
  if (isWillowBook(book)) return true;
  const title = String(book.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (title.length < 6) return false;
  const body = pageStoryText(page);
  if (!body) return false;
  if (body.includes(title)) return true;
  const words = title.split(" ").filter((word) => word.length > 3);
  return words.length > 0 && words.every((word) => body.includes(word));
}

export function visibleStoryPages<T extends Pick<Book, "title" | "slug" | "pages">>(book: T): T["pages"] {
  return book.pages.filter((page, index) => !isDuplicateTitlePage(book, page, index));
}

export function characterUrlFor(book: { slug?: string | null; title?: string | null; characterUrl?: string | null }): string {
  return book.characterUrl || (isWillowBook(book) ? "/media/images/willow-character.webp" : "");
}
