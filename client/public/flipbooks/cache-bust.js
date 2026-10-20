/**
 * Runs inside every bundled flipbook. The shell passes ?v=<deploy> on the
 * iframe URL; this stamps that token onto later asset loads so a new deploy
 * cannot reuse a cached page, script, or picture.
 */
(function () {
  var v = new URLSearchParams(location.search).get("v");
  if (!v) return;

  function bust(value) {
    if (typeof value !== "string" || !value) return value;
    if (/^(https?:|data:|blob:|#)/i.test(value)) return value;
    if (/[?&]v=/.test(value)) return value;
    return value + (value.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(v);
  }

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
})();
