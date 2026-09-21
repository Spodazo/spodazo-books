export type TextFrameKind = "none" | "straight" | "decorative";

export type TextFrame = {
  id: string;
  label: string;
  kind: TextFrameKind;
};

export const DEFAULT_FRAME_COLOR = "#203b2a";

export const TEXT_FRAMES: TextFrame[] = [
  { id: "", label: "None", kind: "none" },
  { id: "thin", label: "Thin", kind: "straight" },
  { id: "double", label: "Double", kind: "straight" },
  { id: "dashed", label: "Dashed", kind: "straight" },
  { id: "wave", label: "Wave", kind: "decorative" },
  { id: "beads", label: "Beads", kind: "decorative" },
  { id: "ribbon", label: "Ribbon", kind: "decorative" },
];

const FRAME_IDS = new Set(TEXT_FRAMES.map((frame) => frame.id));

export function normalizeFrame(raw?: string | null): string {
  const value = String(raw || "");
  return FRAME_IDS.has(value) ? value : "";
}

export function frameClass(id?: string | null): string {
  const frame = normalizeFrame(id);
  return frame ? `framed framed-${frame}` : "";
}

function waveBoxPath(width = 100, height = 100): string {
  const inset = Math.min(width, height) * 0.08;
  const amp = Math.min(width, height) * 0.07;
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;

  function side(x1: number, y1: number, x2: number, y2: number): string {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cycles = Math.max(4, Math.round(len / 16));
    const count = cycles * 4;
    let d = "";
    for (let i = 1; i <= count; i += 1) {
      const t = i / count;
      const wave = Math.sin(t * cycles * Math.PI) * amp;
      d += ` L ${(x1 + dx * t + nx * wave).toFixed(2)} ${(y1 + dy * t + ny * wave).toFixed(2)}`;
    }
    return d;
  }

  return `M ${left} ${top}${side(left, top, right, top)}${side(right, top, right, bottom)}${side(right, bottom, left, bottom)}${side(left, bottom, left, top)} Z`;
}

export function frameMarkup(id?: string | null, ratio = 1.6): string {
  const frame = normalizeFrame(id);
  if (frame === "wave") {
    const width = Math.round(100 * Math.max(0.6, Math.min(3.2, ratio)));
    const height = 100;
    const stroke = Math.max(2.4, Math.min(width, height) * 0.035);
    return `<svg class="text-frame text-frame-wave" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${waveBoxPath(width, height)}" fill="none" stroke="currentColor" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  if (frame === "ribbon") {
    return `<svg class="text-frame text-frame-ribbon" viewBox="0 0 84 72" aria-hidden="true"><path d="M28 16c-14-12-24 2-8 10M32 16c14-12 24 2 8 10M30 20c-8 16-16 34-20 46M30 22c16 4 34-2 46-8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="20" r="2.6" fill="currentColor"/></svg>`;
  }
  return "";
}
