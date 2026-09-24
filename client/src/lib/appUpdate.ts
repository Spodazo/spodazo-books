const BUILD_PARAM = "_spodazo";
const CHECK_MS = 15000;
const NO_STORE: RequestInit = {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
};

export function shouldApplyUpdate(current: string, next: string): boolean {
  return Boolean(current && next && current !== next);
}

export function buildReloadUrl(href: string, build: string): string {
  const url = new URL(href, "https://books.spodazo.com");
  url.searchParams.set(BUILD_PARAM, build.slice(0, 16) || String(Date.now()));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripBuildParam(href: string): string {
  const url = new URL(href, "https://books.spodazo.com");
  if (!url.searchParams.has(BUILD_PARAM)) return `${url.pathname}${url.search}${url.hash}`;
  url.searchParams.delete(BUILD_PARAM);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export async function applyAppUpdate(build: string): Promise<void> {
  window.location.replace(buildReloadUrl(window.location.href, build));
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
    try {
      const res = await fetch("/api/version", NO_STORE);
      if (!res.ok) return;
      const body = (await res.json()) as { build?: string };
      const build = String(body.build || "");
      if (!build) return;
      if (!current) {
        current = build;
        return;
      }
      const path = window.location.pathname;
      if (path !== "/" && !path.startsWith("/admin")) return;
      if (shouldApplyUpdate(current, build)) await applyAppUpdate(build);
    } catch {
      /* offline */
    }
  }
  void check();
  window.setInterval(() => void check(), CHECK_MS);
}
