/**
 * Portrait phone and tablet hint for every flip book.
 * Fades in once the book is open, stays about 5 seconds,
 * and leaves as soon as the cover is tapped to turn a page.
 */
(function () {
  var HOLD_MS = 5000;
  var FADE_OUT_MS = 520;
  var OPEN_DELAY_MS = 320;

  var CSS = [
    ".landscape-hint{position:fixed;z-index:40;left:50%;top:46%;width:min(292px,calc(100vw - 56px));",
    "margin:0;padding:22px 22px 20px;border-radius:26px;box-sizing:border-box;",
    "background:rgba(22,28,26,.82);color:#f6f1e6;border:1px solid rgba(255,244,220,.22);",
    "box-shadow:0 20px 48px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.16);",
    "backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15);",
    "text-align:center;pointer-events:none;",
    "opacity:0;transform:translate(-50%,calc(-50% + 12px));",
    "font:500 16.5px/1.4 Lexend,'Avenir Next','Segoe UI',system-ui,sans-serif;letter-spacing:-.015em}",
    ".landscape-hint p{margin:0}",
    ".landscape-hint svg{display:block;margin:0 auto 12px}",
    ".landscape-hint.is-in{opacity:1;transform:translate(-50%,-50%);",
    "transition:opacity 1.2s cubic-bezier(.22,.7,.3,1),transform 1.2s cubic-bezier(.22,.7,.3,1)}",
    ".landscape-hint.is-out{opacity:0;transform:translate(-50%,calc(-50% + 8px));",
    "transition:opacity .52s ease,transform .52s ease}",
    "@media (prefers-reduced-motion:no-preference){.landscape-hint.is-in svg{animation:landscape-hint-tilt 1.5s cubic-bezier(.22,.7,.3,1) .4s both}}",
    "@keyframes landscape-hint-tilt{0%{transform:rotate(0deg)}100%{transform:rotate(-90deg)}}",
    "@media (prefers-reduced-motion:reduce){.landscape-hint.is-in{transition:none}}"
  ].join("");

  var ICON = '<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">' +
    '<circle cx="23" cy="23" r="21.5" fill="none" stroke="rgba(231,197,106,.4)" stroke-width="1"/>' +
    '<rect x="17" y="12" width="12" height="21" rx="2.4" fill="none" stroke="#f4ead4" stroke-width="1.6"/>' +
    '<path d="M20.2 28.2h5.6" fill="none" stroke="#f4ead4" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M31.2 16.2a9 9 0 0 1 1.4 7.4" fill="none" stroke="#e7c56a" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M32.4 13.6l.4 3.4-3.2.6" fill="none" stroke="#e7c56a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  var root = null;
  var timer = 0;
  var leaving = false;
  var orient = null;

  function portraitTouch() {
    try {
      if (!window.matchMedia("(orientation:portrait)").matches) return false;
      // iPad reports a fine pointer. any-pointer still sees the touch screen.
      return window.matchMedia("(any-pointer:coarse), (pointer:coarse)").matches;
    } catch (e) {
      return false;
    }
  }

  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function remove() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    if (orient) {
      orient.removeEventListener("change", onOrient);
      orient = null;
    }
    document.removeEventListener("pointerdown", onCover, true);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  function dismiss() {
    if (!root || leaving) return;
    leaving = true;
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    root.classList.add("is-out");
    setTimeout(remove, (reducedMotion() ? 0 : FADE_OUT_MS) + 40);
  }

  function onOrient() {
    if (!portraitTouch()) dismiss();
  }

  function onCover(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("a, button, .flipbook-close, .reader-close, .viewport-close, .arrow, .rudolph-sound, .willow-sound, .admin-login, .sing-along, .read-again, .library-back")) return;
    var book = document.getElementById("book") || document.querySelector("main");
    if (!book || !book.contains(t)) return;
    dismiss();
  }

  function show() {
    if (root || !portraitTouch() || !document.body) return;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement("div");
    root.className = "landscape-hint";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.innerHTML = ICON + "<p>For the best experience, turn your phone to landscape mode, or tap to start</p>";
    document.body.appendChild(root);
    if (reducedMotion()) root.classList.add("is-in");
    else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (root) root.classList.add("is-in");
        });
      });
    }
    timer = setTimeout(dismiss, HOLD_MS);
    document.addEventListener("pointerdown", onCover, true);
    try {
      orient = window.matchMedia("(orientation:portrait)");
      if (orient.addEventListener) orient.addEventListener("change", onOrient);
    } catch (e) {}
  }

  setTimeout(show, OPEN_DELAY_MS);
})();
