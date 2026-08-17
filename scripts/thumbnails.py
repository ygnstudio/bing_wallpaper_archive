#!/usr/bin/env python3
"""Generate / regenerate wallpaper thumbnails (480x270 JPEG) into thumbnails/.

Single source of truth replacing the old backfill_thumbnails.py and
regenerate_thumbnails.py (which were 90% duplicated).

Modes:
  default   only fill entries whose thumbnail file is missing (resumable)
  --force   re-download and overwrite every thumbnail from its Bing source URL

Uses a shared requests.Session for connection reuse. Reads data/index.json for
the per-day Bing source URL (entry["url"]).
"""
from __future__ import annotations

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

import requests
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
THUMB_W, THUMB_H = 480, 270
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.0")
HEADERS = {"User-Agent": UA, "Referer": "https://www.bing.com/"}
MAX_WORKERS = 8
MAX_RETRIES = 3


def process(entry, force: bool, session: requests.Session):
    date = entry["date"]
    thumb_path = os.path.join(ROOT, "thumbnails", date[:4], date[4:6], f"{date}.jpg")
    if not force and os.path.exists(thumb_path):
        return ("skip", date, "")
    url = entry.get("url")
    if not url:
        return ("fail", date, "no url")
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200 and r.content:
                img = Image.open(BytesIO(r.content)).convert("RGB")
                img = img.resize((THUMB_W, THUMB_H), Image.LANCZOS)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                img.save(thumb_path, "JPEG", quality=85)
                return ("ok", date, "")
            if r.status_code == 429:
                time.sleep(2 ** (attempt + 1) + 1)
                continue
            return ("fail", date, f"http {r.status_code}")
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                return ("fail", date, str(e)[:60])
            time.sleep(2)
    return ("fail", date, "exhausted")


def main():
    ap = argparse.ArgumentParser(description="生成 / 重生成缩略图")
    ap.add_argument("--force", action="store_true",
                    help="覆盖全部缩略图（默认只补缺失项）")
    args = ap.parse_args()

    with open(os.path.join(DATA, "index.json"), encoding="utf-8") as f:
        entries = json.load(f)
    print(f"thumbnails to process: {len(entries)} (force={args.force})", flush=True)

    ok = fail = skip = 0
    with requests.Session() as session:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = {ex.submit(process, e, args.force, session): e for e in entries}
            for i, fut in enumerate(as_completed(futs), 1):
                status, date, info = fut.result()
                if status == "ok":
                    ok += 1
                elif status == "skip":
                    skip += 1
                else:
                    fail += 1
                    print(f"fail {date}: {info}", flush=True)
                if i % 100 == 0 or i == len(entries):
                    print(f"[{i}/{len(entries)}] ok={ok} skip={skip} fail={fail}",
                          flush=True)
    print(f"DONE ok={ok} skip={skip} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
