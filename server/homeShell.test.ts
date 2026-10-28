import assert from "node:assert/strict";
import test from "node:test";
import { htmlWithHomeBootstrap, htmlWithPalette } from "./homeShell";
import { imageCacheControl } from "./media";
import type { BookListItem, PlayerSetup } from "../shared/types";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="theme-color" content="#F0DFB3" />
  </head>
  <body></body>
</html>`;

test("the first HTML paint uses the saved palette instead of honey", () => {
  const next = htmlWithPalette(html, "navy");
  assert.match(next, /<html lang="en" data-palette="navy">/);
  assert.match(next, /theme-color" content="#12213D"/);
  assert.match(next, /id="palette-boot"/);
  assert.match(next, /background:#12213D/);
  assert.doesNotMatch(next, /#F0DFB3|#f0dfb3|#efdda6/);
});

test("shelf pictures are preloaded with the book list", () => {
  const setup = {
    appName: "Spodazo Books",
    theme: "",
    credits: "",
    copyright: "",
    collectionCover: "",
    collectionCoverUrl: "",
    logo: "logo.webp",
    logoUrl: "/media/images/logo.webp?v=1&w=720",
    favicon: "",
    faviconUrl: "",
    footerImage: "",
    footerImageUrl: "",
    collectionColor: "navy",
  } satisfies PlayerSetup;
  const books = [{
    id: "1",
    slug: "willows-big-forest-adventure",
    title: "Willow",
    tagline: "",
    author: "",
    date: "",
    cover: "willow.webp",
    coverUrl: "/media/images/willow.webp?v=1&w=720",
    pdfUrl: "/willow.pdf",
    coverWidth: 720,
    coverHeight: 1000,
    color: "navy",
    sortOrder: 1,
    hidden: false,
    published: true,
    audience: "children",
    pageCount: 1,
    pageBackground: "#fefcdd",
    pageTexture: "",
    spreadBackground: "",
    textFont: "",
    textColor: "",
    coverLayout: { elements: [] },
  } satisfies BookListItem];
  const next = htmlWithHomeBootstrap(html, { setup, books });
  assert.match(next, /rel="preload" as="image" href="\/media\/images\/willow-front-cover\.webp\?w=720"/);
  assert.match(next, /href="\/media\/images\/logo\.webp\?v=1&amp;w=720"/);
  assert.match(next, /id="home-bootstrap"/);
  assert.match(next, /"coverWidth":720/);
});

test("versioned cover files stay cached and plain ones refresh within a day", () => {
  assert.match(imageCacheControl("abc"), /immutable/);
  assert.doesNotMatch(imageCacheControl(undefined), /no-store|immutable/);
  assert.match(imageCacheControl(undefined), /max-age=86400/);
});
