#!/usr/bin/env python3
"""Backfill missing thumbnails by downloading from Bing CDN.

Reads data/index.json; for every entry whose thumbnail file is absent, fetches
the Bing image (entry["url"], 1920x1080) and writes a 480x270 JPEG into
thumbnails/YYYY/MM/YYYYMMDD.jpg. Resumable: existing files are skipped, so the
script can be re-run safely to fill gaps left by failed/blocked URLs.
"""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
THUMB_W, THUMB_H = 480, 270
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Referer": "https://www.bing.com/"}


def process(entry):
    date = entry["date"]
    thumb_path = os.path.join(ROOT, "thumbnails", date[:4], date[4:6], f"{date}.jpg")
    if os.path.exists(thumb_path):
        return ("skip", date)
    url = entry.get("url")
    if not url:
        return ("fail", date)
    for attempt in range(2):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code == 200 and r.content:
                img = Image.open(BytesIO(r.content)).convert("RGB")
                img = img.resize((THUMB_W, THUMB_H), Image.LANCZOS)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                img.save(thumb_path, "JPEG", quality=85)
                return ("ok", date)
            if r.status_code == 429:
                time.sleep(3)
                continue
            return ("fail", date)
        except Exception:
            time.sleep(1)
    return ("fail", date)


def main():
    entries = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    missing = [e for e in entries if not e.get("thumbnail")]
    print(f"missing thumbnails to backfill: {len(missing)}", flush=True)
    ok = fail = skip = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(process, e): e for e in missing}
        for i, fut in enumerate(as_completed(futs), 1):
            status, date = fut.result()
            if status == "ok":
                ok += 1
            elif status == "fail":
                fail += 1
            else:
                skip += 1
            if i % 100 == 0 or i == len(missing):
                print(f"[{i}/{len(missing)}] ok={ok} fail={fail}", flush=True)
    print(f"DONE ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
