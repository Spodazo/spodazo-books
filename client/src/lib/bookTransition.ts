export const BOOK_SHELL_FADE_MS = 420;

let closing = false;

export function beginBookClose(): Promise<void> {
  if (closing) return Promise.resolve();
  closing = true;
  document.documentElement.classList.add("book-closing");
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve();
    }, BOOK_SHELL_FADE_MS);
  });
}

export function resetBookTransition() {
  closing = false;
  document.documentElement.classList.remove("book-closing");
}

export function playLibraryEnter() {
  document.documentElement.classList.add("library-enter");
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("library-enter");
    });
  });
}

export type BookCloseMessage = { type: "spodazo-book-close"; href?: string };

export function isBookCloseMessage(data: unknown): data is BookCloseMessage {
  return Boolean(data && typeof data === "object" && (data as BookCloseMessage).type === "spodazo-book-close");
}
