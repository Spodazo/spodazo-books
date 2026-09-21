import assert from "node:assert/strict";
import test from "node:test";
import { frameClass, frameMarkup, normalizeFrame } from "./text-frames";

test("normalizeFrame keeps a known frame and drops unknown ones", () => {
  assert.equal(normalizeFrame("wave"), "wave");
  assert.equal(normalizeFrame("double"), "double");
  assert.equal(normalizeFrame("nope"), "");
  assert.equal(normalizeFrame(""), "");
});

test("frameClass and markup cover decorative frames", () => {
  assert.equal(frameClass("beads"), "framed framed-beads");
  assert.equal(frameClass(""), "");
  assert.match(frameMarkup("wave"), /text-frame-wave/);
  assert.match(frameMarkup("ribbon"), /text-frame-ribbon/);
  assert.equal(frameMarkup("thin"), "");
});
