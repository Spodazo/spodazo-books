import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { watchAppUpdates } from "./lib/appUpdate";
import { absorbHomeBootstrap, prefetchHome, readCachedSetup } from "./lib/homeCache";
import { applyPalette, restorePalette } from "./lib/palette";
import { applySiteIcons } from "./lib/siteIcons";
import "./index.css";

absorbHomeBootstrap();
const cachedSetup = readCachedSetup();
if (cachedSetup?.collectionColor) applyPalette(cachedSetup.collectionColor);
else restorePalette();
if (cachedSetup) applySiteIcons(cachedSetup);
prefetchHome();
watchAppUpdates();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
