export type BookAudience = "children" | "adults";
export type PageTemplate = "one-up" | "two-up" | "three-up";
export type CharacterRender = "scene" | "cutout";
export type PageElementRole = "title" | "tagline" | "author" | "date" | "body" | "end" | "back";
export type TextAlign = "left" | "center" | "right";

export type PageElement = {
  id: string;
  type: "text" | "image" | "shape";
  shape?: "rectangle" | "circle";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  text?: string;
  imageAsset?: string;
  imageUrl?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: TextAlign;
  frame?: string;
  frameColor?: string;
  fit?: "cover" | "contain";
  /** Visible point inside a filled picture, 0–100. 50 is the center. */
  focusX?: number;
  focusY?: number;
  opacity?: number;
  role?: PageElementRole;
};

export type PageLayout = {
  elements: PageElement[];
  background?: string;
};

export type BookPage = {
  id: string;
  sourcePage: number;
  kind: "story" | "facsimile";
  title: string;
  paragraphs: string[];
  imageAsset: string;
  fullPageAsset: string;
  imageUrl: string;
  fullPageUrl: string;
  position: "top" | "bottom";
  focalPoint: string;
  alt?: string;
  elements: PageElement[];
  background: string;
};

export type Book = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  author: string;
  date: string;
  cover: string;
  pdf: string;
  color: string;
  sortOrder: number;
  hidden: boolean;
  published: boolean;
  audience: BookAudience;
  pageTemplate: PageTemplate;
  characterRender: CharacterRender;
  pageBackground: string;
  pageTexture: string;
  spreadBackground: string;
  textFont: string;
  textColor: string;
  titleLayout: PageLayout;
  coverLayout: PageLayout;
  backCoverLayout: PageLayout;
  endLayout: PageLayout;
  /** Upright phone pages. Missing until Portrait Mobile Display is saved. */
  portraitPages?: PageLayout[] | null;
  pages: BookPage[];
  createdAt?: string;
  updatedAt?: string;
};

export type PublicBook = Book & {
  coverUrl: string;
  pdfUrl: string;
  pageCount: number;
};

export type BookListItem = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  author: string;
  date: string;
  cover: string;
  coverUrl: string;
  pdfUrl: string;
  color: string;
  sortOrder: number;
  hidden: boolean;
  published: boolean;
  audience: BookAudience;
  pageCount: number;
  pageBackground: string;
  pageTexture: string;
  spreadBackground: string;
  textFont: string;
  textColor: string;
  coverLayout: PageLayout;
};

export type PlayerSetup = {
  appName: string;
  theme: string;
  credits: string;
  copyright: string;
  collectionCover: string;
  collectionCoverUrl: string;
  logo: string;
  logoUrl: string;
  favicon: string;
  faviconUrl: string;
  footerImage: string;
  footerImageUrl: string;
  collectionColor: string;
};

export type Curator = {
  firstName: string;
  lastName: string;
  email: string;
};

export type CuratorRecord = Curator & {
  passwordHash: string;
};
