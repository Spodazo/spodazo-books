import { clearBookOpen, openingSince } from "./bookOpen";
import { BOOK_SHELL_FADE_MS } from "./bookTransition";

export type ReaderReadyMessage = { type: "spodazo-reader-ready" };

export function isReaderReadyMessage(data: unknown): data is ReaderReadyMessage {
  return Boolean(data && typeof data === "object" && (data as ReaderReadyMessage).type === "spodazo-reader-ready");
}

function isMobilePortrait(): boolean {
  return (
    window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1100px)").matches &&
    window.matchMedia("(orientation: portrait)").matches
  );
}

export function shellRevealDurationMs(fromHome: boolean): number {
  const base = isMobilePortrait() ? 240 : 360;
  if (!fromHome) return base;
  const started = openingSince();
  const elapsed = started ? performance.now() - started : 0;
  return Math.max(isMobilePortrait() ? 180 : 260, Math.min(base, BOOK_SHELL_FADE_MS - elapsed));
}

/** Fade the reader shell in only after the iframe flipbook has finished its first layout. */
export function attachReaderReveal(host: HTMLElement, frame: HTMLIFrameElement, fromHome: boolean): () => void {
  host.style.opacity = "0";
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const ms = shellRevealDurationMs(fromHome);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        host.style.transition = `opacity ${ms}ms ease`;
        host.style.opacity = "1";
        window.setTimeout(clearBookOpen, fromHome ? ms + 32 : 0);
      });
    });
  };
  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    if (isReaderReadyMessage(event.data)) reveal();
  };
  window.addEventListener("message", onMessage);
  const fallback = window.setTimeout(reveal, 2800);
  return () => {
    window.clearTimeout(fallback);
    window.removeEventListener("message", onMessage);
  };
}
