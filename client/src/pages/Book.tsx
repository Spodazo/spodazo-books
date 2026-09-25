import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ensureBookLayouts } from "@shared/page-layout";
import { characterUrlFor } from "@shared/reader-pages";
import { DEFAULT_PLAYER_SETUP } from "@shared/seed-data";
import { fetchBook } from "../lib/api";
import { clearBookOpen, openingSince } from "../lib/bookOpen";
import { loadHomeSetup, readCachedSetup } from "../lib/homeCache";
import type { PlayerSetup, PublicBook } from "@shared/types";
import { mountReader } from "../flipbook/reader.js";

export default function BookPage() {
  const [, params] = useRoute("/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [book, setBook] = useState<PublicBook | null>(null);
  const [setup, setSetup] = useState<PlayerSetup>(readCachedSetup() || DEFAULT_PLAYER_SETUP);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setBook(null);
    fetchBook(slug)
      .then((next) => {
        if (!cancelled) setBook(next);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    void loadHomeSetup().then((next) => {
      if (!cancelled) setSetup(next);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin && event.origin !== "null" && event.origin !== window.location.origin) return;
      if (event.data?.type !== "spodazo-close-book") return;
      setLocation("/");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setLocation]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !book) return;
    const fromHome = openingSince() > 0;
    host.style.opacity = fromHome ? "0" : "1";
    const handle = mountReader(host, ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl: characterUrlFor(book) }), {
      libraryUrl: "/",
      fadeOpen: !fromHome,
      baseUrl: location.href,
      credits: setup.credits,
      copyright: setup.copyright,
      logoUrl: setup.logoUrl,
    });
    const reveal = () => {
      const started = openingSince();
      const left = started ? Math.max(700, 1800 - (performance.now() - started)) : 1800;
      host.style.transition = `opacity ${fromHome ? left : 1800}ms ease`;
      host.style.opacity = "1";
      window.setTimeout(clearBookOpen, fromHome ? left : 0);
    };
    if (fromHome) {
      if (handle.frame.contentDocument?.readyState === "complete") reveal();
      else handle.frame.addEventListener("load", reveal, { once: true });
    }
    return () => {
      handle.frame.removeEventListener("load", reveal);
      handle.destroy();
    };
  }, [book, setup.credits, setup.copyright, setup.logoUrl]);

  if (error) {
    return (
      <main className="reader-missing">
        <Link href="/" className="reader-close" aria-label="Close">
          ×
        </Link>
        <p>{error}</p>
      </main>
    );
  }

  return <div id="reader" ref={hostRef} className="reader-host" style={{ opacity: 0 }} />;
}
