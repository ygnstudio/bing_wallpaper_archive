#!/usr/bin/env python3
"""Download full-size wallpapers from Bing on demand, by date.

Reads data/metadata.json for the Bing source URL of each date and saves the
full image into wallpapers/YYYY/MM/YYYYMMDD[_RES].jpg (local cache, gitignored).

Resolution can be chosen for recent images (Bing serves OHR URLs with a
_UHD / _WxH suffix). Older images sourced from the cdn.bimg.cc mirror only
have a fixed 1920x1080; if the requested resolution is unavailable we fall
back to the default URL.

Usage:
  python scripts/download_full.py 20260817
  python scripts/download_full.py 20260817 --res UHD
  python scripts/download_full.py 20260101 20260817        # inclusive range
  python scripts/download_full.py all --res 1920x1080      # every date, 1080p
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
HEADERS = {"User-Agent": UA, "Referer": "https://www.bing.com/"}
SESSION = requests.Session()


def load_meta():
    with open(ROOT / "data" / "metadata.json", encoding="utf-8") as f:
        return json.load(f)


def build_url(meta: dict, res: str | None) -> str | None:
    """Return a Bing source URL at the requested resolution, or None."""
    url = meta.get("url")
    if not url or not res or res.lower() in ("default", "orig", "original", "full"):
        return url
    res = res.upper()
    # www.bing.com/th?id=OHR.xxx[_UHD|_WxH].jpg -> swap the size suffix
    m = re.search(r"th\?id=(OHR\.[^&]+)", url)
    if m:
        oid = m.group(1).replace(".jpg", "")
        oid = re.sub(r"_(UHD|\d+X\d+)$", "", oid, flags=re.I)
        return f"https://www.bing.com/th?id={oid}_{res}.jpg"
    # cdn.bimg.cc mirror: try swapping the size suffix too
    if "cdn.bimg.cc" in url:
        return re.sub(r"_(UHD|\d+X\d+)?\.jpg$", f"_{res}.jpg", url, flags=re.I)
    return url


def _fetch(url: str) -> bytes:
    r = SESSION.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.content


def download(day: str, res: str | None = None) -> bool:
    meta = load_meta().get(day)
    if not meta or not meta.get("url"):
        print("skip (no url):", day)
        return False
    url = build_url(meta, res)
    suffix = f"_{res}" if res else ""
    dst = ROOT / "wallpapers" / day[:4] / day[4:6] / f"{day}{suffix}.jpg"
    if dst.exists():
        print("exists:", day, suffix)
        return False
    try:
        data = _fetch(url)
    except Exception:
        # requested resolution unavailable on this source -> fall back to default
        if res and url != meta["url"]:
            url = meta["url"]
            dst = ROOT / "wallpapers" / day[:4] / day[4:6] / f"{day}.jpg"
            if dst.exists():
                print("exists:", day)
                return False
            try:
                data = _fetch(url)
            except Exception as e:
                print("fail:", day, e)
                return False
        else:
            print("fail:", day)
            return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(data)
    print(f"downloaded: {day} -> {dst.name} {len(data)//1024}KB")
    return True


def date_range(a: str, b: str):
    d0 = date(int(a[:4]), int(a[4:6]), int(a[6:8]))
    d1 = date(int(b[:4]), int(b[4:6]), int(b[6:8]))
    while d0 <= d1:
        yield d0.strftime("%Y%m%d")
        d0 += timedelta(days=1)


def main():
    args = sys.argv[1:]
    res = None
    if "--res" in args:
        i = args.index("--res")
        res = args[i + 1] if i + 1 < len(args) else None
        args = args[:i] + args[i + 2:]
    if not args:
        print(__doc__)
        sys.exit(1)
    meta = load_meta()
    if args[0] == "all":
        days = list(meta.keys())
        # 警告：全量下载会把所有原图写入 wallpapers/（gitignore，不入库），
        # 但每张 1–5MB，数千张合计可达数 GB，请确保本地磁盘充足。
        print(f"warn: 'all' 会下载 {len(days)} 张全图到 wallpapers/（~GB 级，不入库），"
              f"请确保磁盘空间充足。", file=sys.stderr)
    elif len(args) == 2:
        days = list(date_range(args[0], args[1]))
    else:
        days = args
    ok = 0
    for d in days:
        if download(d, res):
            ok += 1
    print(f"done: {ok} downloaded / {len(days)} requested")


if __name__ == "__main__":
    main()
