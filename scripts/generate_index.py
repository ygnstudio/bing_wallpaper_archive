#!/usr/bin/env python3
"""Build data/index.json and per-year data/YYYY.json from data/metadata.json + thumbnails/.

Output:
- data/index.json        light-weight index for all entries (sorted newest-first).
                         Fields: date, title, copyright, category, color, thumbnail, uhd
- data/YYYY.json         full records for one year, used for lazy-loading details
                         (url, copyrightlink, urlbase, plus the light fields).

Run after download.py / classify.py update metadata.json / thumbnails/.
"""
import os
from collections import defaultdict

from lib import ROOT, load_json, save_json

DATA = ROOT / "data"

LIGHT_FIELDS = ("date", "title", "copyright", "category", "color", "thumbnail", "uhd")
FULL_FIELDS = LIGHT_FIELDS + ("url", "copyrightlink", "urlbase")


def main():
    meta = load_json(DATA / "metadata.json")

    light_entries = []
    by_year = defaultdict(list)

    for date, m in meta.items():
        y, mo = date[:4], date[4:6]
        thumb = f"thumbnails/{y}/{mo}/{date}.webp"
        thumb = thumb if os.path.exists(os.path.join(ROOT, thumb)) else None

        light = {
            "date": date,
            "title": m.get("title", ""),
            "copyright": m.get("copyright", ""),
            "category": m.get("category", "其他"),
            "color": m.get("color") or None,
            "thumbnail": thumb,
            "uhd": m.get("uhd"),
        }
        light_entries.append(light)

        full = {**light}
        full.update({
            "url": m.get("url", ""),
            "copyrightlink": m.get("copyrightlink", ""),
            "urlbase": m.get("urlbase", ""),
        })
        by_year[y].append(full)

    light_entries.sort(key=lambda e: e["date"], reverse=True)

    # Write light-weight master index
    save_json(DATA / "index.json", light_entries)

    # Write per-year full indices
    for y, entries in by_year.items():
        entries.sort(key=lambda e: e["date"], reverse=True)
        save_json(DATA / f"{y}.json", entries)

    with_thumb = sum(1 for e in light_entries if e["thumbnail"])
    print(f"index.json: {len(light_entries)} entries, {with_thumb} with thumbnail, "
          f"{len(light_entries) - with_thumb} missing")
    print(f"yearly json: {len(by_year)} files ({', '.join(sorted(by_year.keys()))})")


if __name__ == "__main__":
    main()
