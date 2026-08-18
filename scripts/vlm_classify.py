#!/usr/bin/env python3
"""用 Qwen2-VL 视觉语言模型给壁纸分类（图文一起读），定向回填弱信号条目。

默认只重判「弱信号」条目：
  - category == 其他（关键词没匹配上）
  - 或 关键词最佳匹配只有 1 个字（野/城/塔/港… 这类最容易误伤地名）

2 字及以上的强匹配（海豚/城堡/雪山…）大多正确，保留不动。

用法：
  python scripts/vlm_classify.py              # 定向重判弱信号
  python scripts/vlm_classify.py --all        # 全量重判
  python scripts/vlm_classify.py --category X # 只重判某类

模型：默认用本地 ModelScope 缓存；环境变量 VLM_MODEL_DIR 可覆盖（CI 用）。
"""
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META_PATH = os.path.join(ROOT, "data", "metadata.json")

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import classify  # noqa: E402
from classify import CATEGORY_RES, search_term  # noqa: E402

MODEL_DIR = os.environ.get("VLM_MODEL_DIR") or (
    os.path.expanduser("~/.cache/modelscope/models/Qwen--Qwen2-VL-2B-Instruct/snapshots/master")
)

LABELS = ["人物", "动物", "美食", "交通", "建筑", "太空", "植物", "抽象艺术", "风景", "其他"]


def keyword_match_len(m):
    """返回关键词最佳匹配长度（0 = 未匹配）。"""
    hay = " ".join([
        m.get("title", "") or "",
        m.get("copyright", "") or "",
        search_term(m.get("copyrightlink", "")),
    ])
    best = 0
    for cat, rx in CATEGORY_RES:
        for mm in rx.finditer(hay):
            L = len(mm.group(0))
            if cat in ("动物", "美食", "建筑") and L < 2:
                continue
            if L > best:
                best = L
    return best


def load_model():
    import torch
    from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
    model = Qwen2VLForConditionalGeneration.from_pretrained(MODEL_DIR, torch_dtype=torch.float32)
    processor = AutoProcessor.from_pretrained(MODEL_DIR)
    model.eval()
    return model, processor


def build_classifier(model, processor):
    from qwen_vl_utils import process_vision_info

    def classify(image_path, title, copyright):
        prompt = (
            f"这是一张 Bing 每日壁纸。标题：「{title}」。版权描述：「{copyright}」。"
            "请结合图片和文字，判断这张图最属于哪个分类。"
            "可选：人物、动物、美食、交通、建筑、太空、植物、抽象艺术、风景、其他。"
            "只输出一个分类名称，不要解释。"
        )
        messages = [{"role": "user", "content": [
            {"type": "image", "image": f"file://{image_path}"},
            {"type": "text", "text": prompt},
        ]}]
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, _ = process_vision_info(messages)
        inputs = processor(text=[text], images=image_inputs, padding=True, return_tensors="pt")
        import torch
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=16, do_sample=False)
        ans = processor.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
        for lab in LABELS:
            if lab in ans:
                return lab
        return "其他"

    return classify


def thumb_path(date):
    y, mo = date[:4], date[4:6]
    return os.path.join(ROOT, "thumbnails", y, mo, date + ".jpg")


def main():
    args = sys.argv[1:]
    mode_all = "--all" in args
    only_cat = None
    if "--category" in args:
        only_cat = args[args.index("--category") + 1]

    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)

    # 选目标
    targets = []
    for date, m in meta.items():
        if mode_all:
            targets.append(date)
        elif only_cat:
            if m.get("category") == only_cat:
                targets.append(date)
        else:
            # 定向：其他 或 单字弱信号
            if m.get("category") == "其他" or keyword_match_len(m) <= 1:
                targets.append(date)

    print(f"待重判 {len(targets)} 条（总 {len(meta)} 条）", flush=True)

    model, processor = load_model()
    clf = build_classifier(model, processor)

    changed = 0
    for i, date in enumerate(targets, 1):
        m = meta[date]
        img = thumb_path(date)
        if not os.path.exists(img):
            continue
        old = m.get("category")
        new = clf(img, m.get("title", ""), m.get("copyright", ""))
        if new != old:
            m["category"] = new
            changed += 1
        if i % 20 == 0 or i == len(targets):
            print(f"  {i}/{len(targets)}  已改 {changed}", flush=True)

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    from collections import Counter
    dist = Counter(m.get("category", "其他") for m in meta.values())
    print(f"完成：重判 {len(targets)} 条，改判 {changed} 条", flush=True)
    print("分类分布：", dict(dist.most_common()), flush=True)


if __name__ == "__main__":
    main()
