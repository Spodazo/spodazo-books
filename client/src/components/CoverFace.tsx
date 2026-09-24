import { useEffect, useLayoutEffect, useRef } from "react";
import { fontStack } from "@shared/book-fonts";
import { alignJustify, normalizeColor, pageFill } from "@shared/page-layout";
import { paperSurfaceStyle } from "@shared/paper";
import { frameClass, frameMarkup } from "@shared/text-frames";
import type { PageLayout } from "@shared/types";

function CoverText({
  text,
  style,
}: {
  text: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fitRef = useRef<() => void>(() => {});
  fitRef.current = () => {
    const el = ref.current;
    if (!el) return;
    const base = String(style.fontSize || "");
    if (base) el.style.fontSize = base;
    const start = parseFloat(getComputedStyle(el).fontSize);
    if (!start || el.clientHeight < 8) return;
    let size = start;
    const min = Math.max(8, start * 0.45);
    let n = 0;
    while (el.scrollHeight > el.clientHeight + 1 && size > min && n < 30) {
      size = Math.round(size * 0.94 * 10) / 10;
      el.style.fontSize = `${size}px`;
      n += 1;
    }
  };
  useLayoutEffect(() => {
    fitRef.current();
  });
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => fitRef.current());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div ref={ref} className="cover-text" style={style}>
      {text.split(/\n{2,}/).map((para, index) => (
        <p key={index}>
          {para.split("\n").map((line, lineIndex) => (
            <span key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function CoverFace({
  layout,
  background,
  texture,
  font,
  ink,
}: {
  layout: PageLayout;
  background: string;
  texture?: string;
  font: string;
  ink: string;
}) {
  const fill = pageFill(layout.background, background);
  return (
    <div className="cover-face" style={paperSurfaceStyle(fill, texture)}>
      {layout.elements.slice().sort((a, b) => a.z - b.z).map((element) => (
        <div
          key={element.id}
          className={`cover-el${element.type === "text" ? ` ${frameClass(element.frame)}` : ""}`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.w}%`,
            height: `${element.h}%`,
            zIndex: element.z,
            ["--frame" as string]: element.type === "text"
              ? (normalizeColor(element.frameColor, "") || ink)
              : undefined,
          }}
        >
          {element.type === "shape" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: normalizeColor(element.color, "") || ink,
                opacity: (element.opacity ?? 100) / 100,
                borderRadius: element.shape === "circle" ? "50%" : "2%",
              }}
            />
          ) : null}
          {element.type === "text" && frameMarkup(element.frame, element.w / element.h) ? (
            <span className="cover-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
          ) : null}
          {element.type === "shape" ? null : element.type === "image" ? (
            element.imageUrl ? (
              <img src={element.imageUrl} alt="" style={{ objectFit: element.fit === "contain" || element.id === "cover-art" ? "contain" : "cover", opacity: (element.opacity ?? 100) / 100, background: "transparent" }} />
            ) : null
          ) : (
            <CoverText
              text={element.text || ""}
              style={{
                fontFamily: fontStack(element.fontFamily || font),
                fontSize: `${element.fontSize || 4}cqh`,
                color: normalizeColor(element.color, "") || ink,
                textAlign: element.align || "left",
                alignItems: alignJustify(element.align),
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
