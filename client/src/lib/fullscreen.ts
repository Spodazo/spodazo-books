const FULLSCREEN_KEY = "spodazo-fullscreen";

export type FullscreenDefault = {
  held: boolean;
  active: () => boolean;
  wanted: () => boolean;
  enter: () => void;
  exit: () => void;
};

declare global {
  interface Window {
    spodazoFullscreen?: FullscreenDefault;
  }
}

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

/**
 * Full screen is the default. Browsers still reject it until a click or tap,
 * so a missing choice stays on and only an explicit "0" turns it off.
 * The Mac green button is not this switch.
 */
export function wantsFullscreen(stored: string | null, active: boolean, held = false, admin = false): boolean {
  if (held || admin || active) return false;
  return stored !== "0";
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
