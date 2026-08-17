#!/usr/bin/env python3
"""Build data/index.json from data/metadata.json + the thumbnails/ cache.

Output entry per wallpaper day:
  date, title, copyright, copyrightlink,
  thumbnail (repo path or null), url (full Bing CDN link), urlbase
Sorted newest-first. Run after download.py updates metadata.json / thumbnails/.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def main():
    meta = json.load(open(os.path.join(DATA, "metadata.json"), encoding="utf-8"))
    entries = []
    for date, m in meta.items():
        y, mo = date[:4], date[4:6]
        thumb = f"thumbnails/{y}/{mo}/{date}.jpg"
        entry = {
            "date": date,
            "title": m.get("title", ""),
            "copyright": m.get("copyright", ""),
            "copyrightlink": m.get("copyrightlink", ""),
            "thumbnail": thumb if os.path.exists(os.path.join(ROOT, thumb)) else None,
            "url": m.get("url", ""),
            "urlbase": m.get("urlbase", ""),
        }
        entries.append(entry)
    entries.sort(key=lambda e: e["date"], reverse=True)
    out = os.path.join(DATA, "index.json")
    json.dump(entries, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with_thumb = sum(1 for e in entries if e["thumbnail"])
    print(f"index.json: {len(entries)} entries, {with_thumb} with thumbnail, "
          f"{len(entries) - with_thumb} missing")


if __name__ == "__main__":
    main()
