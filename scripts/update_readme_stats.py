#!/usr/bin/env python3
"""只更新 README 的 archive-stats 托管区；链接、简介和部署说明由人工维护。"""
import re

from lib import ROOT, load_json

INDEX = ROOT / "data" / "index.json"
README = ROOT / "README.md"
START = "<!-- archive-stats:start -->"
END = "<!-- archive-stats:end -->"


def render_stats(text, idx):
    if not idx:
        raise ValueError("壁纸索引为空，保留原 README")
    if text.count(START) != 1 or text.count(END) != 1:
        raise ValueError("README 必须包含唯一的 archive-stats 托管区，保留原文件")
    dates = sorted(e["date"] for e in idx)
    start = dates[0]
    start_fmt = f"{start[:4]}-{start[4:6]}-{start[6:8]}"
    with_thumb = sum(1 for e in idx if e.get("thumbnail"))
    line = f"- 收录 **{start_fmt} 至今** 共 **{len(idx)} 张**壁纸（其中 {with_thumb} 张含缩略图）。"
    pattern = re.compile(re.escape(START) + r"[\s\S]*?" + re.escape(END))
    updated, count = pattern.subn(f"{START}\n{line}\n{END}", text)
    if count != 1:
        raise ValueError("README 托管区边界顺序错误，保留原文件")
    return updated


def main():
    idx = load_json(INDEX, default=[])
    text = README.read_text(encoding="utf-8")
    updated = render_stats(text, idx)
    README.write_text(updated, encoding="utf-8")
    print(f"README 数据规模已更新：共 {len(idx)} 张；托管区以外内容保持不变")


if __name__ == "__main__":
    main()
