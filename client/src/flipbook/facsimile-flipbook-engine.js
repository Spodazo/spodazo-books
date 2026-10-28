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
  var PAGE_LINKS = cfg.pageLinks && typeof cfg.pageLinks === "object" ? cfg.pageLinks : {};
  var SING = cfg.singAlong && typeof cfg.singAlong === "object" ? cfg.singAlong : null;

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
  // A song-list tap must stay on the cover leaf. Mobile Safari then synthesizes
  // a mouse click that was turning forward onto the lyrics leaf.
  var suppressTurns = false;
  var suppressTurnsUntil = 0;
  var landPage = 0;

  function turnsSuppressed() {
    return suppressTurns || Date.now() < suppressTurnsUntil;
  }
  var turnGen = 0;
  var turnAnims = [];

  var song = null;
  var songMuted = true;
  var songStarted = false;
  var songFollowTurn = false;
  var verselessSpreadKey = "";
  var verselessSpreadAt = 0;
  var songFollowPoll = null;
  var soundBtn = document.getElementById("soundBtn");

  function songAudioUrl() {
    if (!SING) return "";
    var src = SING.audio;
    if (/^https?:\/\//i.test(src)) return src;
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return src;
    }
  }

  function cueForPdfPage(n) {
    if (!SING || n < SING.firstPage || n > SING.endPage) return NaN;
    return SING.cues[n - SING.firstPage];
  }

  function visiblePdfPages() {
    if (single) return [jumpPage || landPage || pg + 1];
    var pair = SP[idx] || [0, 0];
    return [pair[0], pair[1]].filter(function (n) { return n > 0 && n <= TOTAL; });
  }

  function maxVisiblePdfPage() {
    var pages = visiblePdfPages();
    return pages.length ? Math.max.apply(null, pages) : 0;
  }

  /** Left / earliest story leaf on a spread — used so audio does not jump to verse 2. */
  function storySyncPdfPage() {
    if (!SING) return 0;
    var story = visiblePdfPages().filter(function (n) { return n >= SING.firstPage; });
    return story.length ? Math.min.apply(null, story) : 0;
  }

  function storyMaxVisiblePdfPage() {
    if (!SING) return 0;
    var story = visiblePdfPages().filter(function (n) { return n >= SING.firstPage; });
    return story.length ? Math.max.apply(null, story) : 0;
  }

  /** Rewind anchor: left page until the right-hand verse has started (e.g. page 13 then page 14). */
  function storySyncAnchorPdfPage() {
    if (!SING) return 0;
    var story = visiblePdfPages().filter(function (n) { return n >= SING.firstPage; });
    if (!story.length) return 0;
    var minP = Math.min.apply(null, story);
    var maxP = Math.max.apply(null, story);
    if (minP === maxP) return minP;
    var cMax = cueForPdfPage(maxP);
    var t = song ? song.currentTime : 0;
    if (!isNaN(cMax) && t + 0.05 >= cMax) return maxP;
    return minP;
  }

  function pdfPageForTime(t) {
    if (!SING) return 0;
    var best = 0;
    var page;
    var c;
    var lead;
    for (page = SING.firstPage; page <= SING.endPage; page++) {
      c = cueForPdfPage(page);
      lead = page === SING.endPage ? 0 : 0.35;
      if (t + lead >= c) best = page;
    }
    var outro = SING.outroCues || [];
    for (var i = 0; i < outro.length; i++) {
      if (t >= outro[i][0]) best = Math.max(best, outro[i][1]);
    }
    return best;
  }

  function ensureSong() {
    if (!SING) return null;
    if (song) return song;
    song = new Audio(songAudioUrl());
    song.preload = "auto";
    song.muted = songMuted;
    song.setAttribute("playsinline", "");
    song.addEventListener("timeupdate", followSong);
    song.addEventListener("ended", function () {
      disarmSongFollowPoll();
      syncSoundButton();
      followSong();
    });
    song.addEventListener("play", function () {
      armSongFollowPoll();
      syncSoundButton();
    });
    song.addEventListener("pause", function () {
      disarmSongFollowPoll();
      syncSoundButton();
    });
    return song;
  }

  function armSongFollowPoll() {
    if (songFollowPoll || !SING) return;
    songFollowPoll = setInterval(function () {
      if (songPlaybackActive()) followSong();
    }, 350);
  }

  function disarmSongFollowPoll() {
    if (!songFollowPoll) return;
    clearInterval(songFollowPoll);
    songFollowPoll = null;
  }

  function musicAudible() {
    return !!(song && !songMuted && !song.paused && !song.ended);
  }

  function syncSoundButton() {
    if (!soundBtn) return;
    var audible = musicAudible();
    var label = audible ? "Silence Music" : "Start Music";
    soundBtn.textContent = label;
    soundBtn.classList.toggle("is-playing", audible);
    soundBtn.setAttribute("aria-pressed", audible ? "true" : "false");
    soundBtn.setAttribute("aria-label", label);
  }

  function placeSoundButton() {
    if (!soundBtn) return;
    var r = book.getBoundingClientRect();
    var sr = stage.getBoundingClientRect();
    var gapAbove = 14;
    var sideGap = Math.max(10, Math.round(pw * 0.035));
    var compactLandscape = sr.width > sr.height && Math.min(sr.width, sr.height) < 520;
    var w = soundBtn.offsetWidth || 106;
    var h = soundBtn.offsetHeight || 29;
    var x;
    var y;
    if (compactLandscape) {
      x = sr.width - w - Math.max(12, sideGap);
      y = sr.height / 3 - h / 2;
    } else {
      x = r.left - sr.left + r.width / 2 - w / 2;
      y = r.top - sr.top - h - gapAbove;
    }
    soundBtn.style.left = Math.round(x) + "px";
    soundBtn.style.top = Math.round(Math.max(0, y)) + "px";
  }

  function updateSoundButton() {
    if (!SING || !soundBtn) return;
    var pages = visiblePdfPages();
    var maxPage = pages.length ? Math.max.apply(null, pages) : 0;
    var minPage = pages.length ? Math.min.apply(null, pages) : 0;
    var theEnd = Number(SING.outroFirstPage) || (Number(SING.endPage) + 1);
    var show = maxPage >= SING.firstPage && minPage < theEnd;
    soundBtn.hidden = false;
    soundBtn.classList.toggle("is-visible", show);
    soundBtn.setAttribute("aria-hidden", show ? "false" : "true");
    syncSoundButton();
    placeSoundButton();
  }

  function syncSongTimeToView() {
    if (!SING) return;
    var page = storySyncAnchorPdfPage();
    var c;
    if (page < SING.firstPage) return;
    c = cueForPdfPage(page);
    if (isNaN(c)) return;
    ensureSong();
    if (song.currentTime < c - 0.5) song.currentTime = c;
  }

  function songPlaybackActive() {
    return !!(songStarted && song && !song.paused);
  }

  /** Snap playback to the visible story page after a manual page turn (keeps playing). */
  function syncSongToManualPage() {
    if (!SING || !songPlaybackActive()) return;
    ensureSong();
    var page = manualSyncPdfPage();
    var c;
    if (page < SING.firstPage) return;
    c = cueForPdfPage(page);
    if (isNaN(c)) return;
    if (page === SING.firstPage && c < 0.5) {
      song.currentTime = 0;
      return;
    }
    // A forward jump of more than a few seconds was landing in the finale.
    if (c > song.currentTime + 4) return;
    song.currentTime = c;
  }

  function startSongFromBeginning() {
    if (!SING || songStarted) return;
    ensureSong();
    songMuted = false;
    song.muted = false;
    if (song.ended || song.currentTime > 0.2) {
      try { song.currentTime = 0; } catch (e) {}
    }
    var playAttempt = playBookSong(song);
    if (!playAttempt || !playAttempt.then) return;
    playAttempt.then(function () {
      songStarted = true;
      syncSoundButton();
      placeSoundButton();
    }).catch(function () {});
  }

  function maybeStartSongOnFirstPage() {
    if (!SING || songStarted || songFollowTurn) return;
    var pages = visiblePdfPages();
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === SING.firstPage) {
        startSongFromBeginning();
        return;
      }
    }
  }

  function afterTurnSongSync() {
    if (songFollowTurn) {
      songFollowTurn = false;
      followSong();
      return;
    }
    maybeStartSongOnFirstPage();
    syncSongToManualPage();
  }

  function primeSongTime() {
    if (storySyncPdfPage() === SING.firstPage && (!songStarted || song.currentTime < 0.25)) {
      if (song && (song.ended || song.currentTime > 0.25)) {
        try { song.currentTime = 0; } catch (e) {}
      }
    } else syncSongTimeToView();
  }

  function toggleMusicButton() {
    if (!SING) return;
    ensureSong();
    if (musicAudible()) {
      songMuted = true;
      song.muted = true;
      syncSoundButton();
      placeSoundButton();
      return;
    }
    songMuted = false;
    song.muted = false;
    if (maxVisiblePdfPage() < SING.firstPage) {
      syncSoundButton();
      return;
    }
    primeSongTime();
    if (song.paused || song.ended) {
      var playAttempt = playBookSong(song);
      if (!playAttempt || !playAttempt.then) return;
      playAttempt.then(function () {
        songStarted = true;
        syncSoundButton();
        placeSoundButton();
      }).catch(function () {});
      return;
    }
    syncSoundButton();
    placeSoundButton();
  }

  function isPdfPageShown(n) {
    if (!n) return true;
    var pages = visiblePdfPages();
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === n) return true;
    }
    return false;
  }

  function manualSyncPdfPage() {
    if (single) return pg + 1;
    var pair = SP[idx] || [0, 0];
    if (pair[0] >= SING.firstPage) return pair[0];
    if (pair[1] >= SING.firstPage) return pair[1];
    return 0;
  }

  function verselessBriefSpreads() {
    if (!SING) return [];
    if (Array.isArray(SING.verselessBriefSpreads) && SING.verselessBriefSpreads.length) {
      return SING.verselessBriefSpreads;
    }
    if (SING.verselessBriefSpread) return [SING.verselessBriefSpread];
    return [];
  }

  function verselessBriefForSpread(pair) {
    var list = verselessBriefSpreads();
    var i;
    var b;
    for (i = 0; i < list.length; i++) {
      b = list[i];
      if (pair[0] === b.left && pair[1] === b.right) return b;
    }
    return null;
  }

  function checkVerselessBriefAdvance() {
    var brief;
    var pair;
    var key;
    var cue;
    if (!SING || busy || !songPlaybackActive()) {
      if (!SING || !verselessBriefSpreads().length) verselessSpreadKey = "";
      return;
    }
    pair = SP[idx] || [0, 0];
    brief = verselessBriefForSpread(pair);
    if (!brief) {
      verselessSpreadKey = "";
      return;
    }
    if (brief.startAfterPdfPage) {
      cue = cueForPdfPage(brief.startAfterPdfPage);
      if (isNaN(cue) || song.currentTime < cue) {
        verselessSpreadKey = "";
        return;
      }
    }
    key = brief.left + "," + brief.right + "," + (brief.startAfterPdfPage || 0);
    if (verselessSpreadKey !== key) {
      verselessSpreadKey = key;
      verselessSpreadAt = Date.now();
      return;
    }
    if (Date.now() - verselessSpreadAt >= brief.dwellMs) {
      verselessSpreadKey = "";
      go(1, true);
    }
  }

  function pageHoldBlocksTurn(audio) {
    var hold = SING && SING.pageHold;
    var pages;
    var i;
    if (!hold || !audio) return false;
    pages = visiblePdfPages();
    for (i = 0; i < pages.length; i++) {
      if (pages[i] === hold.pdfPage && audio.currentTime < hold.until) return true;
    }
    return false;
  }

  function followSong() {
    var target;
    var needIdx;
    var pair;
    if (!SING || busy) return;
    var audio = ensureSong();
    if (!audio || (audio.paused && !audio.ended)) return;
    if (pageHoldBlocksTurn(audio)) return;
    checkVerselessBriefAdvance();
    if (busy) return;
    target = pdfPageForTime(audio.ended ? SING.duration : audio.currentTime);
    if (target < SING.firstPage) return;
    if (target > TOTAL) target = TOTAL;
    if (single) {
      if (pg + 1 < target) go(1, true);
      return;
    }
    needIdx = spreadIndexForTargetPage(target);
    if (needIdx < 0) return;
    if (needIdx > idx) {
      go(1, true);
      return;
    }
    if (needIdx === idx) {
      pair = SP[idx] || [0, 0];
      if (pair[1] > 0 && pair[1] < target) go(1, true);
    }
  }

  function stopSong() {
    songStarted = false;
    disarmSongFollowPoll();
    verselessSpreadKey = "";
    if (!song) {
      syncSoundButton();
      return;
    }
    song.pause();
    try { song.currentTime = 0; } catch (e) {}
    songMuted = true;
    song.muted = true;
    syncSoundButton();
  }

  if (soundBtn && SING) {
    soundBtn.addEventListener("pointerup", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMusicButton();
    });
    soundBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  }

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

  function linksFor(n) {
    return PAGE_LINKS[n] || PAGE_LINKS[String(n)] || [];
  }

  function isSectionStart(n) {
    var keys = Object.keys(PAGE_LINKS);
    for (var i = 0; i < keys.length; i++) {
      var list = PAGE_LINKS[keys[i]] || [];
      for (var j = 0; j < list.length; j++) if (Number(list[j].page) === n) return true;
    }
    return false;
  }

  function sectionPagePair(n) {
    if (n >= IMAGES) return [0, n];
    var right = n + 1;
    if (right > IMAGES || isSectionStart(right)) return [n, 0];
    return [n, right];
  }

  function goToPageNumber(n) {
    if (!n || n < 1 || n > IMAGES) return;
    abortTurn();
    resetViewZoom();
    hideLeaf();
    jumpPage = n;
    landPage = n;
    pg = n - 1;
    idx = spreadIndexForPage(n);
    suppressTurns = true;
    suppressTurnsUntil = Date.now() + 900;
    applyState().then(afterTurnSongSync);
  }

  function clearIndexHots(page) {
    page.classList.remove("index");
    page.removeAttribute("data-index-hots");
    Array.prototype.slice.call(page.querySelectorAll(".hot-index")).forEach(function (el) { el.remove(); });
  }

  function imageContentBox(page) {
    var img = page.querySelector("img");
    var pw = page.clientWidth || 1;
    var ph = page.clientHeight || 1;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { top: 0, left: 0, width: 100, height: 100 };
    }
    var ir = img.naturalWidth / img.naturalHeight;
    var pr = pw / ph;
    if (ir > pr) {
      var h = ((pw / ir) / ph) * 100;
      return { top: (100 - h) / 2, left: 0, width: 100, height: h };
    }
    var w = ((ph * ir) / pw) * 100;
    return { top: 0, left: (100 - w) / 2, width: w, height: 100 };
  }

  function rudolphSingalongNoteMetrics(imageWidth, imageHeight) {
    var ratio = imageWidth / imageHeight;
    if (ratio < 0.75) {
      return { topPct: 91.1, fontSizePct: 1.182, color: "#6b0f28" };
    }
    return { topPct: 43.52, fontSizePct: 1.481, color: "#6a111f" };
  }

  function placeRudolphSingalongNote(page) {
    var el = page.querySelector(".rudolph-singalong-note");
    if (!el || !SING) return;
    var img = page.querySelector("img");
    var box = imageContentBox(page);
    var ph = page.clientHeight || 1;
    var iw = img && img.naturalWidth ? img.naturalWidth : 900;
    var ih = img && img.naturalHeight ? img.naturalHeight : 1080;
    var metrics = rudolphSingalongNoteMetrics(iw, ih);
    var imgDisplayH = (box.height / 100) * ph;
    el.style.color = metrics.color;
    el.style.fontSize = imgDisplayH * metrics.fontSizePct / 100 + "px";
    el.style.top = box.top + metrics.topPct * box.height / 100 + "%";
    el.style.left = box.left + box.width / 2 + "%";
    el.style.transform = "translateX(-50%)";
  }

  function syncRudolphSingalongNote(host, n) {
    if (!SING) return;
    var notePage = Number(SING.singalongNotePage) || 0;
    var noteText = String(SING.singalongNoteText || "").trim();
    var p = pageEl(host);
    var el = p.querySelector(".rudolph-singalong-note");
    if (!noteText || n !== notePage) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("p");
      el.className = "rudolph-singalong-note";
      p.appendChild(el);
    }
    el.textContent = noteText;
    placeRudolphSingalongNote(p);
  }

  function repositionRudolphSingalongNotes() {
    if (!SING) return;
    var notes = document.querySelectorAll(".rudolph-singalong-note");
    for (var i = 0; i < notes.length; i++) {
      placeRudolphSingalongNote(notes[i].parentElement);
    }
    var agains = document.querySelectorAll(".rudolph-read-again");
    for (var j = 0; j < agains.length; j++) {
      placeRudolphReadAgain(agains[j].parentElement);
    }
  }

  function placeRudolphReadAgain(page) {
    var el = page.querySelector(".rudolph-read-again");
    if (!el) return;
    var img = page.querySelector("img");
    var box = imageContentBox(page);
    var ph = page.clientHeight || 1;
    var iw = img && img.naturalWidth ? img.naturalWidth : 900;
    var ih = img && img.naturalHeight ? img.naturalHeight : 1080;
    var metrics = rudolphSingalongNoteMetrics(iw, ih);
    var imgDisplayH = (box.height / 100) * ph;
    el.style.fontSize = imgDisplayH * metrics.fontSizePct / 100 + "px";
    el.style.top = box.top + 61 * box.height / 100 + "%";
    el.style.left = box.left + box.width / 2 + "%";
  }

  function syncRudolphReadAgain(host, n) {
    if (!SING) return;
    var p = pageEl(host);
    var el = p.querySelector(".rudolph-read-again");
    if (n !== TOTAL) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.className = "rudolph-read-again";
      el.textContent = "Read Again";
      el.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.preventDefault();
      });
      el.addEventListener("pointerup", function (e) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.preventDefault();
        restart();
      });
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
      });
      p.appendChild(el);
    }
    placeRudolphReadAgain(p);
  }

  var COVER_LINKS = [
    { kind: "again", label: "Read Again", top: 40.3, left: 36, width: 28, height: 5.2 },
    { kind: "close", label: "Close", top: 46.9, left: 40.5, width: 19, height: 5.2 },
  ];

  function placeCoverLinks(page) {
    var box = imageContentBox(page);
    Array.prototype.forEach.call(page.querySelectorAll(".hot-again, .hot-close"), function (b) {
      b.style.top = (box.top + Number(b.dataset.top) * box.height / 100) + "%";
      b.style.left = (box.left + Number(b.dataset.left) * box.width / 100) + "%";
      b.style.width = (Number(b.dataset.width) * box.width / 100) + "%";
      b.style.height = (Number(b.dataset.height) * box.height / 100) + "%";
    });
  }

  function mountCoverLinks(page) {
    if (page.getAttribute("data-cover-links") !== "1") {
      page.setAttribute("data-cover-links", "1");
      COVER_LINKS.forEach(function (link) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "hot hot-" + link.kind;
        b.dataset.top = link.top;
        b.dataset.left = link.left;
        b.dataset.width = link.width;
        b.dataset.height = link.height;
        b.setAttribute("aria-label", link.label);
        function activate(e) {
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          e.preventDefault();
          if (link.kind === "again") restart();
          else exitToLibrary();
        }
        b.addEventListener("pointerdown", function (e) {
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          e.preventDefault();
        });
        b.addEventListener("pointerup", activate);
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          e.preventDefault();
          if (e.detail === 0) activate(e);
        });
        page.appendChild(b);
      });
    }
    placeCoverLinks(page);
  }

  function mountIndexHots(page, n) {
    var links = linksFor(n);
    clearIndexHots(page);
    if (!links.length) return;
    page.classList.add("index");
    page.setAttribute("data-index-hots", String(n));
    var box = imageContentBox(page);
    links.forEach(function (link) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hot hot-index";
      b.style.top = (box.top + Number(link.top) * box.height / 100) + "%";
      b.style.left = (box.left + Number(link.left) * box.width / 100) + "%";
      b.style.width = (Number(link.width) * box.width / 100) + "%";
      b.style.height = (Number(link.height) * box.height / 100) + "%";
      b.setAttribute("aria-label", link.label || ("Go to page " + link.page));
      function activate(e) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.preventDefault();
        goToPageNumber(Number(link.page));
      }
      b.addEventListener("pointerdown", function (e) {
        suppressTurns = true;
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.preventDefault();
      });
      b.addEventListener("pointerup", activate);
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (e.detail === 0) activate(e);
      });
      page.appendChild(b);
    });
  }

  function setPage(host, n, blankPaper) {
    var p = pageEl(host);
    var img = p.querySelector("img");
    p.classList.remove("empty", "blank", "again", "link", "index");
    clearIndexHots(p);
    if (n === TOTAL) {
      if (SING) syncRudolphReadAgain(host, n);
      else {
        p.classList.add("link");
        mountCoverLinks(p);
      }
    }
    if (n && linksFor(n).length) {
      p.classList.add("index");
      mountIndexHots(p, n);
    }
    if (!n) {
      img.removeAttribute("src");
      p.classList.add(blankPaper ? "blank" : "empty");
      syncRudolphSingalongNote(host, n);
      syncRudolphReadAgain(host, n);
      return Promise.resolve();
    }
    var s = src(n);
    if (img.getAttribute("src") !== s) img.setAttribute("src", s);
    syncRudolphSingalongNote(host, n);
    syncRudolphReadAgain(host, n);
    return (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () {
      if (n === TOTAL && !SING) placeCoverLinks(p);
      if (n && linksFor(n).length) mountIndexHots(p, n);
      syncRudolphSingalongNote(host, n);
      syncRudolphReadAgain(host, n);
    });
  }

  function warm(n) {
    var s = src(n);
    if (!s) return Promise.resolve();
    var im = new Image();
    im.src = s;
    return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
  }

  function decideMode(W, H) {
    return decideFlipbookSingle(W, H);
  }

  function spreadIndexForPage(n) {
    for (var i = 0; i <= LAST; i++) {
      if (SP[i][0] === n || SP[i][1] === n) return i;
    }
    return -1;
  }

  /** Spread that should be visible for this PDF page (story or outro leaf). */
  function spreadIndexForTargetPage(target) {
    var ti;
    var i;
    var pair;
    var maxP;
    if (!target || target < 1) return -1;
    ti = spreadIndexForPage(target);
    if (ti >= 0) return ti;
    for (i = 0; i <= LAST; i++) {
      pair = SP[i];
      maxP = Math.max(pair[0], pair[1]);
      if (maxP >= target) return i;
    }
    return LAST;
  }

  function layout() {
    if (busy) return;
    var r = stage.getBoundingClientRect();
    var W = r.width;
    var H = r.height;
    var wasSingle = single;
    single = decideMode(W, H);
    if (single !== wasSingle) {
      resetViewZoom();
      if (single) {
        // Open on the cover/title leaf (left), never the lyrics leaf (right).
        if (jumpPage || landPage) pg = (jumpPage || landPage) - 1;
        else pg = Math.max(0, (SP[idx][0] || SP[idx][1]) - 1);
      }
      else { idx = spreadIndexForPage(pg + 1); }
    }
    var m = single ? Math.max(12, Math.round(H * 0.03)) : 2;
    var avail = H - 2 * m;
    if (single) {
      pw = Math.floor(Math.min(W, avail / RATIO));
      ph = Math.floor(pw * RATIO);
    } else {
      // The arrow sits 26px outside the page and is at most 44px wide. Keep the full height when that gutter already fits; otherwise scale the spread down.
      var btn = Math.min(44, Math.max(28, 0.075 * (avail / RATIO)));
      var sideRoom = Math.round(btn + 40);
      var fitPw = avail / RATIO;
      if (fitPw * 2 <= W - 2 * sideRoom) {
        ph = avail;
        pw = fitPw;
      } else if ((W - 2 * sideRoom) / 2 >= 200) {
        pw = (W - 2 * sideRoom) / 2;
        ph = pw * RATIO;
      } else {
        pw = Math.min(W / 2, fitPw);
        ph = pw * RATIO;
      }
    }
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
    updateSoundButton();
    repositionRudolphSingalongNotes();
  }

  function stackWidths(i) {
    var pair = SP[i] || [0, 0];
    if (!pair[0] && pair[1] === TOTAL) return [0, 0];
    var u = Math.max(0.9, pw / 520) * 8 / Math.max(1, LAST);
    return [pair[0] ? i * u : 0, pair[1] ? (LAST - i) * u + u * 1.5 : 0];
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
      var show = jumpPage || landPage || (pg + 1);
      jobs.push(setPage(slotR, show));
    } else if (jumpPage) {
      var pair = sectionPagePair(jumpPage);
      jobs.push(setPage(slotL, pair[0]));
      jobs.push(setPage(slotR, pair[1]));
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
    updateSoundButton();
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
          afterTurnSongSync();
        });
      });
    }).catch(function () {
      if (gen === turnGen) {
        busy = false;
        render();
        afterTurnSongSync();
      }
    });
  }

  function go(dir, fromSongFollow) {
    songFollowTurn = !!fromSongFollow;
    if (turnsSuppressed()) {
      songFollowTurn = false;
      return;
    }
    if (jumpPage || landPage) {
      var start = jumpPage || landPage;
      idx = spreadIndexForPage(start);
      pg = start - 1;
      jumpPage = 0;
      landPage = 0;
    }
    if (busy) {
      songFollowTurn = false;
      return;
    }
    resetViewZoom();
    if (single) {
      var n = pg + dir;
      if (n < 0 || n >= TOTAL) {
        songFollowTurn = false;
        return;
      }
      run(dir, pg, n);
    } else {
      var m = idx + dir;
      if (m < 0 || m > LAST) {
        songFollowTurn = false;
        return;
      }
      run(dir, idx, m);
    }
  }

  function atLastPage() { return single ? pg === TOTAL - 1 : idx === LAST; }

  function restart() {
    if (busy) return;
    busy = true;
    stopSong();
    book.classList.add("fading");
    setTimeout(function () {
      jumpPage = 0;
      landPage = 0;
      suppressTurns = false;
      suppressTurnsUntil = 0;
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
    landPage = 0;
    suppressTurns = false;
    suppressTurnsUntil = 0;
    idx = 0;
    pg = 0;
    applyState().then(afterTurnSongSync);
  }

  function goToEnd() {
    abortTurn();
    resetViewZoom();
    hideLeaf();
    jumpPage = 0;
    landPage = 0;
    suppressTurns = false;
    suppressTurnsUntil = 0;
    idx = LAST;
    pg = TOTAL - 1;
    applyState().then(afterTurnSongSync);
  }

  var mobileZoomCtl = null;
  function resetViewZoom() {
    if (mobileZoomCtl) mobileZoomCtl.reset();
  }
  stage.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest && e.target.closest(".hot-index")) return;
    if (e.pointerType === "mouse" && Date.now() < suppressTurnsUntil) return;
    suppressTurns = false;
    suppressTurnsUntil = 0;
  }, true);
  function turn(dir) {
    suppressTurns = false;
    suppressTurnsUntil = 0;
    go(dir);
  }
  mobileZoomCtl = attachFlipbookMobileZoom({
    stage: stage,
    book: book,
    isSingle: function () { return single; },
    layoutSize: function () { return { pw: pw, ph: ph, spread: !single }; },
    onTurn: function (dir) { go(dir); },
    ignoreTarget: function (el) {
      return el.closest && (el.closest(".flipbook-close") || el.closest(".hot") || el.closest(".arrow") || el.closest(".rudolph-sound"));
    },
    onTap: function (e) {
      if (turnsSuppressed() || landPage) return;
      var r = stage.getBoundingClientRect();
      var onRight = e.clientX - r.left >= r.width / 2;
      if (atLastPage() && onRight) restart();
      else go(onRight ? 1 : -1);
    },
    onJump: function (dir) {
      if (dir < 0) goToStart();
      else goToEnd();
    },
  });
  if (typeof wireFlipArrows === "function") {
    wireFlipArrows(arrL, arrR, { start: goToStart, end: goToEnd, turn: turn });
  }
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "PageDown") { if (atLastPage()) restart(); else turn(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") turn(-1);
  });
  window.addEventListener("resize", function () { if (!busy) layout(); else setTimeout(layout, 1100); });

  function applyFirstPageRatio() {
    var url = src(1);
    if (!url) return Promise.resolve();
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        if (im.naturalWidth > 0 && im.naturalHeight > 0) {
          var next = im.naturalHeight / im.naturalWidth;
          if (Math.abs(next - RATIO) > 0.01) {
            RATIO = next;
            if (!busy) layout();
          }
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

  layout();
  applyFirstPageRatio();

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
