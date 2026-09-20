export type BookAudience = "children" | "adults";
export type PageTemplate = "one-up" | "two-up" | "three-up";
export type CharacterRender = "scene" | "cutout";

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
