#!/usr/bin/env python3
"""给 data/metadata.json 的每张壁纸打上 分类(category) 与 主色(color) 标签。

分类：基于 标题 + 版权说明 + Bing 搜索词 做中文关键词匹配（启发式，约 80% 准确）。
颜色：用 Pillow 对本地缩略图算主色，归到 9 色 + 多彩 调色板。

默认只给缺失标签的条目补标（幂等、可重复跑）；--force 全量重算。
分类/颜色写回 metadata.json；随后由 generate_index.py 透传到 index.json 供前端筛选。
"""
import json
import os
import re
import sys
from collections import Counter
from urllib.parse import urlparse, parse_qs, unquote

from PIL import Image
import colorsys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
META_PATH = os.path.join(DATA, "metadata.json")

# 优先级从高到低，首个命中即归类
CATEGORY_RULES = [
    ("人物", "人物|女孩|男孩|少女|老人|儿童|婴儿|母子|渔夫|渔民|农夫|农人|僧人|舞者|演员|歌手|工人|士兵|群像|肖像|节庆|庆典|游行|游客|土著|部落|居民|牧民|猎人|山人"),
    ("动物", "鱼|鲸|鲨|海豚|海豹|海狮|海獭|企鹅|鸟|鹰|鹤|鹭|鸭|鹅|鸡|鹿|马|牛|羊|猪|兔|猫|狗|虎|狮|豹|熊|狼|狐|猴|猩|象|熊猫|长颈鹿|斑马|骆驼|羊驼|蟹|虾|龟|蛇|蜥|蛙|蝴蝶|昆虫|蜜蜂|蚂蚁|野生动物|猛禽|海鸟|候鸟|珊瑚|水母|海洋生物|犬|鼠|松鼠|刺猬|蝙蝠|鲸鲨|海星|贝|螺|鳄|河马|犀|麋|狍|貂|鼬|鲑|鳟|金鱼|锦鲤"),
    ("美食", "美食|料理|餐|菜|水果|甜点|糕|咖啡|茶|酒|面包|饮食|佳肴|餐桌|烘焙|食|厨房|宴|火锅|面|米饭|披萨|寿司|草莓|樱桃|苹果|葡萄|瓜|芒果|香蕉|桃|梨"),
    ("交通", "汽车|火车|高铁|地铁|机车|摩托|自行车|公交|卡车|赛车|列车|飞机|航班|船|帆|舰|港|码头|机场|车站|公路|铁路|飞行|驾驶|飞船|热气球"),
    ("建筑", "建筑|寺|庙|塔|桥|城|城堡|古堡|宫|殿|教堂|大教堂|清真寺|楼|阁|钟楼|广场|遗迹|遗址|废墟|博物馆|大学|图书馆|灯塔|宫殿|庭院|园林|古镇|村落|村庄|村|都市|城市|天际线|摩天|大厦|剧院|体育馆|水坝|工厂|市集|城墙|窑洞|土楼|木屋|亭|牌坊|石窟|道观|风车|水车|粮仓|塔楼"),
    ("太空", "星|银河|星系|宇宙|太空|天文|流星|彗星|星云|黑洞|行星|日食|月食|航天|卫星|火箭|月球"),
    ("植物", "花卉|鲜花|花海|花田|樱花|荷花|莲花|牡丹|玫瑰|郁金香|向日葵|梅花|兰花|菊花|竹|枫|红叶|芦苇|蕨|仙人掌|绿植|草木|树叶|草坪|油菜花|麦田|森林|树林|草原"),
    ("抽象艺术", "抽象|艺术|画|绘|雕塑|几何|光影|花纹|图案|涂鸦|插画|画作|油画|水彩|壁画|装置|像素|极简"),
    ("风景", "山|水|河|湖|江|溪|瀑|瀑布|池|塘|潭|泉|峰|岭|崖|谷|峡|岛|屿|岸|滩|湾|礁|沙|漠|丘|陵|原|野|田|林|园|景|光|霞|云|雾|雪|冰|霜|春|夏|秋|冬|彩|极光|自然|风光|风景|田园|麦|稻|油菜|岩|洞|溶|湿|沼|公园|保护|牧|梯田|茶园|秋叶|海岸|海岛|雪山|冰川|火山|温泉|地貌|沙丘|雅丹|喀斯特|石林|丘陵|溪流|喷泉|池塘|旷野|荒野|丛林|雨林|月亮|日落|日出|霞光"),
]
CATEGORY_RES = [(c, re.compile(p)) for c, p in CATEGORY_RULES]

