#!/usr/bin/env python3
"""
批量将 site/thumbnails/ 下的 jpg 转换为 webp，输出到目标目录。
仅处理新增或修改的文件，保持增量更新。
"""

import sys
import os
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('site/thumbnails')
DST = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('dist/thumbnails')
QUALITY = int(sys.argv[3]) if len(sys.argv) > 3 else 80


def main():
    files = list(SRC.rglob('*.jpg'))
    for src in files:
        rel = src.relative_to(SRC)
        dst = DST / rel.with_suffix('.webp')
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        try:
            with Image.open(src) as im:
                im.save(dst, 'WEBP', quality=QUALITY, method=6)
            print(f'[webp] {rel}')
        except Exception as e:
            print(f'[err] {rel}: {e}', file=sys.stderr)


if __name__ == '__main__':
    main()
