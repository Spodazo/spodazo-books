import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import AdminLoginLink from "../components/AdminLoginLink";
import { ensureBookLayouts } from "@shared/page-layout";
import { DEFAULT_PLAYER_SETUP } from "@shared/seed-data";
import { fetchBook } from "../lib/api";
import { loadHomeSetup, readCachedSetup } from "../lib/homeCache";
import type { PlayerSetup, PublicBook } from "@shared/types";
import { mountReader } from "../flipbook/reader.js";

export default function BookPage() {
  const [, params] = useRoute("/:slug");
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
    const host = hostRef.current;
    if (!host || !book) return;
    const characterUrl = /willow/i.test(book.slug) || /willow/i.test(book.title) ? "/media/images/willow-character.webp" : "";
    const handle = mountReader(host, ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl }), {
      libraryUrl: "/",
      baseUrl: location.href,
      credits: setup.credits,
      copyright: setup.copyright,
      logoUrl: setup.logoUrl,
    });
    return () => handle.destroy();
  }, [book, setup.credits, setup.copyright, setup.logoUrl]);

  if (error) {
    return (
      <main className="reader-missing">
        <Link href="/" className="reader-close" aria-label="Close">
          ×
        </Link>
        <AdminLoginLink />
        <p>{error}</p>
      </main>
    );
  }

  return <div id="reader" ref={hostRef} className="reader-host" />;
}