# 9 色调色板 + 多彩（文档用）
COLORS = ["蓝", "绿", "红", "黄", "橙", "紫", "粉", "棕", "灰白", "多彩"]

# 7 个色相桶（棕用 橙/黄 + 低明度特判，灰白用低饱和特判）
HUE_NAMES = ["红", "橙", "黄", "绿", "蓝", "紫", "粉"]

MAX_WORKERS = 8


def _hue_index(hh, v):
    """把色相(0-360)映射到 7 个色相桶索引；返回 None 表示低饱和不计入。"""
    if hh < 15 or hh >= 345:
        return 0   # 红
    if hh < 45:
        return 1   # 橙
    if hh < 70:
        return 2   # 黄
    if hh < 160:
        return 3   # 绿
    if hh < 255:
        return 4   # 蓝
    if hh < 290:
        return 5   # 紫
    return 6       # 粉


def search_term(link):
    try:
        q = parse_qs(urlparse(link or "").query).get("q", [""])[0]
        return unquote(q)
    except Exception:
        return ""


def classify_category(m):
    hay = " ".join([
        m.get("title", "") or "",
        m.get("copyright", "") or "",
        search_term(m.get("copyrightlink", "")),
    ])
    for cat, rx in CATEGORY_RES:
        if rx.search(hay):
            return cat
    return "其他"


def color_of(path):
    """返回缩略图主色分桶；文件缺失/异常返回 None。

    用平均色相决定主色；高饱和像素占比过低 → 灰白；主色相占比不高 → 多彩。
    """
    try:
        with Image.open(path) as im:
            px = list(im.convert("RGB").resize((48, 27)).getdata())
    except Exception:
        return None
    n = len(px)
    if n == 0:
        return None
    sr = sg = sb = 0
    hue_bins = [0] * 7
    sat_count = 0
    for r, g, b in px:
        sr += r
        sg += g
        sb += b
        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        if s >= 0.15:
            sat_count += 1
            idx = _hue_index(h * 360, v)
            if idx is not None:
                hue_bins[idx] += 1
    # 平均色（用于灰白/棕判定）
    ar, ag, ab = sr / n / 255.0, sg / n / 255.0, sb / n / 255.0
    _, asat, av = colorsys.rgb_to_hsv(ar, ag, ab)
    # 整体偏灰/去饱和 → 灰白
    if asat < 0.15 or sat_count / n < 0.35:
        return "灰白"
    if sat_count == 0:
        return "灰白"
    best = max(hue_bins)
    best_idx = hue_bins.index(best)
    frac = best / sat_count
    if frac < 0.45:
        return "多彩"
    color = HUE_NAMES[best_idx]
    if color in ("橙", "黄") and av < 0.5:
        return "棕"
    return color


def thumb_path(date):
    y, mo = date[:4], date[4:6]
    return os.path.join(ROOT, "thumbnails", y, mo, date + ".jpg")


def main():
    force = "--force" in sys.argv[1:]
    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)

    # 分类（主进程，快）
    cat_done = 0
    for date, m in meta.items():
        if force or not m.get("category"):
            m["category"] = classify_category(m)
            cat_done += 1

    # 颜色（多进程算缩略图主色）
    jobs = []
    for date, m in meta.items():
        if force or not m.get("color"):
            jobs.append((date, thumb_path(date)))
    color_map = {}
    if jobs:
        from multiprocessing import Pool
        with Pool(MAX_WORKERS) as pool:
            for date, col in pool.starmap(_color_worker, jobs):
                color_map[date] = col
    color_done = 0
    for date, m in meta.items():
        if date in color_map:
            m["color"] = color_map[date]
            color_done += 1

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    cat_counter = Counter(m.get("category", "其他") for m in meta.values())
    col_counter = Counter((m.get("color") or "无缩略图") for m in meta.values())
    print(f"分类补标 {cat_done} 条；颜色补标 {color_done} 条（共 {len(meta)} 条）")
    print("分类分布：", dict(cat_counter.most_common()))
    print("颜色分布：", dict(col_counter.most_common()))


def _color_worker(date, path):
    return date, color_of(path)


if __name__ == "__main__":
    main()
