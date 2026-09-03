#!/usr/bin/env python3
"""scripts 公共模块：项目根、HTTP 常量、JSON 读写、schema 加载。

各脚本统一从这里导入，避免 ROOT/UA/超时/JSON 读写各自实现（此前
8 个脚本有 3 种 ROOT 写法、2 种 UA 常量、损坏保护只在一处存在）。
"""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schemas"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
HEADERS = {"User-Agent": UA, "Referer": "https://www.bing.com/"}
TIMEOUT = 30


def load_json(p: Path, default=None):
    """读取 JSON 数据文件。

    文件损坏时直接抛错中止，而不是返回 {}：
    下游会把新记录合并进返回值后整体写回，若此处静默返回空对象，
    一次损坏 + 一次成功写入就会清空全部历史数据。

    default：文件不存在时的返回值（默认 {}）。
    """
    if default is None:
        default = {}
    if not Path(p).exists():
        return default
    try:
        return json.loads(Path(p).read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError as e:
        raise ValueError(f"{p} 内容损坏，中止以防覆盖清空历史数据（请手工修复或恢复该文件）：{e}") from e


def save_json(p: Path, obj) -> None:
    """原子写 JSON：先写临时文件再 rename，避免写盘中途崩溃损坏数据。"""
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def http_get(url: str, *, headers: dict | None = None, timeout: int = TIMEOUT,
             retries: int = 3, backoff: float = 2.0) -> bytes:
    """GET 请求，失败按指数退避重试。返回响应体 bytes。"""
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 网络/HTTP 错误统一重试
            last_exc = e
            if attempt < retries - 1:
                time.sleep(backoff ** attempt)
    raise last_exc  # type: ignore[misc]


def load_schema(name: str) -> dict:
    """加载 schemas/ 下的 JSON Schema 文件（如 "metadata.schema.json"）。"""
    return json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))
