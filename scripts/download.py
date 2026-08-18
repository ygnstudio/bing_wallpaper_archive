#!/usr/bin/env python3
"""Fetch today's Bing wallpaper into the light archive.

- downloads the full image into wallpapers/ (local cache, gitignored)
- appends/updates the entry in data/metadata.json (Bing source URL kept)
- generates today's thumbnail into thumbnails/ (committed, served by Pages)

Run daily by .github/workflows/update.yml.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

BING_API = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN&uhd=1"
BING_BASE = "https://www.bing.com"
ROOT = Path(__file__).resolve().parents[1]
TIMEOUT = 30
THUMB_W, THUMB_H = 480, 270
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
HEADERS = {"User-Agent": UA, "Referer": "https://www.bing.com/"}


def fetch_metadata():
    req = Request(BING_API, headers={"User-Agent": UA})
    with urlopen(req, timeout=TIMEOUT) as r:
        data = json.loads(r.read().decode("utf-8"))
    images = data.get("images") or [None]
    if not images[0]:
        raise ValueError("Bing API returned no image")
    return images[0]


def build_url(meta):
    raw = meta.get("url") or (meta.get("urlbase", "") + "_1920x1080.jpg")
    url = urljoin(BING_BASE, raw)
    # 仅替换 th?id=OHR.xxx 后的尺寸后缀（UHD/4K/WxH），不动 rf= 等其他段，
    # 避免生成形如 rf=LaDigue_1920x1080.jpg 的脏 URL。
    m = re.search(r"th\?id=(OHR\.[^&]+)", url, flags=re.I)
    if m:
        oid = m.group(1)
        # 先剥掉 .jpg 扩展名，再剥末尾尺寸后缀；否则 _UHD.jpg 这种会被
        # re.sub(r"_(UHD|...)$") 漏掉，生成 _UHD.jpg_1920x1080.jpg 的双重后缀脏 URL（404）。
        oid = re.sub(r"\.jpe?g$", "", oid, flags=re.I)
        oid = re.sub(r"_(UHD|4K|\d+X\d+)$", "", oid, flags=re.I)
        return f"https://www.bing.com/th?id={oid}_1920x1080.jpg"
    return url


def date_key(meta):
    sd = meta.get("startdate")
    if isinstance(sd, str) and re.fullmatch(r"\d{8}", sd):
        return sd
    return date.today().strftime("%Y%m%d")


def load_json(p: Path):
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError:
        return {}


def save_json(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def make_thumbnail(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im = im.resize((THUMB_W, THUMB_H), Image.LANCZOS)
        im.save(dst, "JPEG", quality=85, optimize=True)


def main():
    meta = fetch_metadata()
    url = build_url(meta)
    key = date_key(meta)
    wall = ROOT / "wallpapers" / key[:4] / key[4:6] / f"{key}.jpg"
    thumb = ROOT / "thumbnails" / key[:4] / key[4:6] / f"{key}.jpg"

    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=TIMEOUT) as r:
            wall.parent.mkdir(parents=True, exist_ok=True)
            wall.write_bytes(r.read())
        print("saved full image:", wall)
    except Exception as e:  # network flake should not abort the run
        print("warn: full image download failed:", e, file=sys.stderr)

    records = load_json(ROOT / "data" / "metadata.json")
    records[key] = {
        "title": meta.get("title", "") or "",
        "copyright": meta.get("copyright", "") or "",
        "copyrightlink": meta.get("copyrightlink", "") or "",
        "url": url,
        "urlbase": meta.get("urlbase", "") or "",
    }
    save_json(ROOT / "data" / "metadata.json", dict(sorted(records.items())))

    if wall.exists():
        make_thumbnail(wall, thumb)
        print("saved thumbnail:", thumb)
    else:
        print("warn: thumbnail skipped (full image missing)")


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError, OSError, ValueError) as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)
