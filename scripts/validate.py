#!/usr/bin/env python3
"""校验 metadata.json 与 index.json 的结构一致性。"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate_metadata(meta):
    errors = []
    if not isinstance(meta, dict):
        return ["metadata.json 必须是对象"]
    for date, item in meta.items():
        if not isinstance(date, str) or len(date) != 8 or not date.isdigit():
            errors.append(f"非法日期 key: {date}")
            continue
        for field in ["title", "url", "urlbase"]:
            if field not in item:
                errors.append(f"{date} 缺少字段 {field}")
        if "uhd" in item and item["uhd"] not in (True, False, None):
            errors.append(f"{date} 的 uhd 字段必须是 boolean 或 null")
    return errors


def validate_index(idx):
    errors = []
    if not isinstance(idx, list):
        return ["index.json 必须是数组"]
    seen = set()
    for item in idx:
        date = item.get("date")
        if not date or len(date) != 8 or not date.isdigit():
            errors.append(f"非法日期: {date}")
        if date in seen:
            errors.append(f"重复日期: {date}")
        seen.add(date)
        for field in ["date", "title"]:
            if field not in item:
                errors.append(f"{date} 缺少字段 {field}")
        if "uhd" in item and item["uhd"] not in (True, False, None):
            errors.append(f"{date} 的 uhd 字段必须是 boolean 或 null")
    return errors


def check_consistency(meta, idx):
    errors = []
    meta_dates = set(meta.keys())
    idx_dates = {item["date"] for item in idx}
    missing_in_idx = meta_dates - idx_dates
    missing_in_meta = idx_dates - meta_dates
    if missing_in_idx:
        errors.append(f"metadata 中有但 index 中缺失: {sorted(missing_in_idx)[:5]}...")
    if missing_in_meta:
        errors.append(f"index 中有但 metadata 中缺失: {sorted(missing_in_meta)[:5]}...")

    idx_map = {item["date"]: item for item in idx}
    for date in meta_dates & idx_dates:
        m = meta[date]
        i = idx_map[date]
        for k in ["title", "copyright", "category", "color", "uhd"]:
            if m.get(k) != i.get(k):
                errors.append(f"{date} 字段 {k} 不一致: metadata={m.get(k)!r} index={i.get(k)!r}")
    return errors


def main():
    meta_path = ROOT / "data" / "metadata.json"
    idx_path = ROOT / "data" / "index.json"

    try:
        meta = load_json(meta_path)
        idx = load_json(idx_path)
    except Exception as e:
        print(f"加载 JSON 失败: {e}", file=sys.stderr)
        return 1

    errors = []
    errors.extend(validate_metadata(meta))
    errors.extend(validate_index(idx))
    errors.extend(check_consistency(meta, idx))

    if errors:
        print(f"发现 {len(errors)} 处错误:")
        for e in errors[:20]:
            print(f"  - {e}")
        return 1

    print(f"校验通过: metadata={len(meta)} index={len(idx)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
