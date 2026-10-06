import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { bundledFlipbookSrcForBook, isBundledFlipbookSlug } from "@shared/bundled-flipbooks";
import { ensureBookLayouts } from "@shared/page-layout";
import { characterUrlFor } from "@shared/reader-pages";
import { DEFAULT_PLAYER_SETUP } from "@shared/seed-data";
import { fetchBook, invalidateBookCache } from "../lib/api";
import { beginBookClose, isBookCloseMessage, resetBookTransition } from "../lib/bookTransition";
import { clearBookOpen } from "../lib/bookOpen";
import { attachReaderReveal } from "../lib/readerReveal";
import { loadHomeSetup, readCachedSetup } from "../lib/homeCache";
import type { PlayerSetup, PublicBook } from "@shared/types";
import { mountReader } from "../flipbook/reader.js";

export default function BookPage() {
  const [, params] = useRoute("/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const hostRef = useRef<HTMLDivElement>(null);
  const bundledHostRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [error, setError] = useState("");
  const [book, setBook] = useState<PublicBook | null>(null);
  const [setup, setSetup] = useState<PlayerSetup>(readCachedSetup() || DEFAULT_PLAYER_SETUP);

  const closeToLibrary = useCallback(async (href = "/") => {
    if (closingRef.current) return;
    closingRef.current = true;
    await beginBookClose();
    resetBookTransition();
    clearBookOpen();
    setLocation(href);
    closingRef.current = false;
  }, [setLocation]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin) return;
      if (!isBookCloseMessage(event.data)) return;
      void closeToLibrary(event.data.href || "/");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [closeToLibrary]);

  useEffect(() => {
    if (slug && (isBundledFlipbookSlug(slug) || book?.bundledFlipbookDir)) {
      document.documentElement.classList.add("book-opening-bundled");
    }
    return () => {
      document.documentElement.classList.remove("book-opening-bundled");
    };
  }, [slug, book?.bundledFlipbookDir]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setBook(null);
    invalidateBookCache(slug);
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

  const bundledSrc = book ? bundledFlipbookSrcForBook(book, import.meta.env.BASE_URL) : "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !book || bundledSrc) return;
    const fromHome = Boolean(document.documentElement.classList.contains("book-opening"));
    const handle = mountReader(host, ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl: characterUrlFor(book) }), {
      libraryUrl: "/",
      fadeOpen: false,
      baseUrl: location.href,
      credits: setup.credits,
      copyright: setup.copyright,
      logoUrl: setup.logoUrl,
    });
    const detach = attachReaderReveal(host, handle.frame, fromHome);
    return () => {
      detach();
      handle.destroy();
    };
  }, [book, bundledSrc, setup.credits, setup.copyright, setup.logoUrl]);

  useEffect(() => {
    const host = bundledHostRef.current;
    if (!host || !book || !bundledSrc) return;
    const fromHome = Boolean(document.documentElement.classList.contains("book-opening"));
    const frame = host.querySelector("iframe");
    if (!frame || !(frame instanceof HTMLIFrameElement)) return;
    return attachReaderReveal(host, frame, fromHome);
  }, [book, bundledSrc]);

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

  if (book && bundledSrc) {
    return (
      <div ref={bundledHostRef} className="reader-host bundled-flipbook-host" style={{ opacity: 0 }}>
        <iframe className="bundled-flipbook-frame" title={book.title.replace(/\n/g, " ")} src={bundledSrc} />
      </div>
    );
  }

  return <div id="reader" ref={hostRef} className="reader-host" style={{ opacity: 0 }} />;
}
