#!/usr/bin/env python3
"""校验 data/index.json 的完整性。

- 每条带 `thumbnail` 的索引项，其对应缩略图文件必须存在于磁盘
- 统计总条目、含缩略图数、缺图数、缺 date 字段数
- 缺图时退出码 1（可用于 CI 防回归），全部存在则退出码 0

用法:
    python scripts/check_archive.py
    python scripts/check_archive.py --index data/index.json --root .
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description="校验 index.json 缩略图完整性")
    ap.add_argument("--index", default="data/index.json", help="索引文件路径（相对 root）")
    ap.add_argument("--root", default=".", help="仓库根目录")
    args = ap.parse_args()

    root = Path(args.root)
    index_path = root / args.index
    if not index_path.exists():
        print(f"ERROR: 索引文件不存在: {index_path}")
        return 2

    items = json.loads(index_path.read_text(encoding="utf-8"))
    total = len(items)
    with_thumb = 0
    missing = []
    bad_dates = []

    for it in items:
        if not it.get("date"):
            bad_dates.append(it)
        if it.get("thumbnail"):
            with_thumb += 1
            p = root / it["thumbnail"].lstrip("./")
            if not p.exists():
                missing.append(it.get("date", "<no-date>"))

    print(f"总条目    : {total}")
    print(f"含缩略图  : {with_thumb}")
    if bad_dates:
        print(f"缺 date   : {len(bad_dates)}")
    print(f"缺缩略图  : {len(missing)}")

    if missing:
        print("--- 缺图清单（前 30）---")
        for d in missing[:30]:
            print("   ", d)
        if len(missing) > 30:
            print(f"   ... 共 {len(missing)} 条")
        return 1

    print("OK: 所有缩略图均存在。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
