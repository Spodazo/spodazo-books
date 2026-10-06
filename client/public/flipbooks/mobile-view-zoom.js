/**
 * Pinch/pan for bundled flipbooks (single-page / mobile mode).
 * - Double-tap resets zoom
 * - Pinch back to 1× clears pan
 * - While zoomed: one-finger drag pans (all directions); double-tap or pinch to 1× resets
 * - Page turns via swipe only at 1× zoom
 * - Pan is clamped to the scaled page bounds
 * - Double-tap a left/right edge (not zoomed) jumps to start/end
 */
(function (global) {
  var EDGE_FRAC = 0.18;
  var EDGE_MIN = 56;
  var DOUBLE_MS = 350;
  var ARROW_MS = 400;

  function edgeJumpSide(x, width) {
    var band = Math.max(EDGE_MIN, width * EDGE_FRAC);
    if (x <= band) return -1;
    if (x >= width - band) return 1;
    return 0;
  }

  function wireFlipArrows(arrL, arrR, handlers) {
    var timer = 0;
    function bind(el, dir) {
      if (!el) return;
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (el.classList.contains("off")) return;
        if (e.detail >= 2) {
          clearTimeout(timer);
          timer = 0;
          if (dir < 0) handlers.start();
          else handlers.end();
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(function () {
          timer = 0;
          if (el.classList.contains("off")) return;
          handlers.turn(dir);
        }, ARROW_MS);
      });
    }
    bind(arrL, -1);
    bind(arrR, 1);
  }

  function attachFlipbookMobileZoom(opts) {
    var stage = opts.stage;
    var book = opts.book;
    var isSingle = opts.isSingle;
    var layoutSize = opts.layoutSize;
    var onTurn = opts.onTurn;
    var ignoreTarget = opts.ignoreTarget || function () { return false; };

    var viewScale = 1;
    var viewPanX = 0;
    var viewPanY = 0;
    var touchPts = new Map();
    var pinchRefDist = 0;
    var pinchRefScale = 1;
    var gesturePinch = false;
    var gesturePan = false;
    var panPending = false;
    var panStartX = 0;
    var panStartY = 0;
    var panRefX = 0;
    var panRefY = 0;
    var lastZoomTap = 0;
    var lastZoomTapX = 0;
    var lastZoomTapY = 0;
    var lastEdgeTap = 0;
    var lastEdgeSide = 0;
    var edgeTimer = 0;
    var sx = 0;
    var sy = 0;
    var sp = null;
    var PAN_SLOP = 12;

    function clampZoom(n) {
      return Math.max(1, Math.min(4, n));
    }

    function bookFootprint() {
      var size = layoutSize();
      var bw = size.spread ? size.pw * 2 : size.pw;
      return { bw: bw, ph: size.ph };
    }

    function clampViewPan() {
      var dim = bookFootprint();
      var extra = Math.max(0, viewScale - 1);
      var maxX = dim.bw * extra * 0.52;
      var maxY = dim.ph * extra * 0.52;
      viewPanX = Math.max(-maxX, Math.min(maxX, viewPanX));
      viewPanY = Math.max(-maxY, Math.min(maxY, viewPanY));
    }

    function applyViewZoom() {
      if (viewScale <= 1.001) {
        viewScale = 1;
        viewPanX = 0;
        viewPanY = 0;
        gesturePan = false;
        panPending = false;
        book.style.transform = "";
        return;
      }
      clampViewPan();
      book.style.transform = "translate(" + viewPanX + "px," + viewPanY + "px) scale(" + viewScale + ")";
    }

    function reset() {
      viewScale = 1;
      viewPanX = 0;
      viewPanY = 0;
      gesturePinch = false;
      gesturePan = false;
      panPending = false;
      lastZoomTap = 0;
      applyViewZoom();
    }

    function finishViewGesture() {
      if (viewScale <= 1.05) reset();
      else applyViewZoom();
    }

    function tryDoubleTapReset(x, y) {
      if (!isSingle() || viewScale <= 1) return false;
      var now = Date.now();
      if (now - lastZoomTap < 350 && Math.hypot(x - lastZoomTapX, y - lastZoomTapY) < 32) {
        reset();
        return true;
      }
      lastZoomTap = now;
      lastZoomTapX = x;
      lastZoomTapY = y;
      return false;
    }

    function touchPointList() {
      var out = [];
      touchPts.forEach(function (p) {
        out.push(p);
      });
      return out;
    }

    function touchDist(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function releaseTouchPointer(e) {
      touchPts.delete(e.pointerId);
      if (touchPts.size < 2) gesturePinch = false;
      if (!touchPts.size && !panPending) gesturePan = false;
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    stage.addEventListener("pointerdown", function (e) {
      if (ignoreTarget(e.target)) return;
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (err) {}
      if (isSingle() && touchPts.size === 2) {
        gesturePinch = true;
        panPending = false;
        sp = null;
        var pair = touchPointList();
        pinchRefDist = touchDist(pair[0], pair[1]);
        pinchRefScale = viewScale;
        return;
      }
      if (isSingle() && viewScale > 1 && touchPts.size === 1) {
        panPending = true;
        gesturePan = false;
        sp = null;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panRefX = viewPanX;
        panRefY = viewPanY;
        return;
      }
      sx = e.clientX;
      sy = e.clientY;
      sp = e.pointerType;
    });

    stage.addEventListener("pointermove", function (e) {
      if (!touchPts.has(e.pointerId)) return;
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (isSingle() && gesturePinch && touchPts.size >= 2) {
        var pts = touchPointList();
        if (pts.length >= 2 && pinchRefDist > 0) {
          viewScale = clampZoom(pinchRefScale * (touchDist(pts[0], pts[1]) / pinchRefDist));
          applyViewZoom();
        }
        return;
      }
      if (isSingle() && panPending && touchPts.size === 1 && viewScale > 1) {
        var dx = e.clientX - panStartX;
        var dy = e.clientY - panStartY;
        if (!gesturePan) {
          if (Math.hypot(dx, dy) < PAN_SLOP) return;
          gesturePan = true;
        }
        viewPanX = panRefX + dx;
        viewPanY = panRefY + dy;
        applyViewZoom();
      }
    });

    stage.addEventListener("pointerup", function (e) {
      if (ignoreTarget(e.target)) {
        sp = null;
        releaseTouchPointer(e);
        return;
      }
      var dxEnd = e.clientX - panStartX;
      var dyEnd = e.clientY - panStartY;
      var wasPinch = gesturePinch;
      var wasPan = gesturePan;
      var hadPanPending = panPending;

      if (gesturePinch || gesturePan || panPending) {
        if (
          isSingle() &&
          viewScale > 1 &&
          !wasPan &&
          !wasPinch &&
          hadPanPending &&
          Math.hypot(dxEnd, dyEnd) < 12
        ) {
          if (tryDoubleTapReset(e.clientX, e.clientY)) {
            releaseTouchPointer(e);
            sp = null;
            panPending = false;
            return;
          }
        }
        releaseTouchPointer(e);
        sp = null;
        panPending = false;
        gesturePan = false;
        finishViewGesture();
        return;
      }

      releaseTouchPointer(e);
      if (sp === null) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      var type = sp;
      sp = null;
      var ax = Math.abs(dx);
      var ay = Math.abs(dy);
      if (ax > 40 && ax > ay * 1.2 && (!isSingle() || viewScale <= 1)) {
        onTurn(dx < 0 ? 1 : -1);
        return;
      }
      if (ax < 10 && ay < 10) {
        var stageBox = stage.getBoundingClientRect();
        var side = edgeJumpSide(e.clientX - stageBox.left, stageBox.width);
        var now = Date.now();
        if (isSingle() && viewScale <= 1 && side && opts.onJump) {
          if (side === lastEdgeSide && now - lastEdgeTap > 0 && now - lastEdgeTap <= DOUBLE_MS) {
            clearTimeout(edgeTimer);
            edgeTimer = 0;
            lastEdgeTap = 0;
            lastEdgeSide = 0;
            opts.onJump(side);
            return;
          }
          lastEdgeTap = now;
          lastEdgeSide = side;
          clearTimeout(edgeTimer);
          var tap = { clientX: e.clientX, clientY: e.clientY, pointerType: type };
          edgeTimer = setTimeout(function () {
            edgeTimer = 0;
            if (opts.onTap) opts.onTap(tap, type);
          }, DOUBLE_MS);
          return;
        }
        if (opts.onTap) opts.onTap(e, type);
      }
    });

    stage.addEventListener("pointercancel", function (e) {
      releaseTouchPointer(e);
      sp = null;
      panPending = false;
      finishViewGesture();
    });

    return { reset: reset };
  }

  global.attachFlipbookMobileZoom = attachFlipbookMobileZoom;
  global.wireFlipArrows = wireFlipArrows;
})(typeof window !== "undefined" ? window : this);
