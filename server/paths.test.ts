import assert from "node:assert/strict";
import test from "node:test";
import { safeFileName } from "./paths";

test("safeFileName strips path parts", () => {
  assert.equal(safeFileName("../../art-001.jpg"), "art-001.jpg");
});
