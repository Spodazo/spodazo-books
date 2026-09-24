export const PHONE_QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 1100px)";
export const PORTRAIT_QUERY = "(orientation: portrait)";

export function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;
}

export function isPortraitViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PORTRAIT_QUERY).matches;
}

export function isUprightPhone(): boolean {
  return isPhoneViewport() && isPortraitViewport();
}
