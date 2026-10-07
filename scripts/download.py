#!/usr/bin/env python3
"""Sync recent Bing wallpapers into the light archive.

- checks the last eight releases, generates missing thumbnails into thumbnails/
- appends/updates the entry in data/metadata.json (Bing source URL kept)
- 不保留全尺寸原图（原图由前端从 Bing CDN 按需直取）

Run daily by .github/workflows/update.yml.
"""
from __future__ import annotations

import argparse
import io
import os
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from lib import HEADERS, ROOT, TIMEOUT, UA, http_get, load_json, save_json

BING_API = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN&uhd=1"
BING_BASE = "https://www.bing.com"
THUMB_W, THUMB_H = 480, 270


def fetch_metadata():
    data = json.loads(http_get(BING_API, headers={"User-Agent": UA}).decode("utf-8"))
    images = data.get("images")
    if not isinstance(images, list) or not images:
        raise ValueError("Bing API returned no image")
    return images


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
    """Keep Bing's official archive date; never infer a date from capture time."""
    source_date = meta.get("startdate")
    if not isinstance(source_date, str) or not re.fullmatch(r"\d{8}", source_date):
        raise ValueError("Bing metadata has no valid startdate")
    datetime.strptime(source_date, "%Y%m%d")  # Reject impossible dates as well.
    return source_date


# load_json / save_json 已上移 scripts/lib.py（损坏保护 + 原子写）


def make_thumbnail(data: bytes, dst: Path):
    from PIL import Image, ImageOps

    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im = im.resize((THUMB_W, THUMB_H), Image.LANCZOS)
        im.save(dst, "WEBP", quality=80, method=4)


def probe_uhd(urlbase):
    """探测该图是否提供 4K(UHD) 源；404 明确无，其他异常返回 None（乐观视为有）。"""
    if not urlbase:
        return None
    uhd_url = "https://www.bing.com" + urlbase + "_UHD.jpg"
    for method in ("HEAD", "GET"):
        try:
            req = Request(uhd_url, headers=HEADERS, method=method)
            if method == "GET":
                req.add_header("Range", "bytes=0-0")
            with urlopen(req, timeout=TIMEOUT) as r:
                return r.status in (200, 206)
        except HTTPError as e:
            if e.code == 404:
                return False
            continue
        except (URLError, OSError, ValueError):
            return None
    return None


def download_thumbnail(meta, destination):
    make_thumbnail(http_get(build_url(meta), headers=HEADERS), destination)


def thumbnail_path(root, key):
    return root / "thumbnails" / key[:4] / key[4:6] / f"{key}.webp"


def sync_wallpapers(images, root=ROOT):
    records = load_json(root / "data" / "metadata.json")
    planned = {}
    for meta in images:
        key = date_key(meta)
        identity = meta.get("urlbase")
        if not identity or key in planned:
            raise ValueError(f"Missing photo identity or duplicate date: {key}")
        previous = records.get(key, {})
        if previous and previous.get("urlbase") != identity:
            raise ValueError(f"Date {key} belongs to a different photo; refusing to overwrite")
        source = thumbnail_path(root, key) if previous else None
        if source and (not source.is_file() or source.stat().st_size == 0):
            source = None
        planned[key] = (meta, previous, source)

    updated = dict(records)
    # Stage every image first: a failed fetch leaves metadata and existing photos intact.
    with TemporaryDirectory(prefix=".wallpaper-sync-", dir=root) as staging:
        for key, (meta, previous, source) in planned.items():
            destination = Path(staging) / f"{key}.webp"
            if source:
                destination.write_bytes(source.read_bytes())
            else:
                download_thumbnail(meta, destination)
            uhd = previous.get("uhd")
            if uhd is None:
                uhd = probe_uhd(meta["urlbase"])
            updated[key] = {
                **previous,
                "title": meta.get("title", "") or "",
                "copyright": meta.get("copyright", "") or "",
                "copyrightlink": meta.get("copyrightlink", "") or "",
                "url": build_url(meta),
                "urlbase": meta["urlbase"],
                "uhd": True if uhd is None else bool(uhd),
            }
        for key in planned:
            destination = thumbnail_path(root, key)
            destination.parent.mkdir(parents=True, exist_ok=True)
            (Path(staging) / f"{key}.webp").replace(destination)
        save_json(root / "data" / "metadata.json", dict(sorted(updated.items())))
    print(f"Synced {len(planned)} photos by Bing archive date; latest: {max(planned)}")


