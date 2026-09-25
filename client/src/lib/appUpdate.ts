import { clearHomeClientCache } from "./homeCache";

const BUILD_PARAM = "_spodazo";
const REVISION_KEY = "spodazo-app-rev";
const CHECK_MS = 15000;
const NO_STORE: RequestInit = {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
};

export type AppVersionInfo = {
  build?: string;
  libraryAt?: string;
};

export function appRevisionKey(info: AppVersionInfo): string {
  const build = String(info.build || "");
  const libraryAt = String(info.libraryAt || "");
  return `${build}|${libraryAt}`;
}

export function shouldApplyUpdate(current: string, next: string): boolean {
  return Boolean(current && next && current !== next);
}

function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://books.spodazo.com";
}

export function buildReloadUrl(href: string, build: string): string {
  const url = new URL(href, appOrigin());
  url.searchParams.set(BUILD_PARAM, build.slice(0, 16) || String(Date.now()));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripBuildParam(href: string): string {
  const url = new URL(href, appOrigin());
  if (!url.searchParams.has(BUILD_PARAM)) return `${url.pathname}${url.search}${url.hash}`;
  url.searchParams.delete(BUILD_PARAM);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function readStoredRevision(): string {
  try {
    return sessionStorage.getItem(REVISION_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredRevision(revision: string) {
  try {
    if (revision) sessionStorage.setItem(REVISION_KEY, revision);
  } catch {
    /* private mode */
  }
}

export async function applyAppUpdate(info: AppVersionInfo): Promise<void> {
  clearHomeClientCache();
  writeStoredRevision(appRevisionKey(info));
  window.location.replace(buildReloadUrl(window.location.href, String(info.build || Date.now())));
}

async function fetchAppVersion(): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch("/api/version", NO_STORE);
    if (!res.ok) return null;
    return (await res.json()) as AppVersionInfo;
  } catch {
    return null;
  }
}

export function watchAppUpdates() {
  let current = "";
  function dropBuildFromAddress() {
    const next = stripBuildParam(window.location.href);
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== now) window.history.replaceState(window.history.state, "", next);
  }
  dropBuildFromAddress();

  async function check() {
    const body = await fetchAppVersion();
    if (!body?.build) return;
    const next = appRevisionKey(body);
    if (!current) {
      const stored = readStoredRevision();
      if (stored && shouldApplyUpdate(stored, next)) {
        await applyAppUpdate(body);
        return;
      }
      current = next;
      writeStoredRevision(next);
      return;
    }
    if (shouldApplyUpdate(current, next)) await applyAppUpdate(body);
  }

  void check();
  window.setInterval(() => void check(), CHECK_MS);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void check();
  });
  window.addEventListener("focus", () => void check());
}
