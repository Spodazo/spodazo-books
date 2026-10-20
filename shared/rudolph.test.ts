import assert from "node:assert/strict";
import test from "node:test";
import { rudolphLegacyRedirect } from "./rudolph";

test("old Rudolph URLs redirect to /Rudolph", () => {
  assert.equal(rudolphLegacyRedirect("/Rudolph-The-Red-Nosed-Reindeer"), "/Rudolph");
  assert.equal(rudolphLegacyRedirect("/rudolph-the-red-nosed-reindeer/"), "/Rudolph");
  assert.equal(
    rudolphLegacyRedirect("/admin/edit/Rudolph-The-Red-Nosed-Reindeer"),
    "/admin/edit/Rudolph",
  );
  assert.equal(rudolphLegacyRedirect("/Rudolph"), null);
});
