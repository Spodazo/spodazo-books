/**
 * On every page and flipbook: if the library or the deploy changed, reload
 * the whole app onto a URL the browser has not cached.
 */
(function () {
  var KEY = "spodazo-app-rev";
  var PARAM = "_spodazo";
  var v = new URLSearchParams(location.search).get("v");

  function bust(value) {
    if (!v || typeof value !== "string" || !value) return value;
    if (/^(https?:|data:|blob:|#)/i.test(value)) return value;
    if (/[?&]v=/.test(value)) return value;
    return value + (value.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(v);
  }

  if (v) {
    var setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (name === "src" || name === "href") value = bust(value);
      return setAttribute.call(this, name, value);
    };
    [HTMLImageElement, HTMLScriptElement, HTMLLinkElement].forEach(function (Ctor) {
      ["src", "href"].forEach(function (prop) {
        var desc = Object.getOwnPropertyDescriptor(Ctor.prototype, prop);
        if (!desc || !desc.set || !desc.get) return;
        Object.defineProperty(Ctor.prototype, prop, {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: function (value) {
            desc.set.call(this, bust(value));
          },
        });
      });
    });
  }

  function check() {
    fetch("/api/version", { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        if (!body || !body.build) return;
        var next = String(body.build) + "|" + String(body.libraryAt || "");
        var topWin = window.top || window;
        var stored = "";
        try { stored = topWin.sessionStorage.getItem(KEY) || ""; } catch (err) {}
        if (!stored) {
          try { topWin.sessionStorage.setItem(KEY, next); } catch (err) {}
          return;
        }
        if (stored === next) return;
        try { topWin.sessionStorage.setItem(KEY, next); } catch (err) {}
        var url = new URL(topWin.location.href);
        url.searchParams.set(PARAM, next);
        topWin.location.replace(url.toString());
      })
      .catch(function () {});
  }

  check();
  setInterval(check, 5000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) check();
  });
})();
