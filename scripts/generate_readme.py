#!/usr/bin/env python3
"""Regenerate README.md stats from data/index.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    items = json.loads((ROOT / "data" / "index.json").read_text(encoding="utf-8") or "[]")
    total = len(items)
    with_thumb = sum(1 for i in items if i.get("thumbnail"))
    missing = total - with_thumb
    first = items[0]["date"] if items else "?"
    last = items[-1]["date"] if items else "?"

    readme = f"""# Bing 每日壁纸归档

自动抓取 Bing 每日壁纸（市场 zh-CN），轻量归档：**缩略图缓存 + 每日元数据 + 相对 Bing 下载全图**。

- 共 **{total}** 张（{first} → {last}）
- 已生成缩略图 **{with_thumb}** 张，待补 **{missing}** 张
  （历史图缺缩略图时画廊显示占位，点开仍可直连 Bing 原图）
- 全尺寸原图 **不入库**，按需从 Bing CDN 获取

## 目录结构

```
data/index.json        完整索引（date / title / copyright / thumbnail / url / urlbase）
data/metadata.json     原始抓取元数据（去重用）
thumbnails/            已提交缩略图缓存（480x270）
wallpapers/            本机全图缓存（gitignore，不入库）
scripts/               download / download_full / generate_index / thumbnails / check_archive
```

## 本地使用

```bash
pip install -r requirements.txt
python scripts/download.py                  # 抓当日壁纸（全图存 wallpapers/，更新元数据+缩略图）
python scripts/download_full.py 20260817    # 按日期从 Bing 下载全图到本机
python scripts/download_full.py 20260101 20260817   # 下载一段区间
python scripts/download_full.py all         # 下载索引里所有日期（注意：~GB 级，不入库）
python scripts/thumbnails.py                # 生成/重生成缩略图（默认只补缺失；--force 覆盖全部）
python scripts/check_archive.py             # 校验索引引用的缩略图是否齐全（CI 防回归）
```

数据来源：Bing 每日壁纸；历史元数据整合自
[Zhu-junwei/bing-wallpaper-archive](https://github.com/Zhu-junwei/bing-wallpaper-archive)。
"""
    (ROOT / "README.md").write_text(readme, encoding="utf-8")
    print(f"README updated: {total} entries ({with_thumb} with thumbnail)")


if __name__ == "__main__":
    main()
