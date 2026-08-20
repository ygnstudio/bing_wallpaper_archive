#!/usr/bin/env python3
"""
一次性数据清洗脚本：
把 metadata.json 中 Bing 官方带参数的非标准 UHD 跳转 URL
统一改为标准 1080p URL（https://www.bing.com/th?id=OHR.xxx_1920x1080.jpg）。

只处理同时满足以下条件的条目：
- url 包含 bing.com/th?id=OHR
- url 不是以 _1920x1080.jpg 结尾
- urlbase 包含 OHR.xxx 可提取

保留 cdn.bimg.cc 等已经标准的 URL 不变。
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
META_PATH = ROOT / "data" / "metadata.json"


def normalize_url(urlbase: str, url: str) -> str | None:
    if "bing.com/th?id=OHR" not in url:
        return None
    if url.endswith("_1920x1080.jpg"):
        return None
    m = re.search(r"OHR\.[^&]+", urlbase)
    if not m:
        return None
    oid = m.group(0)
    oid = re.sub(r"\.jpg$", "", oid, flags=re.I)
    oid = re.sub(r"_(UHD|4K|\d+X\d+)$", "", oid, flags=re.I)
    return f"https://www.bing.com/th?id={oid}_1920x1080.jpg"


def main():
    with open(META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    changed = 0
    skipped = 0
    for date, item in meta.items():
        url = item.get("url", "")
        urlbase = item.get("urlbase", "")
        new_url = normalize_url(urlbase, url)
        if new_url:
            item["url"] = new_url
            changed += 1
        elif "bing.com/th?id=OHR" in url and not url.endswith("_1920x1080.jpg"):
            skipped += 1
            print(f"WARN: {date} could not normalize: {url}")

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Normalized {changed} URLs, skipped {skipped}.")


if __name__ == "__main__":
    main()
