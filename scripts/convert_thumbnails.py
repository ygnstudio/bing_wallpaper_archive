#!/usr/bin/env python3
"""
批量将 thumbnails/ 下的 jpg 转换为 webp，输出到目标目录。
仅处理新增或修改的文件，保持增量更新；支持并发以加速 CI/本地构建。
"""

import sys
import os
from pathlib import Path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('site/thumbnails')
DST = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('dist/thumbnails')
QUALITY = int(sys.argv[3]) if len(sys.argv) > 3 else 80
METHOD = int(sys.argv[4]) if len(sys.argv) > 4 else 4
JOBS = int(sys.argv[5]) if len(sys.argv) > 5 else max(1, cpu_count() - 1)


def convert_one(args):
    src, dst, quality, method = args
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return ('skip', src.relative_to(SRC))
    try:
        with Image.open(src) as im:
            im.save(dst, 'WEBP', quality=quality, method=method)
        return ('ok', src.relative_to(SRC))
    except Exception as e:
        return ('err', src.relative_to(SRC), str(e))


def main():
    files = list(SRC.rglob('*.jpg'))
    if not files:
        print('[webp] no jpg files found')
        return

    tasks = [(src, DST / src.relative_to(SRC).with_suffix('.webp'), QUALITY, METHOD)
             for src in files]

    done = 0
    skipped = 0
    errors = 0

    if JOBS <= 1:
        # 单进程模式（Windows fork 受限或调试时使用）
        for task in tasks:
            result = convert_one(task)
            if result[0] == 'ok':
                done += 1
                print(f'[webp] {result[1]}')
            elif result[0] == 'skip':
                skipped += 1
            else:
                errors += 1
                print(f'[err] {result[1]}: {result[2]}', file=sys.stderr)
    else:
        with ProcessPoolExecutor(max_workers=JOBS) as executor:
            futures = {executor.submit(convert_one, t): t for t in tasks}
            for future in as_completed(futures):
                result = future.result()
                if result[0] == 'ok':
                    done += 1
                    print(f'[webp] {result[1]}')
                elif result[0] == 'skip':
                    skipped += 1
                else:
                    errors += 1
                    print(f'[err] {result[1]}: {result[2]}', file=sys.stderr)

    print(f'[webp] done={done} skipped={skipped} errors={errors} total={len(files)}')


if __name__ == '__main__':
    main()
