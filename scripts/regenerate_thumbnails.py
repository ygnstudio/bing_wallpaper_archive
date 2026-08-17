#!/usr/bin/env python3
"""Regenerate ALL thumbnails from metadata.json URLs.

Use when the thumbnail cache may be out of sync with metadata (e.g. after
fixing a date shift or re-seeding from a different source). Existing files
are overwritten. Run generate_index.py afterwards.
"""
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


def process(entry):
    date = entry["date"]
    thumb_path = os.path.join(ROOT, "thumbnails", date[:4], date[4:6], f"{date}.jpg")
    url = entry.get("url")
    if not url:
        return ("fail", date, "no url")
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200 and r.content:
                img = Image.open(BytesIO(r.content)).convert("RGB")
                img = img.resize((THUMB_W, THUMB_H), Image.LANCZOS)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                img.save(thumb_path, "JPEG", quality=85)
                return ("ok", date, "")
            if r.status_code == 429:
                time.sleep(5)
                continue
            return ("fail", date, f"http {r.status_code}")
        except Exception as e:
            if attempt == 2:
                return ("fail", date, str(e)[:60])
            time.sleep(2)
    return ("fail", date, "exhausted")


def main():
    entries = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    print(f"thumbnails to regenerate: {len(entries)}", flush=True)
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(process, e): e for e in entries}
        for i, fut in enumerate(as_completed(futs), 1):
            status, date, info = fut.result()
            if status == "ok":
                ok += 1
            else:
                fail += 1
                print(f"fail {date}: {info}", flush=True)
            if i % 100 == 0 or i == len(entries):
                print(f"[{i}/{len(entries)}] ok={ok} fail={fail}", flush=True)
    print(f"DONE ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
