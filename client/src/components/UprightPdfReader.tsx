import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as pdfjs from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerURL;

export default function UprightPdfReader({
  url,
  title,
  onFail,
}: {
  url: string;
  title: string;
  onFail?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const [status, setStatus] = useState("Opening the book…");

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !url) return;
    const box: HTMLDivElement = el;
    let cancelled = false;
    const resourceBase = `${location.origin}/pdfjs/`;

    async function draw() {
      setStatus("Opening the book…");
      box.replaceChildren();
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not open the PDF");
      const data = new Uint8Array(await res.arrayBuffer());
      if (cancelled) return;
      const task = pdfjs.getDocument({
        data,
        useSystemFonts: false,
        cMapUrl: new URL("cmaps/", resourceBase).href,
        cMapPacked: true,
        standardFontDataUrl: new URL("standard_fonts/", resourceBase).href,
        wasmUrl: new URL("wasm/", resourceBase).href,
      });
      const doc = await task.promise;
      try {
        const width = box.clientWidth || window.innerWidth;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "upright-pdf-page";
          canvas.setAttribute("aria-label", `${title} page ${i}`);
          await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
          page.cleanup();
          if (cancelled) return;
          box.appendChild(canvas);
          if (i === 1) setStatus("");
        }
      } finally {
        await doc.cleanup();
        await task.destroy();
      }
    }

    draw().catch((err: Error) => {
      if (cancelled) return;
      setStatus(err.message || "Could not open the PDF");
      onFailRef.current?.();
    });

    return () => {
      cancelled = true;
      box.replaceChildren();
    };
  }, [title, url]);

  return (
    <div className="upright-pdf">
      <Link href="/" className="reader-close upright-pdf-close" aria-label="Close">
        ×
      </Link>
      <div ref={scrollerRef} className="upright-pdf-pages" />
      {status ? <p className="upright-pdf-status">{status}</p> : null}
      <p className="upright-pdf-bar">Turn your phone for our flipbook version.</p>
    </div>
  );
}
