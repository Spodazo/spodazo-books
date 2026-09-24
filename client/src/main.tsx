import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { watchAppUpdates } from "./lib/appUpdate";
import { prefetchHome, readCachedSetup } from "./lib/homeCache";
import { restorePalette } from "./lib/palette";
import { applySiteIcons } from "./lib/siteIcons";
import "./index.css";

restorePalette();
const cachedSetup = readCachedSetup();
if (cachedSetup) applySiteIcons(cachedSetup);
prefetchHome();
watchAppUpdates();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
