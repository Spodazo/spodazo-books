import assert from "node:assert/strict";
import test from "node:test";
import { RUDOLPH_V3_SHA256, shouldApplyBundledRudolph } from "./rudolph-current-pdf";

test("the bundled Rudolph v3 replaces an older saved PDF once", () => {
  assert.equal(shouldApplyBundledRudolph("older-hash", false), true);
  assert.equal(shouldApplyBundledRudolph(null, false), true);
  assert.equal(shouldApplyBundledRudolph(RUDOLPH_V3_SHA256, false), false);
  assert.equal(shouldApplyBundledRudolph("a-later-upload", true), false);
});
