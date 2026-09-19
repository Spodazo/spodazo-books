import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import AdminLoginLink from "../components/AdminLoginLink";
import { fetchBook } from "../lib/api";
import type { PublicBook } from "@shared/types";
import { mountReader } from "../flipbook/reader.js";

export default function BookPage() {
  const [, params] = useRoute("/:slug");
  const slug = params?.slug || "";
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [book, setBook] = useState<PublicBook | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !book) return;
    const handle = mountReader(host, book, {
      libraryUrl: "/",
      baseUrl: location.href,
    });
    return () => handle.destroy();
  }, [book]);

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

  return (
    <>
      <AdminLoginLink />
      <div id="reader" ref={hostRef} className="reader-host" />
    </>
  );
}
