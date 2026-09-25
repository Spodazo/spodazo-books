import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";

function useFitText(text: string, fontSize?: CSSProperties["fontSize"]) {
  const ref = useRef<HTMLElement>(null);
  const fitRef = useRef<() => void>(() => {});
  fitRef.current = () => {
    const el = ref.current;
    if (!el) return;
    const base = fontSize ? String(fontSize) : "";
    if (base) el.style.fontSize = base;
    const start = parseFloat(getComputedStyle(el).fontSize);
    if (!start || el.clientHeight < 8) return;
    let size = start;
    const min = Math.max(8, start * 0.45);
    let n = 0;
    while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > min && n < 30) {
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
  return ref;
}

export default function EditorText({
  text,
  placeholder,
  style,
}: {
  text: string;
  placeholder: string;
  style: CSSProperties;
}) {
  const raw = text || "";
  const ref = useFitText(raw || placeholder, style.fontSize);
  if (!raw) return <p ref={ref} style={style}>{placeholder}</p>;
  return (
    <div ref={ref} className="page-editor-text" style={style}>
      {raw.split(/\n{2,}/).map((para, index) => (
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
