const phoneQuery = "(max-width: 700px), (pointer: coarse) and (max-width: 1100px)";

let lockedTo: "portrait" | "landscape" | null = null;

function orientationApi() {
  return typeof screen !== "undefined" ? screen.orientation : undefined;
}

export function isPhoneViewport() {
  return typeof window !== "undefined" && window.matchMedia(phoneQuery).matches;
}

export function isUprightPhone() {
  if (!isPhoneViewport()) return false;
  if (lockedTo === "portrait") return true;
  if (lockedTo === "landscape") return false;
  return window.matchMedia("(orientation: portrait)").matches;
}

export async function lockReadingOrientation() {
  const api = orientationApi();
  if (!api || typeof api.lock !== "function") return;
  const next = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  try {
    await api.lock(next);
    lockedTo = next;
  } catch {
    lockedTo = null;
  }
}

export function unlockReadingOrientation() {
  const api = orientationApi();
  try {
    api?.unlock();
  } catch {
    /* some browsers throw if nothing is locked */
  }
  lockedTo = null;
}
