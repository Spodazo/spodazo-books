const listeners = new Set<() => void>();
let started = 0;

function emit() {
  listeners.forEach((fn) => fn());
}

export function markBookOpen() {
  started = performance.now();
  document.documentElement.classList.add("book-opening");
  emit();
}

export function openingSince() {
  return started;
}

export function clearBookOpen() {
  if (!started) return;
  started = 0;
  document.documentElement.classList.remove("book-opening");
  emit();
}

export function onBookOpenChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Opacity fade for the reader shell after the flipbook has laid out (ms). */
export function readerRevealMs(): number {
  if (typeof window === "undefined") return 500;
  const mobile =
    window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1100px)").matches &&
    window.matchMedia("(orientation: portrait)").matches;
  return mobile ? 280 : 450;
}

/** Library fade when leaving home for a book (ms). */
export function libraryOpenFadeMs(): number {
  if (typeof window === "undefined") return 450;
  const mobile =
    window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1100px)").matches &&
    window.matchMedia("(orientation: portrait)").matches;
  return mobile ? 280 : 450;
}
