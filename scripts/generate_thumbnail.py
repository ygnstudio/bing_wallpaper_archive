#!/usr/bin/env python3
"""Generate thumbnails for every full image present in wallpapers/ (local cache).

Maps wallpapers/YYYY/MM/NAME.jpg -> thumbnails/YYYY/MM/NAME.jpg (480x270).
Useful after bulk-downloading full images via download_full.py.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
THUMB_W, THUMB_H = 480, 270
SUPPORTED = {".jpg", ".jpeg"}


def main():
    wallpapers = ROOT / "wallpapers"
    if not wallpapers.exists():
        print("no wallpapers/ directory")
        return
    generated = 0
    for img in sorted(wallpapers.rglob("*")):
        if not img.is_file() or img.suffix.lower() not in SUPPORTED:
            continue
        rel = img.relative_to(wallpapers)
        thumb = ROOT / "thumbnails" / rel
        if thumb.exists():
            continue
        thumb.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(img) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im = im.resize((THUMB_W, THUMB_H), Image.LANCZOS)
            im.save(thumb, "JPEG", quality=85, optimize=True)
        generated += 1
    print(f"generated {generated} thumbnails")


if __name__ == "__main__":
    main()
