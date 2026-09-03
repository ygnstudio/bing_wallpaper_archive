#!/usr/bin/env python3
"""增量探测壁纸的 4K(UHD) 可用性，低并发 + 退避，避免触发 Bing 限流。"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock, Semaphore

from lib import HEADERS, ROOT, load_json, save_json

META = ROOT / "data" / "metadata.json"
H = HEADERS
CONC = 2
MIN_GAP = 1.0
TIMEOUT = 15  # 探测场景刻意用短超时，与 lib.TIMEOUT(30) 不同
MAX_RETRY = 4
SAVE_EVERY = 100

lock = Lock()
sem = Semaphore(1)
cooldown_until = 0.0


def rate_limited():
    """全局节奏控制 + 限流冷却。"""
    global cooldown_until
    sem.acquire()
    try:
        now = time.time()
        wait = max(0.0, cooldown_until - now)
        if wait > 0:
            time.sleep(wait)
        gap = max(0.0, MIN_GAP - (time.time() - now))
        if gap > 0:
            time.sleep(gap)
    finally:
        sem.release()


def probe(urlbase):
    """探测某 urlbase 是否有 UHD 版本。"""
    global cooldown_until
    if not urlbase:
        return None
    u = "https://www.bing.com" + urlbase + "_UHD.jpg"
    for attempt in range(MAX_RETRY):
        rate_limited()
        try:
            req = urllib.request.Request(u, headers=H, method="HEAD")
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return True if r.status in (200, 206) else None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            with lock:
                cooldown_until = max(cooldown_until, time.time() + 45)
            time.sleep(2 * attempt)
            continue
        except (urllib.error.URLError, OSError, ValueError):
            time.sleep(1.5 * (attempt + 1))
            continue
    return None


def load_meta():
    return load_json(META)


def save_meta(meta):
    save_json(META, meta)


def stats(meta):
    yes = sum(1 for v in meta.values() if v.get("uhd") is True)
    no = sum(1 for v in meta.values() if v.get("uhd") is False)
    none = sum(1 for v in meta.values() if "uhd" not in v)
    return yes, no, none


def main(force_all=False):
    meta = load_meta()
    if not meta:
        print("metadata.json 为空或不存在", file=sys.stderr)
        return 1

    pending = [d for d, v in meta.items() if force_all or "uhd" not in v]
    pending.sort()
    if not pending:
        print("没有需要探测的图片")
        return 0

    print(f"待探测: {len(pending)} 张", flush=True)
    done = 0

    def worker(d):
        nonlocal done
        res = probe(meta[d].get("urlbase", ""))
        if res is not None:
            meta[d]["uhd"] = bool(res)
        with lock:
            done += 1
            if done % SAVE_EVERY == 0 or done == len(pending):
                save_meta(meta)
                print(f"[{done}/{len(pending)}] yes={stats(meta)[0]} no={stats(meta)[1]} none={stats(meta)[2]}", flush=True)

    with ThreadPoolExecutor(max_workers=CONC) as ex:
        list(ex.map(worker, pending))

    save_meta(meta)
    yes, no, none = stats(meta)
    print(f"完成: yes={yes} no={no} none={none}", flush=True)
    return 0


if __name__ == "__main__":
    force_all = "--force" in sys.argv or "-f" in sys.argv
    sys.exit(main(force_all))
