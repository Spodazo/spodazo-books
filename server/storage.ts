import fs from "fs";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { books, curator, playerSetup } from "../shared/schema";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SPREAD_BACKGROUND,
  layoutToJson,
  normalizeColor,
  normalizeLayout,
  parseLayoutJson,
} from "../shared/page-layout";
import { normalizePaperTexture } from "../shared/paper";
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT, normalizeFont } from "../shared/book-fonts";
import {
  DEFAULT_CURATOR,
  DEFAULT_PLAYER_SETUP,
  normalizeAudience,
  normalizeBookPage,
  normalizeCharacterRender,
  normalizeCurator,
  normalizePageTemplate,
  normalizePlayerSetup,
  pagesToJson,
  parsePagesJson,
  publicCurator,
} from "../shared/seed-data";
import { normalizePaletteId } from "../shared/palettes";
import type { Book, BookListItem, BookPage, Curator, CuratorRecord, PlayerSetup, PublicBook } from "../shared/types";
import { COLLECTION_COVER_WIDTH, HOME_CARD_WIDTH, imageUrl, pdfUrl } from "./media";
import { catalogPath, ensureDataDirs } from "./paths";

export type BookInput = {
  id?: string;
  slug: string;
  title: string;
  tagline?: string;
  author?: string;
  date?: string;
  cover?: string;
  pdf?: string;
  pages?: BookPage[];
  color?: string;
  sortOrder?: number;
  hidden?: boolean;
  published?: boolean;
  audience?: string;
  pageTemplate?: string;
  characterRender?: string;
  pageBackground?: string;
  pageTexture?: string;
  spreadBackground?: string;
  textFont?: string;
  textColor?: string;
  titleLayout?: Book["titleLayout"];
  coverLayout?: Book["coverLayout"];
  backCoverLayout?: Book["backCoverLayout"];
  endLayout?: Book["endLayout"];
};

