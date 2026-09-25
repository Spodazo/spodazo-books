import assert from "node:assert/strict";
import test from "node:test";
import { appRevisionKey, buildReloadUrl, shouldApplyUpdate, stripBuildParam } from "./appUpdate";

test("appRevisionKey combines deploy build and library timestamp", () => {
  assert.equal(appRevisionKey({ build: "abc", libraryAt: "2026-09-25T00:00:00.000Z" }), "abc|2026-09-25T00:00:00.000Z");
});

test("shouldApplyUpdate detects revision changes", () => {
  assert.equal(shouldApplyUpdate("a|1", "a|2"), true);
  assert.equal(shouldApplyUpdate("a|1", "a|1"), false);
  assert.equal(shouldApplyUpdate("", "a|1"), false);
});

test("buildReloadUrl adds cache-bust query param", () => {
  const url = buildReloadUrl("/Willow?x=1#read", "deploy-1234567890");
  assert.match(url, /_spodazo=deploy-123456789/);
  assert.match(url, /#read$/);
});

test("stripBuildParam removes cache-bust query param", () => {
  assert.equal(stripBuildParam("/book?_spodazo=abc&x=1"), "/book?x=1");
});