def inspect_archive(images, root=ROOT, checked_at=None):
    """Read-only poll. The report keeps raw source fields, not inferred release times."""
    checked_at = checked_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    records = load_json(root / "data" / "metadata.json")
    seen = load_json(root / "data" / "first-seen.json")
    sources = {}
    observations = []
    for meta in images:
        key = date_key(meta)
        identity = meta.get("urlbase")
        if not identity or key in sources:
            raise ValueError(f"Missing photo identity or duplicate date: {key}")
        if key in records and records[key].get("urlbase") != identity:
            raise ValueError(f"Date {key} belongs to a different photo; refusing to overwrite")
        sources[key] = meta
        previous = seen.get(key)
        if previous and previous["urlbase"] != identity:
            raise ValueError(f"Observed identity changed for {key}")
        observations.append({
            "date": key, "fullstartdate": meta.get("fullstartdate"),
            "enddate": meta.get("enddate"), "urlbase": identity,
            # This is first observed by our poller, not Bing's publication time.
            "first_seen_at": previous["first_seen_at"] if previous else checked_at,
            "already_archived_at_first_seen": previous.get("already_archived_at_first_seen", False)
                if previous else key in records,
        })
    if not sources:
        raise ValueError("Bing API returned no image")
    new_dates = sorted(set(sources) - records.keys())
    repair_dates = sorted(key for key in records
                          if not thumbnail_path(root, key).is_file()
                          or thumbnail_path(root, key).stat().st_size == 0)
    # An older missing thumbnail can be repaired using the stored original URL.
    for key in repair_dates:
        if key not in sources:
            sources[key] = {**records[key], "startdate": key}
    pending = sorted(set(new_dates + repair_dates))
    return {
        "checked_at": checked_at, "latest_source_date": max(date_key(m) for m in images),
        "new_dates": new_dates, "repair_dates": repair_dates,
        "processing_dates": pending, "images": [sources[key] for key in pending],
        "observations": observations,
    }


def record_observations(report, root=ROOT):
    path = root / "data" / "first-seen.json"
    records = load_json(path)
    additions = {row["date"]: row for row in report["observations"] if row["date"] not in records}
    if additions:
        save_json(path, dict(sorted({**records, **additions}.items())))


def write_report(report, path):
    save_json(path, report)
    print(f"Checked at {report['checked_at']}; Bing archive date: {report['latest_source_date']}; "
          f"new: {len(report['new_dates'])}; repair: {len(report['repair_dates'])}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"needs_work={str(bool(report['processing_dates'])).lower()}\n")
            stream.write(f"has_new={str(bool(report['new_dates'])).lower()}\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(f"## Bing archive check\n\nChecked (UTC): {report['checked_at']}\n\n"
                         f"Official archive date: {report['latest_source_date']}\n\n"
                         f"New: {len(report['new_dates'])}; missing thumbnails: {len(report['repair_dates'])}\n\n"
                         "First-seen timestamps are observations, not publication timestamps.\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Poll without downloading images")
    mode.add_argument("--apply-report", type=Path, help="Download pending photos from a saved poll")
    parser.add_argument("--report", type=Path, default=ROOT / ".archive-update/report.json")
    args = parser.parse_args()
    if args.apply_report:
        report = load_json(args.apply_report)
    else:
        report = inspect_archive(fetch_metadata())
        write_report(report, args.report)
    if not args.check and report["images"]:
        sync_wallpapers(report["images"])
    record_observations(report)


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError, OSError, ValueError) as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)
