const listeners = new Set<() => void>();
let started = 0;

function emit() {
  listeners.forEach((fn) => fn());
}

export function markBookOpen(options?: { bundled?: boolean }) {
  started = performance.now();
  document.documentElement.classList.add("book-opening");
  document.documentElement.classList.toggle("book-opening-bundled", Boolean(options?.bundled));
  emit();
}

export function openingSince() {
  return started;
}

export function clearBookOpen() {
  if (!started) return;
  started = 0;
  document.documentElement.classList.remove("book-opening", "book-opening-bundled");
  emit();
}

export function onBookOpenChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
