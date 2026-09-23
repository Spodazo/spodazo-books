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
