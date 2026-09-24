import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as pdfjs from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerURL;

export default function UprightPdfReader({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Opening the book…");

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !url) return;
    const box: HTMLDivElement = el;
    let cancelled = false;
    const resourceBase = `${location.origin}/pdfjs/`;

    async function draw() {
      setStatus("Opening the book…");
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
      let drawn = 0;
      try {
        const width = box.clientWidth || window.innerWidth;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!cancelled) box.replaceChildren();
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          try {
            const page = await doc.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: (width / Math.max(base.width, 1)) * dpr });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            canvas.className = "upright-pdf-page";
            canvas.setAttribute("aria-label", `${title} page ${i}`);
            await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
            page.cleanup();
            if (cancelled) return;
            box.appendChild(canvas);
            drawn += 1;
            if (drawn === 1) setStatus("");
          } catch {
            if (drawn === 0) throw new Error("Could not draw the PDF");
          }
        }
      } finally {
        await doc.cleanup();
        await task.destroy();
      }
      if (!cancelled && drawn === 0) throw new Error("Could not open the PDF");
    }

    draw().catch((err: Error) => {
      if (cancelled) return;
      if (box.childElementCount) {
        setStatus("");
        return;
      }
      setStatus(err.message || "Could not open the PDF");
    });

    return () => {
      cancelled = true;
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
