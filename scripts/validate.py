#!/usr/bin/env python3
"""校验 metadata.json 与 index.json 的结构一致性与数据一致性。

结构校验统一消费 schemas/*.schema.json（与 build.js 的 ajv 同源），
不再手写逐字段检查；跨文件一致性（日期集合、字段值）为业务检查，
schema 表达不了，保留在本文件。

依赖：pip install jsonschema（见 requirements.txt）
"""

import sys
from pathlib import Path

from jsonschema import Draft7Validator

from lib import ROOT, load_json, load_schema

DATA = ROOT / "data"


def validate_against_schema(name: str, data) -> list[str]:
    """按 schema 校验数据，返回错误列表。

    format_checker 与 build.js 的 ajv+ajv-formats 行为对齐
    （否则 format: uri 只在 JS 端生效，两端结果不一致）。
    """
    schema = load_schema(name)
    validator = Draft7Validator(schema, format_checker=Draft7Validator.FORMAT_CHECKER)
    return [
        f"{name}: {list(e.absolute_path) or '<root>'}: {e.message}"
        for e in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    ]


def check_consistency(meta, idx) -> list[str]:
    """跨文件一致性：日期集合互相对齐、共有字段值相等。"""
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
    try:
        meta = load_json(DATA / "metadata.json", default=None)
        idx = load_json(DATA / "index.json", default=None)
    except Exception as e:
        print(f"加载 JSON 失败: {e}", file=sys.stderr)
        return 1

    errors = []
    errors.extend(validate_against_schema("metadata.schema.json", meta))
    errors.extend(validate_against_schema("index.schema.json", idx))
    if not errors:  # 结构不合法时一致性比较无意义
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
