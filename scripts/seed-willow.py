#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
from pathlib import Path

import fitz

base = os.environ.get("BOOKS_URL", "https://spodazo-books-production.up.railway.app")
password = os.environ["ADMIN_PASSWORD"]
pdf_path = Path(os.environ.get("WILLOW_PDF", "media/pdfs/Willows-Big-Forest-Adventure.pdf"))
cookie = Path(tempfile.gettempdir()) / "spodazo-books-admin.jar"


def curl(*args):
    return subprocess.check_output(["curl", "-sS", *args], text=True)


def login():
    cookie.unlink(missing_ok=True)
    body = curl(
        "-c", str(cookie),
        "-H", "Content-Type: application/json",
        "-X", "POST",
        f"{base}/api/admin/login",
        "-d", json.dumps({"password": password}),
    )
    data = json.loads(body)
    if not data.get("ok"):
        raise SystemExit(f"login failed: {body}")


def upload(path: Path):
    body = curl(
        "-b", str(cookie),
        "-c", str(cookie),
        "-F", f"file=@{path}",
        f"{base}/api/admin/book-assets",
    )
    data = json.loads(body)
    if "url" not in data:
        raise SystemExit(f"upload failed: {body}")
    return data


def paragraphs_from(text: str):
    parts = [p.strip() for p in text.replace("\r", "").split("\n") if p.strip()]
    # drop tiny headers/footers
    return [p for p in parts if len(p) > 2 and not p.isdigit()]


login()
doc = fitz.open(pdf_path)
pages = []
with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    pdf_upload = upload(pdf_path)
    for i, page in enumerate(doc, start=1):
        rect = page.rect
        square = abs(rect.width - rect.height) / max(rect.width, rect.height) < 0.12
        right = fitz.Rect(rect.width * 0.66, 0, rect.width, rect.height)
        right_text = page.get_text("text", clip=right).strip()
        full = tmp_path / f"page-{i:03d}.jpg"
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(full.as_posix())
        full_up = upload(full)
        kind = "story" if square and len(right_text) > 20 else "facsimile"
        image_up = full_up
        if kind == "story":
            left = fitz.Rect(0, 0, rect.width * 0.66, rect.height)
            art = tmp_path / f"art-{i:03d}.jpg"
            page.get_pixmap(clip=left, matrix=fitz.Matrix(2, 2), alpha=False).save(art.as_posix())
            image_up = upload(art)
        lines = paragraphs_from(right_text if kind == "story" else page.get_text("text"))
        title = lines[0] if lines else f"Page {i}"
        body = lines[1:] if kind == "story" and len(lines) > 1 else lines
        pages.append({
            "id": f"page-{i}",
            "sourcePage": i,
            "kind": kind,
            "title": title,
            "paragraphs": body,
            "imageAsset": image_up["filename"],
            "fullPageAsset": full_up["filename"],
            "imageUrl": image_up["url"],
            "fullPageUrl": full_up["url"],
            "position": "top" if i <= 3 else "bottom",
            "focalPoint": "50% 50%",
        })
        print(f"page {i}/{doc.page_count} {kind}", flush=True)

    book = {
        "title": "Willow’s Big Forest Adventure",
        "slug": "Willows-Big-Forest-Adventure",
        "tagline": "A little tiger. A very big roar. And the happiest hug of all.",
        "pdfUrl": pdf_upload["url"],
        "coverUrl": pages[0]["imageUrl"],
        "pages": pages,
        "published": True,
        "hidden": False,
    }
    created = curl(
        "-b", str(cookie),
        "-c", str(cookie),
        "-H", "Content-Type: application/json",
        "-X", "POST",
        f"{base}/api/admin/books",
        "-d", json.dumps(book),
    )
    print(created, flush=True)
cookie.unlink(missing_ok=True)
