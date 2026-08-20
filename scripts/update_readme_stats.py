#!/usr/bin/env python3
"""自动更新 README 里的「数据规模」统计（总张数 / 含缩略图数 / 时间范围）。

由 .github/workflows/update.yml 在每日 commit 前调用，让 README 的数字随数据变动自动同步。
只精确替换「收录 ... 共 ... 张壁纸（其中 ... 张含缩略图）」这一行，不碰其他内容（幂等安全）。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "index.json"
README = ROOT / "README.md"


def main():
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    dates = sorted(e["date"] for e in idx)
    total = len(idx)
    with_thumb = sum(1 for e in idx if e.get("thumbnail"))
    start = dates[0]
    start_fmt = f"{start[:4]}-{start[4:6]}-{start[6:8]}"  # 20260305 -> 2016-03-05

    text = README.read_text(encoding="utf-8")
    pattern = re.compile(
        r"收录 \*\*\d{4}-\d{2}-\d{2} 至今\*\* 共 \*\*\d+ 张\*\*壁纸（其中 \d+ 张含缩略图）"
    )
    new_line = f"收录 **{start_fmt} 至今** 共 **{total} 张**壁纸（其中 {with_thumb} 张含缩略图）"
    text, n = pattern.subn(new_line, text)
    if n == 0:
        print("warn: README 数据规模行未匹配，跳过更新", file=sys.stderr)
        return
    README.write_text(text, encoding="utf-8")
    print(f"README 数据规模已更新：{start} ~ {dates[-1]} 共 {total} 张（{with_thumb} 含缩略图）")


if __name__ == "__main__":
    main()
