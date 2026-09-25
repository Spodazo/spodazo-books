/** Runs inside the PDF.js worker before Mozilla's worker bundle loads. */
if (typeof Uint8Array !== "undefined" && typeof Uint8Array.prototype.toHex !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value() {
      let hex = "";
      for (let i = 0; i < this.length; i += 1) {
        hex += this[i].toString(16).padStart(2, "0");
      }
      return hex;
    },
    configurable: true,
    writable: true,
  });
}
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
