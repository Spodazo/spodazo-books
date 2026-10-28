const FULLSCREEN_KEY = "spodazo-fullscreen";

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

/** Browsers reject fullscreen until a click or tap. The Mac green button is not that. */
export function wantsFullscreen(stored: string | null, active: boolean): boolean {
  return stored === "1" && !active;
}

export function readFullscreenPreference(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFullscreenPreference(on: boolean): void {
  try {
    if (on) localStorage.setItem(FULLSCREEN_KEY, "1");
    else localStorage.removeItem(FULLSCREEN_KEY);
  } catch {
    /* private mode */
  }
}

export function fullscreenElement(): Element | null {
  const doc = document as FullscreenDoc;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function canFullscreen(): boolean {
  const el = document.documentElement as FullscreenEl;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

export function enterFullscreen(): void {
  const el = document.documentElement as FullscreenEl;
  try {
    if (typeof el.requestFullscreen === "function") void el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* the browser refused, usually because this was not a click */
  }
}

export function exitFullscreen(): void {
  const doc = document as FullscreenDoc;
  try {
    if (typeof document.exitFullscreen === "function") void document.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  } catch {
    /* already back in the window */
  }
}
