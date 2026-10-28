/**
 * Cold song starts (first open after a while, or after a reset) play the
 * MPEG header as a scratch. Phones and tablets use the same short opener as
 * the music app: silence for 30ms, then a 20ms fade. Desktop plays at once.
 */
(function (global) {
  var HOLD_MS = 30;
  var FADE_MS = 20;

  function setPlaybackSession() {
    try {
      var session = global.navigator && global.navigator.audioSession;
      if (session) session.type = "playback";
    } catch (e) {}
  }

  function mobilePlayback() {
    var nav = global.navigator;
    if (!nav) return false;
    var ua = nav.userAgent || "";
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
    return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
  }

  function nextFrame(fn) {
    var raf = global.requestAnimationFrame;
    if (raf) raf.call(global, fn);
    else setTimeout(function () { fn(Date.now()); }, 16);
  }

  function now() {
    return global.performance && global.performance.now ? global.performance.now() : Date.now();
  }

  function fadeVolume(audio, from, to, ms) {
    var started = now();
    function step(t) {
      if (audio.paused) return;
      var p = Math.min(1, (t - started) / ms);
      audio.volume = from + (to - from) * p;
      if (p < 1) nextFrame(step);
    }
    nextFrame(step);
  }

  function playBookSong(audio) {
    if (!audio) return Promise.resolve();
    setPlaybackSession();
    if (audio.ended) {
      try { audio.currentTime = 0; } catch (e) {}
    }
    var atStart = audio.ended || audio.currentTime < 0.2;
    var level = typeof audio.volume === "number" ? audio.volume : 1;
    if (!level) level = 1;
    var duck = !audio.muted && mobilePlayback() && atStart;
    if (duck) audio.volume = 0;
    var attempt = audio.play();
    var played = attempt && attempt.then ? attempt : Promise.resolve();
    if (!duck) return played.then(function () {});
    played.then(function () {
      setTimeout(function () {
        if (audio.paused || audio.muted) {
          audio.volume = level;
          return;
        }
        fadeVolume(audio, 0, level, FADE_MS);
      }, HOLD_MS);
    }).catch(function () {
      audio.volume = level;
    });
    return played.then(function () {});
  }

  global.playBookSong = playBookSong;
})(typeof window !== "undefined" ? window : globalThis);
