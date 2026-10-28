import { useEffect, useState } from "react";
import {
  canFullscreen,
  enterFullscreen,
  exitFullscreen,
  fullscreenElement,
} from "../lib/fullscreen";

export default function FullScreenButton() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(canFullscreen());
    const sync = () => setActive(Boolean(fullscreenElement()));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      className="fullscreen-toggle"
      aria-pressed={active}
      aria-label={active ? "Exit full screen" : "Full screen"}
      title={active ? "Exit full screen" : "Full screen. The first tap also does this."}
      onClick={() => {
        const api = window.spodazoFullscreen;
        if (fullscreenElement()) {
          if (api) api.exit();
          else exitFullscreen();
          return;
        }
        if (api) api.held = false;
        if (api) api.enter();
        else enterFullscreen();
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
