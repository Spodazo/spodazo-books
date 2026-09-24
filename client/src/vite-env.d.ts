/// <reference types="vite/client" />

declare module "*.js" {
  export const importPDF: (file: Blob, options?: Record<string, unknown>) => Promise<{
    book: {
      title: string;
      tagline?: string;
      author?: string;
      date?: string;
      pdfUrl: string;
      pages: Array<{
        id: string;
        sourcePage: number;
        kind: "story" | "facsimile";
        title: string;
        paragraphs: string[];
        imageUrl: string;
        imageAsset: string;
        fullPageUrl: string;
        fullPageAsset: string;
        position: "top" | "bottom";
        focalPoint: string;
      }>;
    };
    assets: Array<{ name: string; blob: Blob }>;
    pdf: Blob & { name?: string };
    dispose: () => void;
  }>;
  export const persistImportedBook: (
    imported: unknown,
    uploadAsset: (blob: Blob, filename: string) => Promise<string>,
    saveManifest: (book: unknown) => Promise<unknown>,
  ) => Promise<unknown>;
  export const mountReader: (
    container: HTMLElement,
    book: unknown,
    options?: { libraryUrl?: string; baseUrl?: string; credits?: string; copyright?: string; logoUrl?: string; alwaysLandscape?: boolean; fadeOpen?: boolean },
  ) => { frame: HTMLIFrameElement; destroy: () => void };
}

