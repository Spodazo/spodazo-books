import assert from "node:assert/strict";
import test from "node:test";
import { audienceLabel, normalizeAudience } from "./audience";

test("normalizeAudience keeps presets and slugifies custom labels", () => {
  assert.equal(normalizeAudience(undefined), "children");
  assert.equal(normalizeAudience("adults"), "adults");
  assert.equal(normalizeAudience(" Family Reading "), "family-reading");
});

test("audienceLabel prettifies custom audiences", () => {
  assert.equal(audienceLabel("children"), "Children");
  assert.equal(audienceLabel("family-reading"), "Family Reading");
});
