(function () {
  if (window.spodazoFullscreen) return;
  var key = "spodazo-fullscreen";
  var saw = false;
  var api = {
    held: false,
    active: function () {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    wanted: function () {
      if (api.held || api.active()) return false;
      if ((location.pathname || "").indexOf("/admin") === 0) return false;
      try {
        return localStorage.getItem(key) !== "0";
      } catch (err) {
        return true;
      }
    },
    enter: function () {
      if (!api.wanted()) return;
      var el = document.documentElement;
      var request = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!request) return;
      try {
        var pending = request.call(el, { navigationUI: "hide" });
        if (pending && pending.catch) pending.catch(function () {});
      } catch (err) {
        try {
          var again = request.call(el);
          if (again && again.catch) again.catch(function () {});
        } catch (ignored) {
          /* browsers refuse this until the reader clicks or taps */
        }
      }
    },
    exit: function () {
      api.held = true;
      var leave = document.exitFullscreen || document.webkitExitFullscreen;
      if (!leave) return;
      try {
        var pending = leave.call(document);
        if (pending && pending.catch) pending.catch(function () {});
      } catch (err) {
        /* already in the window */
      }
    },
  };
  window.spodazoFullscreen = api;

  document.addEventListener("pointerdown", function (event) {
    var target = event.target;
    if (target && target.closest && target.closest(".fullscreen-toggle")) return;
    api.enter();
  }, true);

  function onChange() {
    if (api.active()) saw = true;
    else if (saw) api.held = true;
  }
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  api.enter();
})();
