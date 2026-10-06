/**
 * Be Thou My Vision flipbook engine, parameterized for any uploaded PDF.
 * Reads window.FACSIMILE_FLIPBOOK = { title, pages, spreads, ratio, libraryUrl }.
 */
(function () {
  var cfg = window.FACSIMILE_FLIPBOOK || {};
  var PAGES = Array.isArray(cfg.pages) ? cfg.pages : [];
  var IMAGES = PAGES.length;
  var TOTAL = IMAGES;
  var RATIO = Number(cfg.ratio) > 0 ? Number(cfg.ratio) : 842.16 / 595.44;
  var SP = Array.isArray(cfg.spreads) && cfg.spreads.length ? cfg.spreads : [[0, 1]];
  var LAST = SP.length - 1;
  var LIBRARY = cfg.libraryUrl || "/";

  var stage = document.getElementById("stage");
  var book = document.getElementById("book");
  var slotL = document.getElementById("slotL");
  var slotR = document.getElementById("slotR");
  var leaf = document.getElementById("leaf");
  var front = leaf.querySelector(".face.front");
  var back = leaf.querySelector(".face.back");
  var stackL = document.getElementById("stackL");
  var stackR = document.getElementById("stackR");
  var arrL = document.getElementById("arrL");
  var arrR = document.getElementById("arrR");
  var closeBtn = document.getElementById("closeBtn");

  Array.prototype.forEach.call(document.querySelectorAll(".page"), function (p) {
    var s = document.createElement("span");
    s.className = "again-label";
    s.textContent = "Read again";
    p.appendChild(s);
  });

  var single = false;
  var idx = 0;
  var pg = 0;
  var busy = false;
  var pw = 0;
  var ph = 0;
  var jumpPage = 0;
  var turnGen = 0;
  var turnAnims = [];

  function exitToLibrary() {
    try {
      if (window.top && window.top !== window) {
        window.top.postMessage({ type: "spodazo-book-close", href: LIBRARY }, window.top.location.origin);
        return;
      }
    } catch (e) {}
    window.top.location.href = LIBRARY;
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      exitToLibrary();
    });
  }

  function abortTurn() {
    turnGen++;
    turnAnims.forEach(function (x) { try { x.cancel(); } catch (e) {} });
    turnAnims = [];
    hideLeaf();
    stackL.style.transition = stackR.style.transition = "";
    busy = false;
  }

  function src(n) {
    if (!n || n > IMAGES) return "";
    return PAGES[n - 1] || "";
  }

  function pageEl(host) { return host.querySelector(".page"); }

  function setPage(host, n, blankPaper) {
    var p = pageEl(host);
    var img = p.querySelector("img");
    p.classList.remove("empty", "blank", "again", "link");
    if (n === TOTAL) p.classList.add("link");
    if (!n) {
      img.removeAttribute("src");
      p.classList.add(blankPaper ? "blank" : "empty");
      return Promise.resolve();
    }
    var s = src(n);
    if (img.getAttribute("src") !== s) img.setAttribute("src", s);
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  }

  function warm(n) {
    var s = src(n);
    if (!s) return Promise.resolve();
    var im = new Image();
    im.src = s;
    return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
  }

  function decideMode(W, H) {
    var touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    return W < 700 || W / H < 1.1 || (touch && H < 520);
  }

  function spreadIndexForPage(n) {
    for (var i = 0; i <= LAST; i++) {
      if (SP[i][0] === n || SP[i][1] === n) return i;
    }
    return 0;
  }

  function layout() {
    var r = stage.getBoundingClientRect();
    var W = r.width;
    var H = r.height;
    var wasSingle = single;
    single = decideMode(W, H);
    if (single !== wasSingle) {
      resetViewZoom();
      if (single) { pg = Math.max(0, (SP[idx][1] || SP[idx][0]) - 1); }
      else { idx = pg === 0 ? 0 : Math.min(LAST, Math.ceil(pg / 2)); }
    }
    var m = Math.max(12, Math.round(H * 0.03));
    var avail = H - 2 * m;
    var btn = Math.min(44, Math.max(28, 0.075 * (H / RATIO)));
    var sideRoom = single ? 0 : Math.round(btn + 40);
    pw = Math.floor(single ? Math.min(W, avail / RATIO) : Math.min((W - 2 * sideRoom) / 2, avail / RATIO));
    if (!single && pw < 200) pw = Math.floor(Math.min(W / 2, avail / RATIO));
    ph = Math.floor(pw * RATIO);
    var bw = single ? pw : pw * 2;
    book.style.width = bw + "px";
    book.style.height = ph + "px";
    book.style.left = Math.round((W - bw) / 2) + "px";
    book.style.top = Math.round((H - ph) / 2) + "px";
    book.style.setProperty("--pw", pw + "px");
    book.classList.toggle("single", single);
    slotL.classList.toggle("hide", single);
    slotR.style.left = single ? "0" : "50%";
    slotR.style.width = single ? "100%" : "50%";
    render();
  }

  function stackWidths(i) {
    var u = Math.max(0.9, pw / 520) * 8 / Math.max(1, LAST);
    return [SP[i][0] ? i * u : 0, SP[i][1] ? (LAST - i) * u + u * 1.5 : 0];
  }

  function updateArrows() {
    var atStart = single ? pg === 0 : idx === 0;
    var atEnd = single ? pg === TOTAL - 1 : idx === LAST;
    arrL.classList.toggle("off", atStart);
    arrR.classList.toggle("off", atEnd);
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.className = atEnd && !single ? "flipbook-close right" : "flipbook-close left";
    }
  }

  function applyState() {
    var jobs = [];
    if (single) {
      jobs.push(setPage(slotR, jumpPage || (pg + 1)));
    } else if (jumpPage) {
      var pairIdx = spreadIndexForPage(jumpPage);
      jobs.push(setPage(slotL, SP[pairIdx][0]));
      jobs.push(setPage(slotR, SP[pairIdx][1]));
      var wj = stackWidths(idx);
      stackL.style.width = wj[0] + "px";
      stackR.style.width = wj[1] + "px";
    } else {
      jobs.push(setPage(slotL, SP[idx][0]));
      jobs.push(setPage(slotR, SP[idx][1]));
      var w = stackWidths(idx);
      stackL.style.width = w[0] + "px";
      stackR.style.width = w[1] + "px";
    }
    updateArrows();
    return Promise.all(jobs);
  }

  function hideLeaf() {
    slotL.style.opacity = "";
    leaf.style.display = "none";
    front.style.cssText = "";
    back.style.cssText = "";
  }

  function raf2() {
    return new Promise(function (res) {
      var done = false;
      var fin = function () { if (!done) { done = true; res(); } };
      requestAnimationFrame(function () { requestAnimationFrame(fin); });
      setTimeout(fin, 120);
    });
  }

  function render() { return applyState().then(hideLeaf); }

  function rot(a) { return "perspective(" + Math.round(pw * 3.4) + "px) rotateY(" + a + "deg)"; }

  function faceFrames(isSingle) {
    if (isSingle) {
      return {
        front: [{ transform: rot(0), opacity: 1 }, { transform: rot(-82), opacity: 1, offset: 0.86 }, { transform: rot(-90), opacity: 0 }],
        back: [],
      };
    }
    return {
      front: [
        { transform: rot(0), opacity: 1, offset: 0 },
        { transform: rot(-90), opacity: 1, offset: 0.5 },
        { transform: rot(-90), opacity: 0, offset: 0.5001 },
        { transform: rot(-90), opacity: 0, offset: 1 },
      ],
      back: [
        { transform: rot(90), opacity: 0, offset: 0 },
        { transform: rot(90), opacity: 0, offset: 0.4999 },
        { transform: rot(90), opacity: 1, offset: 0.5 },
        { transform: rot(0), opacity: 1, offset: 1 },
      ],
    };
  }

  var FRAMES = {
    front: [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0.55 }],
    back: [{ opacity: 0.55 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }],
    castR: [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
    castL: [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
  };

  function run(dir, from, to) {
    if (busy) return;
    busy = true;
    var gen = turnGen;
    var dur = single ? 820 : 1000;
    var jobs = [];
    var slotPlan = [];
    if (single) {
      if (dir > 0) { jobs.push(setPage(front, from + 1)); slotPlan.push([slotR, to + 1]); }
      else { jobs.push(setPage(front, to + 1)); }
      jobs.push(setPage(back, 0, true));
      if (dir > 0) jobs.push(warm(to + 1));
    } else {
      var a = SP[from];
      var b = SP[to];
      if (dir > 0) {
        jobs.push(setPage(front, a[1]), setPage(back, b[0], true), warm(b[1]));
        slotPlan.push([slotR, b[1]]);
      } else {
        jobs.push(setPage(front, b[1]), setPage(back, a[0], true), warm(b[0]));
        slotPlan.push([slotL, b[0]]);
      }
    }
    Promise.all(jobs).then(function () {
      if (gen !== turnGen) return;
      leaf.style.display = "block";
      if (dir > 0) {
        front.style.transform = rot(0); front.style.opacity = "1"; back.style.opacity = "0"; back.style.transform = rot(90);
      } else {
        front.style.opacity = "0"; front.style.transform = rot(-90); back.style.opacity = "1"; back.style.transform = rot(0);
      }
      return raf2();
    }).then(function () {
      if (gen !== turnGen) return;
      var opts = { duration: dur, easing: "cubic-bezier(.62,.04,.3,1)", fill: "both", direction: dir > 0 ? "normal" : "reverse" };
      var anims = [];
      var ff = faceFrames(single);
      anims.push(front.animate(ff.front, opts));
      if (!single) anims.push(back.animate(ff.back, opts));
      anims.push(front.querySelector(".sh").animate(FRAMES.front, opts));
      anims.push(back.querySelector(".sh").animate(FRAMES.back, opts));
      anims.push(slotR.querySelector(".cast").animate(FRAMES.castR, opts));
      if (!single) anims.push(slotL.querySelector(".cast").animate(FRAMES.castL, opts));
      turnAnims = anims;
      if (!single) {
        var w = stackWidths(to);
        stackL.style.transition = stackR.style.transition = "width " + dur + "ms ease";
        stackL.style.width = w[0] + "px";
        stackR.style.width = w[1] + "px";
      }
      slotPlan.forEach(function (s) { setPage(s[0], s[1]); });
      if (single) pg = to; else idx = to;
      updateArrows();
      return Promise.all(anims.map(function (x) { return x.finished; })).then(function () {
        if (gen !== turnGen) return;
        return applyState().then(raf2).then(function () {
          if (gen !== turnGen) return;
          if (single) return;
          var out = leaf.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "linear", fill: "forwards" });
          anims.push(out);
          return out.finished;
        }).then(function () {
          if (gen !== turnGen) return;
          hideLeaf();
          anims.forEach(function (x) { try { x.cancel(); } catch (e) {} });
          turnAnims = [];
          stackL.style.transition = stackR.style.transition = "";
          busy = false;
        });
      });
    }).catch(function () { if (gen === turnGen) { busy = false; render(); } });
  }

  function go(dir) {
    if (jumpPage) {
      idx = spreadIndexForPage(jumpPage);
      pg = jumpPage - 1;
      jumpPage = 0;
    }
    if (busy) return;
    if (single) resetViewZoom();
    if (single) {
      var n = pg + dir;
      if (n < 0 || n >= TOTAL) return;
      run(dir, pg, n);
    } else {
      var m = idx + dir;
      if (m < 0 || m > LAST) return;
      run(dir, idx, m);
    }
  }

  function atLastPage() { return single ? pg === TOTAL - 1 : idx === LAST; }

  function restart() {
    if (busy) return;
    busy = true;
    book.classList.add("fading");
    setTimeout(function () {
      jumpPage = 0;
      idx = 0;
      pg = 0;
      applyState().then(function () {
        hideLeaf();
        book.classList.remove("fading");
        busy = false;
      });
    }, 380);
  }

  function goToStart() {
    abortTurn();
    resetViewZoom();
    hideLeaf();
    jumpPage = 0;
    idx = 0;
    pg = 0;
    applyState();
  }

  function goToEnd() {
    abortTurn();
    resetViewZoom();
    hideLeaf();
    jumpPage = 0;
    idx = LAST;
    pg = TOTAL - 1;
    applyState();
  }

  var mobileZoomCtl = null;
  function resetViewZoom() {
    if (mobileZoomCtl) mobileZoomCtl.reset();
  }
  mobileZoomCtl = attachFlipbookMobileZoom({
    stage: stage,
    book: book,
    isSingle: function () { return single; },
    layoutSize: function () { return { pw: pw, ph: ph, spread: !single }; },
    onTurn: function (dir) { go(dir); },
    ignoreTarget: function (el) {
      return el.closest && (el.closest(".flipbook-close") || el.closest(".arrow"));
    },
    onTap: function (e, type) {
      var r = stage.getBoundingClientRect();
      var onRight = e.clientX - r.left >= r.width / 2;
      if (type === "touch") {
        if (atLastPage()) restart();
      } else if (atLastPage() && (single || onRight)) {
        restart();
      } else {
        go(onRight ? 1 : -1);
      }
    },
    onJump: function (dir) {
      if (dir < 0) goToStart();
      else goToEnd();
    },
  });
  if (typeof wireFlipArrows === "function") {
    wireFlipArrows(arrL, arrR, { start: goToStart, end: goToEnd, turn: go });
  }
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "PageDown") { if (atLastPage()) restart(); else go(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
  });
  window.addEventListener("resize", function () { if (!busy) layout(); else setTimeout(layout, 1100); });

  function applyFirstPageRatio() {
    var url = src(1);
    if (!url) return Promise.resolve();
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        if (im.naturalWidth > 0 && im.naturalHeight > 0) {
          RATIO = im.naturalHeight / im.naturalWidth;
          layout();
        }
        res();
      };
      im.onerror = function () { res(); };
      im.src = url;
    });
  }

  function load(n) {
    return new Promise(function (res) {
      var s = src(n);
      if (!s) return res();
      var im = new Image();
      im.onload = im.onerror = function () { res(); };
      im.src = s;
    });
  }

  function signalReaderReady() {
    try {
      if (window.top && window.top !== window) {
        window.top.postMessage({ type: "spodazo-reader-ready" }, window.top.location.origin);
      }
    } catch (e) {}
  }

  applyFirstPageRatio().then(function () { layout(); });

  Promise.race([
    Promise.all([load(1), load(2), load(3)]),
    new Promise(function (r) { setTimeout(r, 4000); }),
  ]).then(function () {
    book.classList.add("ready");
    requestAnimationFrame(function () {
      requestAnimationFrame(signalReaderReady);
    });
    var n = 4;
    (function next() { if (n > IMAGES) return; load(n++).then(next); })();
  });
})();
