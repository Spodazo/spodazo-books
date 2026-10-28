import { useEffect, useRef, useState } from "react";
import {
  canFullscreen,
  enterFullscreen,
  exitFullscreen,
  fullscreenElement,
  readFullscreenPreference,
  wantsFullscreen,
  writeFullscreenPreference,
} from "../lib/fullscreen";

export default function FullScreenButton() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    setSupported(canFullscreen());
    const sync = () => {
      const next = Boolean(fullscreenElement());
      if (activeRef.current && !next) writeFullscreenPreference(false);
      activeRef.current = next;
      setActive(next);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wantsFullscreen(readFullscreenPreference() ? "1" : null, Boolean(fullscreenElement()))) return;
      const target = event.target;
      if (target instanceof Element && target.closest(".fullscreen-toggle")) return;
      enterFullscreen();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [supported]);

  if (!supported) return null;

  return (
    <button
      type="button"
      className="fullscreen-toggle"
      aria-pressed={active}
      aria-label={active ? "Exit full screen" : "Full screen"}
      title={active ? "Exit full screen" : "Full screen. This hides the tabs and bookmarks."}
      onClick={() => {
        if (fullscreenElement()) {
          writeFullscreenPreference(false);
          exitFullscreen();
        } else {
          writeFullscreenPreference(true);
          enterFullscreen();
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {active ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}
