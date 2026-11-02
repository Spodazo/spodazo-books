/**
 * Screen-record the live Rudolph book at https://books.spodazo.com/Rudolph.
 * Chrome plays the real page turns. This script only records that window.
 *
 *   npm run video:rudolph
 *   npm run video:rudolph -- --seconds 12
 *
 * Output: out/rudolph-the-red-nosed-reindeer-2160p.mp4
 */
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FACSIMILE_A4_RATIO, facsimileSpreads, FLIPBOOK_NAVY } from "../shared/facsimile-flipbook.ts";
import { rudolphSingAlongConfig, RUDOLPH_SONG_DURATION } from "../shared/rudolph-song-book.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pagesDir = path.join(root, "client/public/flipbooks/rudolph-the-red-nosed-reindeer/pages");
const audioPath = path.join(root, "media/audio/rudolph-the-red-nosed-reindeer.mp3");
const WIDTH = 3840;
const HEIGHT = 2160;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const secondsLimit = Number(arg("--seconds", "0")) || 0;
const holdSeconds = Math.max(0, Number(arg("--hold", "3")) || 0);
const bookUrl = "https://books.spodazo.com/Rudolph";
const preset = arg("--preset", "medium");
const outPath = path.resolve(arg("--out", path.join(root, "out/rudolph-the-red-nosed-reindeer-2160p.mp4")));

function embedJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function videoDocument() {
  const css = fs.readFileSync(path.join(root, "client/src/flipbook/facsimile-flipbook.css"), "utf8");
  const overlays = fs.readFileSync(path.join(root, "client/src/flipbook/rudolph-page-overlays.css"), "utf8");
  const engine = fs.readFileSync(path.join(root, "client/src/flipbook/facsimile-flipbook-engine.js"), "utf8");
  const pages = [];
  for (let i = 1; i <= 28; i += 1) pages.push(`/pages/p-${String(i).padStart(2, "0")}.jpg`);
  const singAlong = rudolphSingAlongConfig("/");
  singAlong.audio = "/audio/rudolph-the-red-nosed-reindeer.mp3";
  const config = {
    title: "Rudolph the Red Nosed Reindeer",
    pages,
    spreads: facsimileSpreads(pages.length),
    ratio: FACSIMILE_A4_RATIO,
    libraryUrl: "/",
    pageLinks: {},
    singAlong,
    video: true,
  };
  const theme = FLIPBOOK_NAVY;
  return `<!doctype html><html lang="en" class="rudolph-video" style="--ground:${theme.ground};--ground-edge:${theme.groundEdge};--paper:${theme.paper};--again:${theme.paper};--gold:${theme.gold}"><head><meta charset="utf-8"><title>Rudolph</title><style>${css}${overlays}</style></head><body><div id="stage" aria-label="Rudolph the Red Nosed Reindeer flip book" role="application"><a id="closeBtn" class="flipbook-close left" href="/" aria-label="Close">×</a><button type="button" id="soundBtn" class="rudolph-sound" hidden>Start Music</button><div id="book"><div class="stackWrapL"><div class="stack l" id="stackL"></div></div><div class="stackWrapR"><div class="stack r" id="stackR"></div></div><div class="slot L" id="slotL"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="slot R" id="slotR"><div class="page"><img alt="" decoding="async"></div><i class="cast"></i></div><div class="leaf" id="leaf"><div class="face front"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div><div class="face back"><div class="page"><img alt="" decoding="async"></div><i class="sh"></i></div></div><div class="arrow l off" id="arrL" aria-hidden="true"></div><div class="arrow r" id="arrR" aria-hidden="true"></div></div></div><script src="/flipbooks/mobile-view-zoom.js"></script><script src="/flipbooks/landscape-hint.js"></script><script src="/flipbooks/play-book-song.js"></script><script>window.FACSIMILE_FLIPBOOK=${embedJson(config)};</script><script>${engine}</script></body></html>`;
}

