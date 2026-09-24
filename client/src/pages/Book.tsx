import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ensureBookLayouts } from "@shared/page-layout";
import { characterUrlFor } from "@shared/reader-pages";
import { DEFAULT_PLAYER_SETUP } from "@shared/seed-data";
import { fetchBook } from "../lib/api";
import { clearBookOpen, openingSince } from "../lib/bookOpen";
import { loadHomeSetup, readCachedSetup } from "../lib/homeCache";
import { isUprightPhone, PHONE_QUERY, PORTRAIT_QUERY } from "../lib/phoneViewport";
import type { PlayerSetup, PublicBook } from "@shared/types";
import { mountReader } from "../flipbook/reader.js";

const UprightPdfReader = lazy(() => import("../components/UprightPdfReader"));

export default function BookPage() {
  const [, params] = useRoute("/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const hostRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<{ frame: HTMLIFrameElement; destroy: () => void } | null>(null);
  const sawPdfRef = useRef(false);
  const [error, setError] = useState("");
  const [book, setBook] = useState<PublicBook | null>(null);
  const [setup, setSetup] = useState<PlayerSetup>(readCachedSetup() || DEFAULT_PLAYER_SETUP);
  const [upright, setUpright] = useState(() => isUprightPhone());
  const [pdfWanted, setPdfWanted] = useState(() => isUprightPhone());
  const [pdfFailed, setPdfFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setBook(null);
    setPdfFailed(false);
    setPdfWanted(isUprightPhone());
    sawPdfRef.current = false;
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
    const sync = () => setUpright(isUprightPhone());
    const phone = window.matchMedia(PHONE_QUERY);
    const portrait = window.matchMedia(PORTRAIT_QUERY);
    phone.addEventListener("change", sync);
    portrait.addEventListener("change", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      phone.removeEventListener("change", sync);
      portrait.removeEventListener("change", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

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
    if (upright) setPdfWanted(true);
  }, [upright]);

  const showPdf = Boolean(book?.pdfUrl) && upright && pdfWanted && !pdfFailed;

  useEffect(() => {
    if (showPdf) {
      sawPdfRef.current = true;
      clearBookOpen();
    }
  }, [showPdf]);

  useEffect(() => {
    return () => {
      readerRef.current?.destroy();
      readerRef.current = null;
    };
  }, [book]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !book || showPdf) return;
    if (readerRef.current) {
      host.style.opacity = "1";
      return;
    }
    const fromHome = openingSince() > 0;
    const fromPdf = sawPdfRef.current;
    host.style.opacity = fromHome && !fromPdf ? "0" : fromPdf ? "0" : "1";
    const handle = mountReader(host, ensureBookLayouts(book, { coverUrl: book.coverUrl, characterUrl: characterUrlFor(book) }), {
      libraryUrl: "/",
      fadeOpen: !fromHome || fromPdf,
      baseUrl: location.href,
      credits: setup.credits,
      copyright: setup.copyright,
      logoUrl: setup.logoUrl,
    });
    readerRef.current = handle;
    const reveal = () => {
      const started = openingSince();
      const left = started ? Math.max(700, 1800 - (performance.now() - started)) : 1800;
      host.style.transition = `opacity ${fromHome && !fromPdf ? left : 750}ms ease`;
      host.style.opacity = "1";
      window.setTimeout(clearBookOpen, fromHome && !fromPdf ? left : 0);
    };
    if (fromPdf) {
      requestAnimationFrame(() => {
        host.style.transition = "opacity .75s ease";
        host.style.opacity = "1";
      });
      clearBookOpen();
    } else if (fromHome) {
      if (handle.frame.contentDocument?.readyState === "complete") reveal();
      else handle.frame.addEventListener("load", reveal, { once: true });
    } else {
      clearBookOpen();
    }
    return () => {
      handle.frame.removeEventListener("load", reveal);
    };
  }, [book, showPdf, setup.credits, setup.copyright, setup.logoUrl]);

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

  return (
    <>
      <div id="reader" ref={hostRef} className="reader-host" hidden={showPdf} />
      {book?.pdfUrl && pdfWanted && !pdfFailed ? (
        <div hidden={!showPdf}>
          <Suspense fallback={showPdf ? <div className="upright-pdf" aria-busy="true" /> : null}>
            <UprightPdfReader url={book.pdfUrl} title={book.title} onFail={() => setPdfFailed(true)} />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
