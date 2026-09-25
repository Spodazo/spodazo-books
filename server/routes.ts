import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { slugify, uniqueSlug } from "../shared/seed-data";
import { normalizeLayout } from "../shared/page-layout";
import type { BookPage, PageLayout, PlayerSetup } from "../shared/types";
import { loginAdmin, logoutAdmin, requireAdmin } from "./auth";
import { curatorPasswordMatches, curatorRecoveryError, hashPassword, MIN_PASSWORD_LENGTH } from "./password";
import { currentIconStamp } from "./htmlIcons";
import {
  assetVersion,
  convertUploadedImage,
  decodeMediaFilename,
  FAVICON_PUBLIC_FILES,
  faviconPublicPath,
  imageUrl,
  localImagePath,
  localPdfPath,
  parseImageWidth,
  pdfUrl,
  prepareFaviconSet,
  preparedImagePath,
  shouldConvertImageUpload,
  warmHomeCardImages,
} from "./media";
import { imagesDir, pdfsDir, uniqueFileName } from "./paths";
import { getStore } from "./storage";
import {
  generateAiImage,
  generateAiOutline,
  openaiConfigured,
  parseImageRequest,
  parseOutlineRequest,
} from "./ai-book";

function isPdfUpload(file: { fieldname: string; mimetype: string; originalname: string }): boolean {
  return file.fieldname === "pdf" || file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
}

const disk = multer.diskStorage({
  destination: (_req, file, cb) => {
    const dir = isPdfUpload(file) ? pdfsDir() : imagesDir();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const dir = isPdfUpload(file) ? pdfsDir() : imagesDir();
    cb(null, uniqueFileName(dir, file.originalname));
  },
});

const upload = multer({
  storage: {
    _handleFile(req, file, cb) {
      disk._handleFile(req, file, (err, info) => {
        if (err) {
          cb(err);
          return;
        }
        if (info?.filename && shouldConvertImageUpload(file)) {
          convertUploadedImage(info.filename)
            .then((filename) => cb(null, { ...info, filename }))
            .catch(cb);
          return;
        }
        cb(null, info);
      });
    },
    _removeFile(req, file, cb) {
      disk._removeFile(req, file, cb);
    },
  },
  limits: { fileSize: 80 * 1024 * 1024 },
});

function filenameFromUrl(value: string): string {
  try {
    const url = new URL(value, "http://localhost");
    return decodeMediaFilename(url.pathname);
  } catch {
    return decodeMediaFilename(value);
  }
}