function contentType(file) {
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".mp3")) return "audio/mpeg";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startServer(html) {
  const flipbooks = path.join(root, "client/public/flipbooks");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let file = "";
    if (url.pathname === "/" || url.pathname === "/video.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }
    if (url.pathname.startsWith("/pages/")) file = path.join(pagesDir, path.basename(url.pathname));
    else if (url.pathname.startsWith("/audio/")) file = audioPath;
    else if (url.pathname.startsWith("/flipbooks/")) file = path.join(flipbooks, path.basename(url.pathname));
    if (!file || !file.startsWith(root) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function launchChrome(url) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "rudolph-video-chrome-"));
  const chrome = spawn(chromePath, [
    "--remote-debugging-port=0",
    "--user-data-dir=" + userDir,
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--no-first-run",
    "--no-default-browser-check",
    "--app=" + url,
    "--window-position=40,40",
    "--window-size=1680,945",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome did not open a debugging port")), 20000);
    function onData(chunk) {
      log += chunk.toString();
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    }
    chrome.stderr.on("data", onData);
    chrome.stdout.on("data", onData);
    chrome.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Chrome exited before debugging was ready (" + code + ")\n" + log.slice(-2000)));
    });
  });
  return { chrome, userDir, ready };
}

function openWebSocket(wsUrl) {
  const url = new URL(wsUrl);
  const key = crypto.randomBytes(16).toString("base64");
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(url.port), url.hostname);
    let buf = Buffer.alloc(0);
    let open = false;
    let fragments = [];
    let fragmentOp = 0;
    const messageListeners = [];
    function sendFrame(opcode, data) {
      const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const maskKey = crypto.randomBytes(4);
      const masked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ maskKey[i % 4];
      let header;
      if (payload.length < 126) header = Buffer.from([opcode, 0x80 | payload.length]);
      else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = opcode;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payload.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = opcode;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
      }
      socket.write(Buffer.concat([header, maskKey, masked]));
    }
    function emitText(payload) {
      const text = payload.toString("utf8");
      for (const fn of messageListeners) fn(text);
    }
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!open) {
        const end = buf.indexOf("\r\n\r\n");
        if (end < 0) return;
        const header = buf.subarray(0, end).toString("utf8");
        buf = buf.subarray(end + 4);
        if (!/^HTTP\/1\.1 101/.test(header)) {
          reject(new Error(header.split("\r\n")[0] || "WebSocket upgrade failed"));
          socket.destroy();
          return;
        }
        open = true;
        resolve(api);
      }
      while (buf.length >= 2) {
        const first = buf[0];
        const second = buf[1];
        const opcode = first & 0x0f;
        let length = second & 0x7f;
        let offset = 2;
        if (length === 126) {
          if (buf.length < 4) return;
          length = buf.readUInt16BE(2);
          offset = 4;
        } else if (length === 127) {
          if (buf.length < 10) return;
          length = Number(buf.readBigUInt64BE(2));
          offset = 10;
        }
        const masked = (second & 0x80) !== 0;
        const maskLen = masked ? 4 : 0;
        if (buf.length < offset + maskLen + length) return;
        let payload = Buffer.from(buf.subarray(offset + maskLen, offset + maskLen + length));
        if (masked) {
          const maskKey = buf.subarray(offset, offset + 4);
          for (let i = 0; i < payload.length; i += 1) payload[i] ^= maskKey[i % 4];
        }
        buf = buf.subarray(offset + maskLen + length);
        const fin = (first & 0x80) !== 0;
        if (opcode === 0 || !fin) {
          if (opcode !== 0) {
            fragmentOp = opcode;
            fragments = [payload];
          } else fragments.push(payload);
          if (!fin) continue;
          payload = Buffer.concat(fragments);
          fragments = [];
          if (fragmentOp === 1) emitText(payload);
          fragmentOp = 0;
          continue;
        }
        if (opcode === 1) emitText(payload);
        else if (opcode === 8) socket.end();
        else if (opcode === 9) sendFrame(0x8a, payload);
      }
    });
    socket.on("error", (error) => {
      if (!open) reject(error);
    });
    socket.on("connect", () => {
      const requestPath = url.pathname + url.search;
      socket.write(
        "GET " + requestPath + " HTTP/1.1\r\n" +
        "Host: " + url.host + "\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Key: " + key + "\r\n" +
        "Sec-WebSocket-Version: 13\r\n\r\n",
      );
    });
    const api = {
      send(text) { sendFrame(0x81, text); },
      onMessage(fn) { messageListeners.push(fn); },
      close() {
        try { sendFrame(0x88, Buffer.alloc(0)); } catch { /* socket already closed */ }
        socket.end();
      },
    };
  });
}

