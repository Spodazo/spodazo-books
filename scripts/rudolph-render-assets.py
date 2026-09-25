#!/usr/bin/env python3
"""Render Rudolph portrait PDF pages and cover assets for import."""
from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

import fitz
from PIL import Image

DEFAULT_SRC = os.path.expanduser(
    "~/Desktop/Rudolph the Red Nosed Reindeer-portrait.pdf"
)


def save_webp(img: Image.Image, path: Path, quality: int = 86) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="WEBP", quality=quality, method=6)


def render_page(doc: fitz.Document, index: int, scale: float = 2.0) -> Image.Image:
    page = doc[index]
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def build_lite_pdf(src: str, dest: Path, scale: float = 1.25) -> None:
    doc = fitz.open(src)
    out = fitz.open()
    for i in range(doc.page_count):
        sp = doc[i]
        pix = sp.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        rect = fitz.Rect(0, 0, sp.rect.width, sp.rect.height)
        page = out.new_page(width=rect.width, height=rect.height)
        page.insert_image(rect, stream=buf.getvalue())
    out.save(dest, garbage=4, deflate=True)
    out.close()
    doc.close()


def main() -> int:
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/rudolph-book-import")
    if not os.path.isfile(src):
        print(f"Missing PDF: {src}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(src)
    page_count = doc.page_count

    cover = render_page(doc, 0)
    w, h = cover.size
    save_webp(cover, out_dir / "Rudolph-cover.webp")
    save_webp(cover.crop((0, 0, w, int(h * 0.62))), out_dir / "Rudolph-cover-art.webp")

    end_page = render_page(doc, page_count - 1)
    ew, eh = end_page.size
    save_webp(
        end_page.crop((int(ew * 0.45), int(eh * 0.58), ew, eh)),
        out_dir / "rudolph-character.webp",
    )

    pages = []
    for i in range(1, page_count - 1):
        img = render_page(doc, i)
        name = f"rudolph-page-{i + 1:02d}.webp"
        save_webp(img, out_dir / name)
        pages.append(
            {
                "id": f"page-{i}",
                "sourcePage": i + 1,
                "kind": "facsimile",
                "title": f"Page {i + 1}",
                "paragraphs": [],
                "imageAsset": name,
                "fullPageAsset": name,
                "position": "bottom",
                "focalPoint": "50% 50%",
                "elements": [],
                "background": "",
            }
        )

    build_lite_pdf(src, out_dir / "Rudolph-The-Red-Nosed-Reindeer.pdf")

    manifest = {
        "pageCount": page_count,
        "storyPages": len(pages),
        "pages": pages,
        "assetsDir": str(out_dir),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    doc.close()
    print(json.dumps(manifest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