export interface BookStore {
  listBooks(): Promise<BookListItem[]>;
  getBookBySlug(slug: string): Promise<PublicBook | null>;
  getBookById(id: string): Promise<PublicBook | null>;
  createBook(input: BookInput): Promise<PublicBook>;
  updateBook(id: string, input: Partial<BookInput>): Promise<PublicBook | null>;
  deleteBook(id: string): Promise<boolean>;
  reorderBooks(bookIds: string[]): Promise<BookListItem[]>;
  getPlayerSetup(): Promise<PlayerSetup>;
  updatePlayerSetup(input: Partial<PlayerSetup>): Promise<PlayerSetup>;
  getCurator(): Promise<Curator>;
  getCuratorRecord(): Promise<CuratorRecord>;
  updateCurator(input: Partial<CuratorRecord>): Promise<Curator>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hydrateElements(elements: BookPage["elements"]): BookPage["elements"] {
  return elements.map((item) => ({
    ...item,
    imageUrl: item.imageAsset ? imageUrl(item.imageAsset) : item.imageUrl || "",
  }));
}

function hydratePages(pages: BookPage[]): BookPage[] {
  return pages.map((page) => ({
    ...page,
    imageUrl: imageUrl(page.imageAsset),
    fullPageUrl: imageUrl(page.fullPageAsset || page.imageAsset),
    elements: hydrateElements(page.elements || []),
  }));
}

function hydrateBook(book: Book): PublicBook {
  const pages = hydratePages(book.pages);
  return {
    ...book,
    color: normalizePaletteId(book.color),
    pages,
    coverUrl: imageUrl(book.cover || pages[0]?.imageAsset || pages[0]?.fullPageAsset, HOME_CARD_WIDTH),
    pdfUrl: pdfUrl(book.pdf),
    pageCount: pages.length,
    titleLayout: { ...book.titleLayout, elements: hydrateElements(book.titleLayout.elements) },
    coverLayout: { ...book.coverLayout, elements: hydrateElements(book.coverLayout?.elements || []) },
    backCoverLayout: { ...book.backCoverLayout, elements: hydrateElements(book.backCoverLayout?.elements || []) },
    endLayout: { ...book.endLayout, elements: hydrateElements(book.endLayout.elements) },
  };
}

function toListItem(book: Book): BookListItem {
  const publicBook = hydrateBook(book);
  return {
    id: publicBook.id,
    slug: publicBook.slug,
    title: publicBook.title,
    tagline: publicBook.tagline,
    author: publicBook.author,
    date: publicBook.date,
    cover: publicBook.cover,
    coverUrl: publicBook.coverUrl,
    pdfUrl: publicBook.pdfUrl,
    color: publicBook.color,
    sortOrder: publicBook.sortOrder,
    hidden: publicBook.hidden,
    published: publicBook.published,
    audience: publicBook.audience,
    pageCount: publicBook.pageCount,
    pageBackground: publicBook.pageBackground,
    pageTexture: publicBook.pageTexture,
    spreadBackground: publicBook.spreadBackground,
    textFont: publicBook.textFont,
    textColor: publicBook.textColor,
    coverLayout: publicBook.coverLayout,
  };
}

function hydratePlayerSetup(raw?: Partial<PlayerSetup> | null): PlayerSetup {
  const setup = normalizePlayerSetup(raw);
  return {
    ...setup,
    collectionCoverUrl: imageUrl(setup.collectionCover, COLLECTION_COVER_WIDTH),
    logoUrl: imageUrl(setup.logo, HOME_CARD_WIDTH),
    faviconUrl: imageUrl(setup.favicon),
    footerImageUrl: imageUrl(setup.footerImage),
  };
}

function playerSetupRecord(setup: PlayerSetup) {
  return {
    appName: setup.appName,
    theme: setup.theme,
    credits: setup.credits,
    copyright: setup.copyright,
    collectionCover: setup.collectionCover,
    logo: setup.logo,
    favicon: setup.favicon,
    footerImage: setup.footerImage,
    collectionColor: setup.collectionColor,
  };
}

type CatalogFile = { books: Book[]; player?: PlayerSetup; curator?: CuratorRecord };

function recordBook(row: {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  author?: string | null;
  date?: string | null;
  cover?: string | null;
  pdf?: string | null;
  pagesJson?: string | null;
  pages?: BookPage[];
  color?: string | null;
  sortOrder?: number | null;
  hidden?: boolean | null;
  published?: boolean | null;
  audience?: string | null;
  pageTemplate?: string | null;
  characterRender?: string | null;
  pageBackground?: string | null;
  pageTexture?: string | null;
  spreadBackground?: string | null;
  textFont?: string | null;
  textColor?: string | null;
  titleLayoutJson?: string | null;
  coverLayoutJson?: string | null;
  backCoverLayoutJson?: string | null;
  endLayoutJson?: string | null;
  titleLayout?: Book["titleLayout"] | null;
  coverLayout?: Book["coverLayout"] | null;
  backCoverLayout?: Book["backCoverLayout"] | null;
  endLayout?: Book["endLayout"] | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): Book {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline || "",
    author: row.author || "",
    date: row.date || "",
    cover: row.cover || "",
    pdf: row.pdf || "",
    pages: row.pages || parsePagesJson(row.pagesJson),
    color: row.color || "honey",
    sortOrder: row.sortOrder || 0,
    hidden: Boolean(row.hidden),
    published: row.published !== false,
    audience: normalizeAudience(row.audience),
    pageTemplate: normalizePageTemplate(row.pageTemplate),
    characterRender: normalizeCharacterRender(row.characterRender),
    pageBackground: normalizeColor(row.pageBackground, DEFAULT_PAGE_BACKGROUND),
    pageTexture: normalizePaperTexture(row.pageTexture),
    spreadBackground: normalizeColor(row.spreadBackground, DEFAULT_SPREAD_BACKGROUND),
    textFont: normalizeFont(row.textFont, DEFAULT_TEXT_FONT),
    textColor: normalizeColor(row.textColor, DEFAULT_TEXT_COLOR),
    titleLayout: row.titleLayout || parseLayoutJson(row.titleLayoutJson),
    coverLayout: row.coverLayout || parseLayoutJson(row.coverLayoutJson),
    backCoverLayout: row.backCoverLayout || parseLayoutJson(row.backCoverLayoutJson),
    endLayout: row.endLayout || parseLayoutJson(row.endLayoutJson),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

export class JsonBookStore implements BookStore {
  constructor() {
    ensureDataDirs();
    if (!fs.existsSync(catalogPath())) {
      this.write({
        books: [],
        player: DEFAULT_PLAYER_SETUP,
        curator: DEFAULT_CURATOR,
      });
    }
  }

  private read(): CatalogFile {
    const raw = JSON.parse(fs.readFileSync(catalogPath(), "utf8")) as CatalogFile;
    return {
      books: (raw.books || []).map((book) => recordBook(book)),
      player: raw.player,
      curator: raw.curator,
    };
  }

  private write(catalog: CatalogFile): void {
    ensureDataDirs();
    fs.writeFileSync(catalogPath(), JSON.stringify(catalog, null, 2));
  }

  async listBooks(): Promise<BookListItem[]> {
    return this.read()
      .books.slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map(toListItem);
  }

  async getBookBySlug(slug: string): Promise<PublicBook | null> {
    const wanted = String(slug || "").toLowerCase();
    const book = this.read().books.find((item) => item.slug.toLowerCase() === wanted);
    return book ? hydrateBook(book) : null;
  }

  async getBookById(id: string): Promise<PublicBook | null> {
    const book = this.read().books.find((item) => item.id === id);
    return book ? hydrateBook(book) : null;
  }

  async createBook(input: BookInput): Promise<PublicBook> {
    const catalog = this.read();
    const pages = (input.pages || []).map((page, index) => normalizeBookPage(page, index));
    const book: Book = {
      id: input.id || newId("book"),
      slug: input.slug,
      title: input.title,
      tagline: input.tagline || "",
      author: input.author || "",
      date: input.date || "",
      cover: input.cover || pages[0]?.imageAsset || "",
      pdf: input.pdf || "",
      pages,
      color: normalizePaletteId(input.color),
      sortOrder: input.sortOrder ?? catalog.books.length + 1,
      hidden: Boolean(input.hidden),
      published: input.published !== false,
      audience: normalizeAudience(input.audience),
      pageTemplate: normalizePageTemplate(input.pageTemplate),
      characterRender: normalizeCharacterRender(input.characterRender),
      pageBackground: normalizeColor(input.pageBackground, DEFAULT_PAGE_BACKGROUND),
      pageTexture: normalizePaperTexture(input.pageTexture),
      spreadBackground: normalizeColor(input.spreadBackground, DEFAULT_SPREAD_BACKGROUND),
      textFont: normalizeFont(input.textFont, DEFAULT_TEXT_FONT),
      textColor: normalizeColor(input.textColor, DEFAULT_TEXT_COLOR),
      titleLayout: normalizeLayout(input.titleLayout),
      coverLayout: normalizeLayout(input.coverLayout),
      backCoverLayout: normalizeLayout(input.backCoverLayout),
      endLayout: normalizeLayout(input.endLayout),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    catalog.books.push(book);
    this.write(catalog);
    return hydrateBook(book);
  }

  async updateBook(id: string, input: Partial<BookInput>): Promise<PublicBook | null> {
    const catalog = this.read();
    const book = catalog.books.find((item) => item.id === id);
    if (!book) return null;
    if (input.slug !== undefined) book.slug = input.slug;
    if (input.title !== undefined) book.title = input.title;
    if (input.tagline !== undefined) book.tagline = input.tagline;
    if (input.author !== undefined) book.author = input.author;
    if (input.date !== undefined) book.date = input.date;
    if (input.cover !== undefined) book.cover = input.cover;
    if (input.pdf !== undefined) book.pdf = input.pdf;
    if (input.pages !== undefined) book.pages = input.pages.map((page, index) => normalizeBookPage(page, index));
    if (input.color !== undefined) book.color = normalizePaletteId(input.color);
    if (input.sortOrder !== undefined) book.sortOrder = input.sortOrder;
    if (input.hidden !== undefined) book.hidden = input.hidden;
    if (input.published !== undefined) book.published = input.published;
    if (input.audience !== undefined) book.audience = normalizeAudience(input.audience);
    if (input.pageTemplate !== undefined) book.pageTemplate = normalizePageTemplate(input.pageTemplate);
    if (input.characterRender !== undefined) book.characterRender = normalizeCharacterRender(input.characterRender);
    if (input.pageBackground !== undefined) book.pageBackground = normalizeColor(input.pageBackground, DEFAULT_PAGE_BACKGROUND);
    if (input.pageTexture !== undefined) book.pageTexture = normalizePaperTexture(input.pageTexture);
    if (input.spreadBackground !== undefined) book.spreadBackground = normalizeColor(input.spreadBackground, DEFAULT_SPREAD_BACKGROUND);
    if (input.textFont !== undefined) book.textFont = normalizeFont(input.textFont, DEFAULT_TEXT_FONT);
    if (input.textColor !== undefined) book.textColor = normalizeColor(input.textColor, DEFAULT_TEXT_COLOR);
    if (input.titleLayout !== undefined) book.titleLayout = normalizeLayout(input.titleLayout);
    if (input.coverLayout !== undefined) book.coverLayout = normalizeLayout(input.coverLayout);
    if (input.backCoverLayout !== undefined) book.backCoverLayout = normalizeLayout(input.backCoverLayout);
    if (input.endLayout !== undefined) book.endLayout = normalizeLayout(input.endLayout);
    book.updatedAt = nowIso();
    this.write(catalog);
    return hydrateBook(book);
  }

  async deleteBook(id: string): Promise<boolean> {
    const catalog = this.read();
    const next = catalog.books.filter((item) => item.id !== id);
    if (next.length === catalog.books.length) return false;
    catalog.books = next;
    this.write(catalog);
    return true;
  }

  async reorderBooks(bookIds: string[]): Promise<BookListItem[]> {
    const catalog = this.read();
    bookIds.forEach((id, index) => {
      const book = catalog.books.find((item) => item.id === id);
      if (book) book.sortOrder = index + 1;
    });
    this.write(catalog);
    return this.listBooks();
  }

  async getPlayerSetup(): Promise<PlayerSetup> {
    return hydratePlayerSetup(this.read().player);
  }

  async updatePlayerSetup(input: Partial<PlayerSetup>): Promise<PlayerSetup> {
    const catalog = this.read();
    catalog.player = normalizePlayerSetup({ ...hydratePlayerSetup(catalog.player), ...input });
    this.write(catalog);
    return hydratePlayerSetup(catalog.player);
  }

  async getCuratorRecord(): Promise<CuratorRecord> {
    return normalizeCurator(this.read().curator);
  }

  async getCurator(): Promise<Curator> {
    return publicCurator(await this.getCuratorRecord());
  }

  async updateCurator(input: Partial<CuratorRecord>): Promise<Curator> {
    const catalog = this.read();
    catalog.curator = normalizeCurator({ ...normalizeCurator(catalog.curator), ...input });
    this.write(catalog);
    return publicCurator(catalog.curator);
  }
}

export class PostgresBookStore implements BookStore {
  private db;

  constructor(connectionString: string) {
    const pool = new pg.Pool({ connectionString });
    this.db = drizzle(pool);
  }

  async ensureSchema(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        tagline TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        pdf TEXT NOT NULL DEFAULT '',
        pages_json TEXT NOT NULL DEFAULT '[]',
        color TEXT NOT NULL DEFAULT 'honey',
        sort_order INTEGER NOT NULL DEFAULT 0,
        hidden BOOLEAN NOT NULL DEFAULT false,
        published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_setup (
        id TEXT PRIMARY KEY,
        app_name TEXT NOT NULL DEFAULT '',
        theme TEXT NOT NULL DEFAULT '',
        credits TEXT NOT NULL DEFAULT '',
        copyright TEXT NOT NULL DEFAULT '',
        collection_cover TEXT NOT NULL DEFAULT '',
        logo TEXT NOT NULL DEFAULT '',
        favicon TEXT NOT NULL DEFAULT '',
        footer_image TEXT NOT NULL DEFAULT '',
        collection_color TEXT NOT NULL DEFAULT 'honey',
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS curator (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    const existingSetup = await this.db.select({ id: playerSetup.id }).from(playerSetup).limit(1);
    if (!existingSetup.length) {
      await this.db.insert(playerSetup).values({ id: "site", ...playerSetupRecord(DEFAULT_PLAYER_SETUP) });
    }
    const existingCurator = await this.db.select({ id: curator.id }).from(curator).limit(1);
    if (!existingCurator.length) {
      await this.db.insert(curator).values({ id: "site", ...DEFAULT_CURATOR });
    }
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS book_date TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'children'`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS page_template TEXT NOT NULL DEFAULT 'one-up'`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS character_render TEXT NOT NULL DEFAULT 'scene'`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS page_background TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS page_texture TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS spread_background TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS text_font TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS title_layout_json TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_layout_json TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS back_cover_layout_json TEXT NOT NULL DEFAULT ''`);
    await this.db.execute(sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS end_layout_json TEXT NOT NULL DEFAULT ''`);
  }

  async listBooks(): Promise<BookListItem[]> {
    const rows = await this.db.select().from(books).orderBy(asc(books.sortOrder), asc(books.title));
    return rows.map((row) => toListItem(recordBook(row)));
  }

  async getBookBySlug(slug: string): Promise<PublicBook | null> {
    const [row] = await this.db.select().from(books).where(sql`lower(${books.slug}) = ${String(slug || "").toLowerCase()}`).limit(1);
    return row ? hydrateBook(recordBook(row)) : null;
  }

  async getBookById(id: string): Promise<PublicBook | null> {
    const [row] = await this.db.select().from(books).where(eq(books.id, id)).limit(1);
    return row ? hydrateBook(recordBook(row)) : null;
  }

  async createBook(input: BookInput): Promise<PublicBook> {
    const pages = (input.pages || []).map((page, index) => normalizeBookPage(page, index));
    const [row] = await this.db
      .insert(books)
      .values({
        id: input.id || newId("book"),
        slug: input.slug,
        title: input.title,
        tagline: input.tagline || "",
        author: input.author || "",
        date: input.date || "",
        cover: input.cover || pages[0]?.imageAsset || "",
        pdf: input.pdf || "",
        pagesJson: pagesToJson(pages),
        color: normalizePaletteId(input.color),
        sortOrder: input.sortOrder ?? 0,
        hidden: Boolean(input.hidden),
        published: input.published !== false,
        audience: normalizeAudience(input.audience),
        pageTemplate: normalizePageTemplate(input.pageTemplate),
        characterRender: normalizeCharacterRender(input.characterRender),
        pageBackground: normalizeColor(input.pageBackground, DEFAULT_PAGE_BACKGROUND),
        pageTexture: normalizePaperTexture(input.pageTexture),
        spreadBackground: normalizeColor(input.spreadBackground, DEFAULT_SPREAD_BACKGROUND),
        textFont: normalizeFont(input.textFont, DEFAULT_TEXT_FONT),
        textColor: normalizeColor(input.textColor, DEFAULT_TEXT_COLOR),
        titleLayoutJson: layoutToJson(normalizeLayout(input.titleLayout)),
        coverLayoutJson: layoutToJson(normalizeLayout(input.coverLayout)),
        backCoverLayoutJson: layoutToJson(normalizeLayout(input.backCoverLayout)),
        endLayoutJson: layoutToJson(normalizeLayout(input.endLayout)),
      })
      .returning();
    return hydrateBook(recordBook(row));
  }

  async updateBook(id: string, input: Partial<BookInput>): Promise<PublicBook | null> {
    const patch: Partial<typeof books.$inferInsert> = { updatedAt: new Date() };
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.title !== undefined) patch.title = input.title;
    if (input.tagline !== undefined) patch.tagline = input.tagline;
    if (input.author !== undefined) patch.author = input.author;
    if (input.date !== undefined) patch.date = input.date;
    if (input.cover !== undefined) patch.cover = input.cover;
    if (input.pdf !== undefined) patch.pdf = input.pdf;
    if (input.pages !== undefined) patch.pagesJson = pagesToJson(input.pages.map((page, index) => normalizeBookPage(page, index)));
    if (input.color !== undefined) patch.color = normalizePaletteId(input.color);
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    if (input.hidden !== undefined) patch.hidden = input.hidden;
    if (input.published !== undefined) patch.published = input.published;
    if (input.audience !== undefined) patch.audience = normalizeAudience(input.audience);
    if (input.pageTemplate !== undefined) patch.pageTemplate = normalizePageTemplate(input.pageTemplate);
    if (input.characterRender !== undefined) patch.characterRender = normalizeCharacterRender(input.characterRender);
    if (input.pageBackground !== undefined) patch.pageBackground = normalizeColor(input.pageBackground, DEFAULT_PAGE_BACKGROUND);
    if (input.pageTexture !== undefined) patch.pageTexture = normalizePaperTexture(input.pageTexture);
    if (input.spreadBackground !== undefined) patch.spreadBackground = normalizeColor(input.spreadBackground, DEFAULT_SPREAD_BACKGROUND);
    if (input.textFont !== undefined) patch.textFont = normalizeFont(input.textFont, DEFAULT_TEXT_FONT);
    if (input.textColor !== undefined) patch.textColor = normalizeColor(input.textColor, DEFAULT_TEXT_COLOR);
    if (input.titleLayout !== undefined) patch.titleLayoutJson = layoutToJson(normalizeLayout(input.titleLayout));
    if (input.coverLayout !== undefined) patch.coverLayoutJson = layoutToJson(normalizeLayout(input.coverLayout));
    if (input.backCoverLayout !== undefined) patch.backCoverLayoutJson = layoutToJson(normalizeLayout(input.backCoverLayout));
    if (input.endLayout !== undefined) patch.endLayoutJson = layoutToJson(normalizeLayout(input.endLayout));
    const [row] = await this.db.update(books).set(patch).where(eq(books.id, id)).returning();
    return row ? hydrateBook(recordBook(row)) : null;
  }

  async deleteBook(id: string): Promise<boolean> {
    const deleted = await this.db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
    return deleted.length > 0;
  }

  async reorderBooks(bookIds: string[]): Promise<BookListItem[]> {
    for (const [index, id] of bookIds.entries()) {
      await this.db.update(books).set({ sortOrder: index + 1, updatedAt: new Date() }).where(eq(books.id, id));
    }
    return this.listBooks();
  }

  async getPlayerSetup(): Promise<PlayerSetup> {
    const [row] = await this.db.select().from(playerSetup).where(eq(playerSetup.id, "site")).limit(1);
    return hydratePlayerSetup(row);
  }

  async updatePlayerSetup(input: Partial<PlayerSetup>): Promise<PlayerSetup> {
    const current = await this.getPlayerSetup();
    const next = normalizePlayerSetup({ ...current, ...input });
    const stored = playerSetupRecord(next);
    await this.db
      .insert(playerSetup)
      .values({ id: "site", ...stored, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: playerSetup.id,
        set: { ...stored, updatedAt: new Date() },
      });
    return hydratePlayerSetup(next);
  }

  async getCuratorRecord(): Promise<CuratorRecord> {
    const [row] = await this.db.select().from(curator).where(eq(curator.id, "site")).limit(1);
    return normalizeCurator(row);
  }

  async getCurator(): Promise<Curator> {
    return publicCurator(await this.getCuratorRecord());
  }

  async updateCurator(input: Partial<CuratorRecord>): Promise<Curator> {
    const current = await this.getCuratorRecord();
    const next = normalizeCurator({ ...current, ...input });
    await this.db
      .insert(curator)
      .values({ id: "site", ...next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: curator.id,
        set: { ...next, updatedAt: new Date() },
      });
    return publicCurator(next);
  }
}

let storePromise: Promise<BookStore> | null = null;

export async function getStore(): Promise<BookStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const url = process.env.DATABASE_URL;
      if (url && /^postgres/i.test(url)) {
        const store = new PostgresBookStore(url);
        await store.ensureSchema();
        return store;
      }
      return new JsonBookStore();
    })();
  }
  return storePromise;
}

export function resetStoreForTests(): void {
  storePromise = null;
}