function connectSocket(wsUrl) {
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  const opened = openWebSocket(wsUrl).then((ws) => {
    ws.onMessage((data) => {
      const message = JSON.parse(data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || "Chrome command failed"));
        else resolve(message.result || {});
        return;
      }
      const list = listeners.get(message.method) || [];
      for (const fn of list) fn(message.params || {});
    });
    return ws;
  });
  return {
    opened,
    on(method, fn) {
      const list = listeners.get(method) || [];
      list.push(fn);
      listeners.set(method, list);
    },
    async send(method, params = {}) {
      const ws = await opened;
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      opened.then((ws) => ws.close()).catch(() => {});
    },
  };
}

async function pageSocket(browserWs) {
  const versionUrl = browserWs.replace("ws://", "http://").replace(/\/devtools\/browser\/.*$/, "/json/list");
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const list = await fetch(versionUrl).then((res) => res.json());
    const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    if (page) return page.webSocketDebuggerUrl;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome did not open a page");
}

async function evaluate(session, expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "page script failed");
  }
  return result.result ? result.result.value : undefined;
}

function jpegSize(buf) {
  for (let i = 0; i < buf.length - 8; i += 1) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
  }
  return { width: 0, height: 0 };
}

function writeConcat(listPath, frames) {
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < frames.length; i += 1) {
    lines.push("file '" + frames[i].file.replace(/'/g, "'\\''") + "'");
    lines.push("duration " + frames[i].duration.toFixed(6));
  }
  if (frames.length) lines.push("file '" + frames[frames.length - 1].file.replace(/'/g, "'\\''") + "'");
  fs.writeFileSync(listPath, lines.join("\n") + "\n");
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
      if (err.length > 12000) err = err.slice(-12000);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("ffmpeg failed\n" + err));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chromeWindowBox(session) {
  const { windowId } = await session.send("Browser.getWindowForTarget");
  const { bounds } = await session.send("Browser.getWindowBounds", { windowId });
  const scale = 2;
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);
  return {
    x: Math.max(0, Math.round((bounds.left || 0) * scale)),
    y: Math.max(0, Math.round((bounds.top || 0) * scale)),
    w: width - width % 2,
    h: height - height % 2,
  };
}

function startWindowRecording(pid, seconds, file) {
  const bin = path.join(os.tmpdir(), "record-one-window");
  execFileSync("swiftc", ["-o", bin, path.join(root, "scripts/record-one-window.swift")], { stdio: "inherit" });
  const child = spawn(bin, [String(pid), String(seconds), file], { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    err += chunk.toString();
    if (err.length > 8000) err = err.slice(-8000);
  });
  const closed = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("screen capture failed (" + (code ?? "signal") + ")\n" + err));
    });
  });
  return {
    child,
    closed,
    stop() {
      try { child.stdin.write("q"); } catch { /* already closed */ }
      setTimeout(() => { try { child.kill("SIGINT"); } catch { /* already gone */ } }, 1500);
    },
  };
}