function pagesFromBody(raw: unknown): BookPage[] | undefined {
  if (raw === undefined) return undefined;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function bookUploadFields(req: Request, res: Response, next: NextFunction) {
  const type = String(req.headers["content-type"] || "");
  if (type.includes("multipart/form-data")) {
    return upload.fields([{ name: "cover", maxCount: 1 }, { name: "pdf", maxCount: 1 }])(req, res, next);
  }
  return next();
}

export function registerRoutes(app: Express): void {
  app.get("/api/version", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      Pragma: "no-cache",
    });
    res.json({
      app: "spodazo-books",
      ok: true,
      build: assetVersion(),
      booksDataDir: process.env.BOOKS_DATA_DIR || ".books-data",
      database: process.env.DATABASE_URL ? "postgres" : "json",
    });
  });

  app.get("/api/player-setup", async (_req, res) => {
    const store = await getStore();
    res.set("Cache-Control", "no-store");
    res.json(await store.getPlayerSetup());
  });

  app.patch(
    "/api/admin/player-setup",
    requireAdmin,
    upload.fields([
      { name: "cover", maxCount: 1 },
      { name: "logo", maxCount: 1 },
      { name: "favicon", maxCount: 1 },
      { name: "footer", maxCount: 1 },
    ]),
    async (req, res) => {
      const store = await getStore();
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const body = req.body || {};
      const fields: Partial<PlayerSetup> = {};
      if (body.appName !== undefined) fields.appName = String(body.appName);
      if (body.theme !== undefined) fields.theme = String(body.theme);
      if (body.credits !== undefined) fields.credits = String(body.credits);
      if (body.copyright !== undefined) fields.copyright = String(body.copyright);
      if (body.collectionColor !== undefined) fields.collectionColor = String(body.collectionColor);
      if (files?.cover?.[0]) fields.collectionCover = files.cover[0].filename;
      else if (body.clearCover === "1" || body.clearCover === "true") fields.collectionCover = "";
      if (files?.logo?.[0]) fields.logo = files.logo[0].filename;
      if (files?.footer?.[0]) fields.footerImage = files.footer[0].filename;
      if (files?.favicon?.[0]) {
        fields.favicon = files.favicon[0].filename;
        try {
          await prepareFaviconSet(files.favicon[0].filename);
        } catch (err) {
          res.status(400).json({ error: err instanceof Error ? err.message : "Could not make a favicon from that image" });
          return;
        }
      }
      res.json(await store.updatePlayerSetup(fields));
    },
  );

  const faviconNoStore = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
  } as const;

  function sendGeneratedFavicon(name: string, res: Response, next: NextFunction) {
    const full = faviconPublicPath(name);
    if (!full) {
      next();
      return;
    }
    res.sendFile(path.resolve(full), { headers: faviconNoStore });
  }

  async function sendGeneratedManifest(res: Response, next: NextFunction) {
    const store = await getStore();
    const setup = await store.getPlayerSetup();
    if (!setup.favicon || !faviconPublicPath("android-chrome-192x192.png")) {
      next();
      return;
    }
    const stamp = currentIconStamp(setup.favicon);
    res.set({
      "Content-Type": "application/manifest+json",
      ...faviconNoStore,
    });
    res.json({
      name: setup.appName,
      short_name: setup.appName,
      description: setup.theme || setup.appName,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#F0DFB3",
      theme_color: "#7A4FD0",
      icons: [
        { src: `/icon-${stamp}.png`, sizes: "32x32", type: "image/png", purpose: "any" },
        { src: `/site-icons/${stamp}/android-chrome-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `/site-icons/${stamp}/android-chrome-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    });
  }

  app.get("/icon-:stamp.png", (_req, res, next) => sendGeneratedFavicon("favicon-32x32.png", res, next));
  app.get("/touch-:stamp.png", (_req, res, next) => sendGeneratedFavicon("apple-touch-icon.png", res, next));

  for (const name of FAVICON_PUBLIC_FILES) {
    app.get(`/${name}`, async (_req, res, next) => {
      if (name === "favicon.ico") {
        const store = await getStore();
        const setup = await store.getPlayerSetup();
        if (setup.favicon && faviconPublicPath("favicon-32x32.png")) {
          res.set(faviconNoStore);
          res.redirect(302, `/icon-${currentIconStamp(setup.favicon)}.png`);
          return;
        }
      }
      sendGeneratedFavicon(name, res, next);
    });
  }

  app.get("/site.webmanifest", async (_req, res, next) => {
    await sendGeneratedManifest(res, next);
  });

  app.get("/site-icons/:stamp/:file", async (req, res, next) => {
    const file = path.basename(req.params.file || "");
    if (file === "site.webmanifest") {
      await sendGeneratedManifest(res, next);
      return;
    }
    sendGeneratedFavicon(file, res, next);
  });

  app.get("/api/books", async (req, res) => {
    const store = await getStore();
    const list = await store.listBooks();
    res.json(req.session?.admin ? list : list.filter((book) => !book.hidden && book.published));
    void warmHomeCardImages(list);
  });

  app.get("/api/books/:slug", async (req, res) => {
    const store = await getStore();
    const book = await store.getBookBySlug(req.params.slug);
    if (!book || ((!book.published || book.hidden) && !req.session?.admin)) {
      res.status(404).json({ error: "Book not found" });
      return;
    }
    res.json(book);
  });

  app.get("/api/admin/me", (req, res) => {
    res.json({ admin: Boolean(req.session?.admin) });
  });

  app.post("/api/admin/login", async (req, res) => {
    const password = String(req.body?.password || "");
    const store = await getStore();
    const record = await store.getCuratorRecord();
    if (!record.passwordHash && !process.env.ADMIN_PASSWORD) {
      res.status(500).json({ error: "ADMIN_PASSWORD is not set" });
      return;
    }
    try {
      if (!(await loginAdmin(req, password))) {
        res.status(401).json({ error: "Wrong password" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin] login session error:", err);
      res.status(500).json({ error: "Could not start admin session" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    await logoutAdmin(req);
    res.json({ ok: true });
  });

  app.get("/api/admin/curator", requireAdmin, async (_req, res) => {
    const store = await getStore();
    res.set("Cache-Control", "no-store");
    res.json(await store.getCurator());
  });

  app.post("/api/admin/curator/verify", requireAdmin, async (req, res) => {
    const password = String(req.body?.password || "");
    const store = await getStore();
    const record = await store.getCuratorRecord();
    if (!(await curatorPasswordMatches(password, record.passwordHash))) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    res.json({ ok: true });
  });

  app.patch("/api/admin/curator", requireAdmin, async (req, res) => {
    const body = req.body || {};
    const currentPassword = String(body.currentPassword || "");
    const store = await getStore();
    const record = await store.getCuratorRecord();
    if (!(await curatorPasswordMatches(currentPassword, record.passwordHash))) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    const firstName = String(body.firstName ?? record.firstName);
    const lastName = String(body.lastName ?? record.lastName);
    const email = String(body.email ?? record.email).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid email" });
      return;
    }
    const nextPassword = String(body.password || "");
    if (nextPassword && nextPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    const fields: Partial<typeof record> = { firstName, lastName, email };
    if (nextPassword) fields.passwordHash = await hashPassword(nextPassword);
    res.json(await store.updateCurator(fields));
  });

  app.post("/api/admin/curator/recover", async (req, res) => {
    const body = req.body || {};
    const store = await getStore();
    const record = await store.getCuratorRecord();
    const isAdmin = Boolean(req.session?.admin);
    const password = String(body.password || "");
    const error = curatorRecoveryError({
      isAdmin,
      email: String(body.email || ""),
      recoveryPassword: String(body.recoveryPassword || ""),
      newPassword: password,
      curatorEmail: record.email,
    });
    if (error) {
      res.status(error.status).json({ error: error.error });
      return;
    }
    await store.updateCurator({ passwordHash: await hashPassword(password) });
    if (!isAdmin) {
      try {
        if (!(await loginAdmin(req, password))) {
          res.status(500).json({ error: "Password reset, but sign-in failed" });
          return;
        }
      } catch (err) {
        console.error("[admin] recover session error:", err);
        res.status(500).json({ error: "Password reset, but sign-in failed" });
        return;
      }
    }
    res.json({ ok: true });
  });

  app.post("/api/admin/ai-books/outline", requireAdmin, async (req, res) => {
    if (!openaiConfigured()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }
    try {
      const input = parseOutlineRequest(req.body);
      res.json(await generateAiOutline(input));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not write the story";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/admin/ai-books/image", requireAdmin, async (req, res) => {
    if (!openaiConfigured()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }
    try {
      const input = parseImageRequest(req.body);
      const generated = await generateAiImage(input);
      res.json({ filename: generated.filename, url: imageUrl(generated.filename) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not draw that picture" });
    }
  });

  app.post("/api/admin/book-assets", requireAdmin, upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Choose a file" });
      return;
    }
    const isPdf = file.fieldname === "pdf" || file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    const url = isPdf ? pdfUrl(file.filename) : imageUrl(file.filename);
    res.json({ url, filename: file.filename });
  });

  app.post("/api/admin/books", requireAdmin, upload.fields([{ name: "cover", maxCount: 1 }, { name: "pdf", maxCount: 1 }]), async (req, res) => {
    try {
      const store = await getStore();
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const body = req.body || {};
      const title = String(body.title || "").trim();
      if (!title) {
        res.status(400).json({ error: "Title is required" });
        return;
      }
      const used = new Set((await store.listBooks()).map((book) => book.slug));
      const requested = String(body.slug || "").trim();
      const slug = requested && !used.has(requested) ? requested : uniqueSlug(requested || title, used);
      const pages = pagesFromBody(body.pages) || [];
      const book = await store.createBook({
        title,
        slug,
        tagline: String(body.tagline || ""),
        author: String(body.author || ""),
        date: String(body.date || ""),
        cover: files?.cover?.[0]?.filename || filenameFromUrl(body.coverUrl || "") || pages[0]?.imageAsset,
        pdf: files?.pdf?.[0]?.filename || filenameFromUrl(body.pdfUrl || ""),
        pages,
        color: String(body.color || ""),
        hidden: body.hidden === true || body.hidden === "true",
        published: body.published !== "false" && body.published !== false,
        audience: String(body.audience || ""),
        pageTemplate: String(body.pageTemplate || ""),
        characterRender: String(body.characterRender || ""),
        pageBackground: String(body.pageBackground || ""),
        pageTexture: String(body.pageTexture || ""),
        spreadBackground: String(body.spreadBackground || ""),
        textFont: String(body.textFont || ""),
        textColor: String(body.textColor || ""),
        titleLayout: body.titleLayout,
        coverLayout: body.coverLayout,
        backCoverLayout: body.backCoverLayout,
        endLayout: body.endLayout,
      });
      res.json(book);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not save book" });
    }
  });

  app.patch("/api/admin/books/:id", requireAdmin, bookUploadFields, async (req, res) => {
    try {
      const store = await getStore();
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const body = req.body || {};
      const current = await store.getBookById(req.params.id);
      if (!current) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      const used = new Set((await store.listBooks()).filter((book) => book.id !== current.id).map((book) => book.slug));
      const pages = pagesFromBody(body.pages);
      const updated = await store.updateBook(current.id, {
        title: body.title !== undefined ? String(body.title) : undefined,
        slug: body.slug !== undefined
          ? uniqueSlug(String(body.slug || current.slug), used)
          : undefined,
        tagline: body.tagline !== undefined ? String(body.tagline) : undefined,
        author: body.author !== undefined ? String(body.author) : undefined,
        date: body.date !== undefined ? String(body.date) : undefined,
        cover: files?.cover?.[0]?.filename || (body.coverUrl ? filenameFromUrl(body.coverUrl) : undefined),
        pdf: files?.pdf?.[0]?.filename || (body.pdfUrl ? filenameFromUrl(body.pdfUrl) : undefined),
        pages,
        color: body.color !== undefined ? String(body.color) : undefined,
        hidden: body.hidden !== undefined ? body.hidden === true || body.hidden === "true" : undefined,
        published: body.published !== undefined ? body.published !== "false" && body.published !== false : undefined,
        audience: body.audience !== undefined ? String(body.audience) : undefined,
        pageTemplate: body.pageTemplate !== undefined ? String(body.pageTemplate) : undefined,
        characterRender: body.characterRender !== undefined ? String(body.characterRender) : undefined,
        pageBackground: body.pageBackground !== undefined ? String(body.pageBackground) : undefined,
        pageTexture: body.pageTexture !== undefined ? String(body.pageTexture) : undefined,
        spreadBackground: body.spreadBackground !== undefined ? String(body.spreadBackground) : undefined,
        textFont: body.textFont !== undefined ? String(body.textFont) : undefined,
        textColor: body.textColor !== undefined ? String(body.textColor) : undefined,
        titleLayout: body.titleLayout !== undefined ? body.titleLayout : undefined,
        coverLayout: body.coverLayout !== undefined ? body.coverLayout : undefined,
        backCoverLayout: body.backCoverLayout !== undefined ? body.backCoverLayout : undefined,
        endLayout: body.endLayout !== undefined ? body.endLayout : undefined,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not save book" });
    }
  });

  app.delete("/api/admin/books/:id", requireAdmin, async (req, res) => {
    const store = await getStore();
    if (!(await store.deleteBook(req.params.id))) {
      res.status(404).json({ error: "Book not found" });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/api/admin/reorder-books", requireAdmin, async (req, res) => {
    const ids = Array.isArray(req.body?.bookIds) ? req.body.bookIds.map(String) : [];
    const store = await getStore();
    res.json(await store.reorderBooks(ids));
  });

  app.get("/media/images/:file", async (req, res) => {
    const full = localImagePath(req.params.file);
    if (!full) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const width = parseImageWidth(req.query.w);
    try {
      const file = await preparedImagePath(full, width);
      res.sendFile(path.resolve(file), {
        headers: { "Cache-Control": "public, max-age=86400" },
      });
    } catch {
      res.sendFile(path.resolve(full));
    }
  });

  app.get("/media/pdfs/:file", (req, res) => {
    const full = localPdfPath(req.params.file);
    if (!full) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.sendFile(path.resolve(full), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(full)}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  });
}
