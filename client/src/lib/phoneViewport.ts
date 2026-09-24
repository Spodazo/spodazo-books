export const PHONE_QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 1100px)";
export const PORTRAIT_QUERY = "(orientation: portrait)";

export function isPhoneViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

export function isPortraitViewport(): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerHeight && window.innerWidth) return window.innerHeight >= window.innerWidth;
  return window.matchMedia(PORTRAIT_QUERY).matches;
}

export function isUprightPhone(): boolean {
  return isPhoneViewport() && isPortraitViewport();
}