async function main() {
  if (!fs.existsSync(chromePath)) throw new Error("Google Chrome is not installed");
  if (!fs.existsSync(audioPath)) throw new Error("Missing " + audioPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "rudolph-video-"));
  const captured = path.join(work, "screen.mp4");
  console.log("Opening", bookUrl);
  const launched = launchChrome(bookUrl);
  let session;
  let capture;
  try {
    const browserWs = await launched.ready;
    const pageWs = await pageSocket(browserWs);
    session = connectSocket(pageWs);
    await session.opened;
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Page.bringToFront");
    const readyDeadline = Date.now() + 45000;
    let spot = null;
    while (Date.now() < readyDeadline) {
      spot = await evaluate(session, `(() => {
        const frame = document.querySelector("iframe");
        const doc = frame && frame.contentDocument;
        const book = doc && doc.getElementById("book");
        if (!book || !book.classList.contains("ready")) return null;
        const fr = frame.getBoundingClientRect();
        const br = book.getBoundingClientRect();
        if (br.width < 200) return null;
        return { x: fr.left + br.left + br.width * 0.75, y: fr.top + br.top + br.height / 2 };
      })()`);
      if (spot) break;
      await sleep(300);
    }
    if (!spot) throw new Error("The Rudolph book did not open");
    await evaluate(session, `(() => {
      const css = ".flipbook-close,.arrow,.rudolph-sound,.rudolph-read-again,.fullscreen-toggle,.reader-close{display:none!important}.leaf .face{will-change:transform,opacity}";
      function add(doc) {
        if (!doc || doc.getElementById("rudolph-video-dress")) return;
        const style = doc.createElement("style");
        style.id = "rudolph-video-dress";
        style.textContent = css;
        (doc.head || doc.documentElement).appendChild(style);
      }
      add(document);
      const frame = document.querySelector("iframe");
      const doc = frame && frame.contentDocument;
      const win = frame && frame.contentWindow;
      add(doc);
      if (win && !win.__rudolphSmoothTurn) {
        win.__rudolphSmoothTurn = true;
        const original = win.Element.prototype.animate;
        const smooth = "cubic-bezier(0.05, 0.42, 0.95, 0.58)";
        let turns = 0;
        let lastTurnAt = 0;
        const fadeSnow = () => {
          const snow = doc.getElementById("rudolph-snow");
          if (!snow || snow.dataset.fading === "1") return;
          snow.dataset.fading = "1";
          snow.style.transition = "opacity 1.6s ease";
          snow.style.opacity = "0";
          win.setTimeout(() => {
            const ctx = snow.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, snow.width, snow.height);
              const stop = () => {};
              ctx.clearRect = stop;
              ctx.beginPath = stop;
              ctx.arc = stop;
              ctx.fill = stop;
              ctx.setTransform = stop;
            }
            snow.style.display = "none";
          }, 1700);
        };
        const noteTurn = (next) => {
          if (!next || typeof next.duration !== "number" || next.duration < 600) return;
          const now = Date.now();
          if (now - lastTurnAt < 500) return;
          lastTurnAt = now;
          turns += 1;
          if (turns === 2) win.setTimeout(fadeSnow, next.duration + 80);
        };
        win.Element.prototype.animate = function (frames, options) {
          const next = options && typeof options === "object" ? Object.assign({}, options) : options;
          if (next && typeof next.duration === "number" && next.duration >= 600 && next.duration <= 1600) {
            // rotateY looks fastest when the page is edge-on. This curve
            // lingers through that middle so the curl does not jump.
            next.duration = 1300;
            next.easing = smooth;
          }
          noteTurn(next);
          return original.call(this, frames, next);
        };
      }
      if (!doc || !win || win.__rudolphInset) return true;
      win.__rudolphInset = function () {
        const book = doc.getElementById("book");
        const stage = doc.getElementById("stage");
        if (!book || !stage) return;
        const margin = 20;
        const bw = book.offsetWidth;
        const bh = book.offsetHeight;
        const sw = stage.clientWidth;
        const sh = stage.clientHeight;
        if (!bw || !bh || !sw || !sh) return;
        const scale = Math.min((sw - margin * 2) / bw, (sh - margin * 2) / bh);
        if (!(scale > 0) || scale >= 0.995) return;
        const width = bw * scale;
        const height = bh * scale;
        book.style.width = width + "px";
        book.style.height = height + "px";
        book.style.left = ((sw - width) / 2) + "px";
        book.style.top = ((sh - height) / 2) + "px";
      };
      win.__rudolphInset();
      return true;
    })()`);
    await sleep(500);
    spot = await evaluate(session, `(() => {
      const frame = document.querySelector("iframe");
      const doc = frame && frame.contentDocument;
      const book = doc && doc.getElementById("book");
      if (!book) return null;
      const fr = frame.getBoundingClientRect();
      const br = book.getBoundingClientRect();
      return { x: fr.left + br.left + br.width * 0.75, y: fr.top + br.top + br.height / 2 };
    })()`);
    if (!spot) throw new Error("The Rudolph book disappeared");
    await sleep(400);
    const recordSeconds = holdSeconds + (secondsLimit || RUDOLPH_SONG_DURATION + 20) + 12;
    console.log("Recording only the Rudolph window for", Math.round(recordSeconds) + "s");
    capture = startWindowRecording(launched.chrome.pid, recordSeconds, captured);
    const captureStart = Date.now();
    await sleep(holdSeconds * 1000);
    await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x: spot.x, y: spot.y, button: "left", clickCount: 1 });
    await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: spot.x, y: spot.y, button: "left", clickCount: 1 });
    await evaluate(session, `(() => {
      const frame = document.querySelector("iframe");
      const doc = frame && frame.contentDocument;
      const stage = doc && doc.getElementById("stage");
      if (!stage) return "no-stage";
      const r = stage.getBoundingClientRect();
      const x = r.left + r.width * 0.82;
      const y = r.top + r.height * 0.55;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
      stage.dispatchEvent(new PointerEvent("pointerdown", opts));
      stage.dispatchEvent(new PointerEvent("pointerup", opts));
      const arrow = doc.getElementById("arrR");
      if (arrow) arrow.click();
      frame.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      return "tapped";
    })()`);
    console.log("Turned the cover");
    const songState = `(() => {
      const frame = document.querySelector("iframe");
      const doc = frame && frame.contentDocument;
      const btn = doc && doc.getElementById("soundBtn");
      const audio = doc && doc.querySelector("audio");
      const imgs = doc ? Array.from(doc.querySelectorAll("#book img")).map((img) => (img.currentSrc || img.src || "").split("/").pop()) : [];
      return { label: btn ? btn.textContent : "", pressed: btn ? btn.getAttribute("aria-pressed") : "", t: audio ? audio.currentTime : -1, paused: audio ? audio.paused : true, imgs: imgs.slice(0, 4) };
    })()`;
    let musicAt = 0;
    const musicDeadline = Date.now() + 15000;
    let lastState = null;
    while (Date.now() < musicDeadline) {
      lastState = await evaluate(session, songState);
      const playing = lastState && (lastState.label === "Pause" || lastState.pressed === "true" || (lastState.t > 0.05 && !lastState.paused));
      if (playing) {
        musicAt = Date.now();
        break;
      }
      await sleep(200);
    }
    if (!musicAt) {
      const state = await evaluate(session, `(() => {
        const doc = document.querySelector("iframe") && document.querySelector("iframe").contentDocument;
        if (!doc) return { frame: false };
        const audio = doc.querySelector("audio");
        return {
          frame: true,
          imgs: Array.from(doc.querySelectorAll("#slotL img, #slotR img")).map((img) => img.getAttribute("src")),
          button: doc.getElementById("soundBtn") && doc.getElementById("soundBtn").textContent,
          hasMusic: doc.documentElement.innerHTML.includes("Start Music"),
          arrow: doc.getElementById("arrR") && doc.getElementById("arrR").className,
          audio: audio ? { paused: audio.paused, t: audio.currentTime } : null,
        };
      })()`);
      throw new Error("The book did not start the music " + JSON.stringify(state));
    }
    const lead = (musicAt - captureStart) / 1000;
    console.log("Music started", lead.toFixed(2), "s into the recording");
    const recordFor = (secondsLimit || RUDOLPH_SONG_DURATION + 20) * 1000;
    const remain = Math.max(0, recordFor - (Date.now() - musicAt));
    await sleep(remain);
    await capture.closed;
    console.log("Encoding", outPath);
    await runFfmpeg([
      "-y",
      "-i", captured,
      "-itsoffset", lead.toFixed(3),
      "-i", audioPath,
      "-filter_complex", "[0:v]scale=" + WIDTH + ":" + HEIGHT + ":flags=lanczos,crop=" + WIDTH + ":" + (HEIGHT - 74) + ":0:74,format=yuv420p,fps=60[v];[1:a]apad=pad_dur=8[a]",
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-preset", preset,
      "-crf", "16",
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level:v", "5.2",
      "-r", "60",
      "-fps_mode", "cfr",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-c:a", "aac",
      "-b:a", "384k",
      "-ar", "48000",
      "-ac", "2",
      "-movflags", "+faststart",
      "-shortest",
      outPath,
    ]);
    console.log("Wrote", outPath);
  } finally {
    try { if (capture) capture.child.kill("SIGTERM"); } catch { /* already stopped */ }
    try { if (session) session.close(); } catch { /* already closed */ }
    try { launched.chrome.kill("SIGTERM"); } catch { /* already gone */ }
    await sleep(400);
    fs.rmSync(launched.userDir, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 5 });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
