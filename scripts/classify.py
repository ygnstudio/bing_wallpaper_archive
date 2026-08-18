#!/usr/bin/env python3
"""给 data/metadata.json 的每张壁纸打上 分类(category) 与 主色(color) 标签。

分类：基于 标题 + 版权说明 + Bing 搜索词 做中文关键词匹配。
     用「最长关键词命中优先」打分，且「动物」类只认 >=2 字的词，避免
     单字（马/牛/鱼/鸟/猴…）误伤地名/树名（马耳他、马更些河、猴面包树…）。
颜色：用 Pillow 中位切分(median-cut)量化出主色，再按「鲜艳色相」归桶；
     灰白/棕/多彩分别用 饱和度/明度/色相占比 特判，替代原来的平均色相。

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

# 分类关键词（按优先级从高到低；实际判定用「最长命中」，见 classify_category）
CATEGORY_RULES = [
    ("人物", "人物|女孩|男孩|少女|少年|老人|儿童|婴儿|母子|母女|父子|渔夫|渔民|农夫|农人|僧人|僧侣|舞者|演员|歌手|工人|士兵|群像|肖像|节庆|庆典|游行|游客|土著|部落|居民|牧民|猎人|山人|人群|人们|一家人|家庭|孩子|小孩|摄影师的模特"),
    ("动物", "海蛞蝓|蛞蝓|鬣蜥|海鬣蜥|猫头鹰|角鸮|雕鸮|雪鸮|林鸮|长耳鸮|短耳鸮|仓鸮|草鸮|水獭|海獭|甲虫|瓢虫|蜻蜓|壁虎|变色龙|树懒|浣熊|河豚|鳐|魟|章鱼|乌贼|鱿鱼|座头鲸|蓝鲸|虎鲸|海马|海龙|海牛|儒艮|象龟|陆龟|鹦鹉|火烈鸟|鹈鹕|翠鸟|蜂鸟|啄木鸟|天鹅|朱鹮|丹顶鹤|苍鹭|白鹭|孔雀|锦鸡|雉|鸳鸯|海鸥|信天翁|角马|羚羊|狒狒|大猩猩|黑猩猩|狐獴|猫鼬|穿山甲|犰狳|袋鼠|考拉|树袋熊|负鼠|豪猪|麋鹿|驼鹿|驯鹿|梅花鹿|野猪|山羊|绵羊|牦牛|水牛|野牛|非洲象|亚洲象|北极熊|棕熊|黑熊|灰狼|赤狐|雪豹|猎豹|美洲狮|山猫|猞猁|鬣狗|海狮|海豹|海象|海豚|企鹅|鲸|鲨|鲸鲨|海豚|鹰|猫头鹰|鹤|鹭|鸭|鹅|鸡|鹿|马|牛|羊|猪|兔|猫|狗|虎|狮|豹|熊|狼|狐|猴|猩|象|熊猫|长颈鹿|斑马|骆驼|羊驼|蟹|虾|龟|蛇|蜥|蛙|蝴蝶|昆虫|蜜蜂|蚂蚁|野生动物|猛禽|海鸟|候鸟|珊瑚|水母|海洋生物|犬|鼠|松鼠|刺猬|蝙蝠|海星|贝|螺|鳄|河马|犀|麋|狍|貂|鼬|鲑|鳟|金鱼|锦鲤|热带鱼|鱼群|鱼"),
    ("美食", "美食|料理|餐|菜|水果|甜点|糕|咖啡|茶|酒|面包|饮食|佳肴|餐桌|烘焙|食|厨房|宴|火锅|面|米饭|披萨|寿司|草莓|樱桃|苹果|葡萄|瓜|芒果|香蕉|桃|梨|柑橘|橙子|柠檬|西瓜|甜瓜|食材|菜肴|烹饪|食谱|下午茶|啤酒|红酒|香槟|奶酪|巧克力"),
    ("交通", "汽车|火车|高铁|地铁|机车|摩托|自行车|公交|卡车|赛车|列车|飞机|航班|船|帆|舰|港|码头|机场|车站|公路|铁路|飞行|驾驶|飞船|热气球|缆车|邮轮|轮渡|直升机|滑翔机|独木舟|皮划艇"),
    ("建筑", "建筑|寺|庙|塔|桥|城|城堡|古堡|宫|殿|教堂|大教堂|清真寺|楼|阁|钟楼|广场|遗迹|遗址|废墟|博物馆|大学|图书馆|灯塔|宫殿|庭院|园林|古镇|村落|村庄|村|都市|城市|天际线|摩天|大厦|剧院|体育馆|水坝|工厂|市集|城墙|窑洞|土楼|木屋|亭|牌坊|石窟|道观|风车|水车|粮仓|塔楼|纪念碑|陵墓|陵园|墓碑|墓地|石像|雕像|拱门|柱廊|门廊|城楼|烽火台|水塔|电视塔|观景台|摩崖|石刻|城门|堡垒|要塞"),
    ("太空", "星|银河|星系|宇宙|太空|天文|流星|彗星|星云|黑洞|行星|日食|月食|航天|卫星|火箭|月球|星轨|星野|星座|天文台"),
    ("植物", "猴面包树|薰衣草|向日葵|樱花|荷花|莲花|牡丹|玫瑰|郁金香|梅花|兰花|菊花|杜鹃|山茶|紫藤|鼠尾草|苔藓|蘑菇|蕨类|海草|海藻|花卉|鲜花|花海|花田|竹|枫|红叶|芦苇|仙人掌|绿植|草木|树叶|草坪|油菜花|麦田|森林|树林|草原|棕榈|椰树|橄榄树|枫树|橡树|桦树|松树|柏树|红杉|巨杉|桉树|杨柳|柳树|菩提|多肉|竹子|银杏|樱花树|薰衣草田|花园|植物园"),
    ("抽象艺术", "抽象|艺术|画|绘|雕塑|几何|光影|花纹|图案|涂鸦|插画|画作|油画|水彩|壁画|装置|像素|极简"),
    ("风景", "山|水|河|湖|江|溪|瀑|瀑布|池|塘|潭|泉|峰|岭|崖|谷|峡|岛|屿|岸|滩|湾|礁|沙|漠|丘|陵|原|野|田|林|园|景|光|霞|云|雾|雪|冰|霜|春|夏|秋|冬|彩|极光|自然|风光|风景|田园|麦|稻|油菜|岩|洞|溶|湿|沼|公园|保护|牧|梯田|茶园|秋叶|海岸|海岛|雪山|冰川|火山|温泉|地貌|沙丘|雅丹|喀斯特|石林|丘陵|溪流|喷泉|池塘|旷野|荒野|丛林|雨林|月亮|日落|日出|霞光"),
]
CATEGORY_RES = [(c, re.compile(p)) for c, p in CATEGORY_RULES]

# 9 色调色板 + 多彩（前端下拉用）
COLORS = ["蓝", "绿", "红", "黄", "橙", "紫", "粉", "棕", "灰白", "多彩"]

# 7 个色相桶（棕用 橙/黄 + 低明度特判，灰白用低饱和特判）
HUE_NAMES = ["红", "橙", "黄", "绿", "蓝", "紫", "粉"]

MAX_WORKERS = 8


def _hue_index(hh, v):
    """把色相(0-360)映射到 7 个色相桶索引。"""
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
    """最长关键词命中优先；「动物」只认 >=2 字，规避单字误伤地名/树名。"""
    hay = " ".join([
        m.get("title", "") or "",
        m.get("copyright", "") or "",
        search_term(m.get("copyrightlink", "")),
    ])
    best_cat = "其他"
    best_len = 0
    for cat, rx in CATEGORY_RES:
        for mm in rx.finditer(hay):
            w = mm.group(0)
            L = len(w)
            if cat in ("动物", "美食") and L < 2:
                continue  # 单字动物/食物词易误伤地名（马耳他/厄瓜多尔…）
            if L > best_len:
                best_len = L
                best_cat = cat
    return best_cat


def color_of(path):
    """返回缩略图主色分桶；文件缺失/异常返回 None。

    用中位切分量化出 ~16 个主色，按像素数加权，取「鲜艳」主色的色相；
    灰白/棕/多彩分别用 饱和度占比 / 暗橙占比 / 色相分散度 特判。
    """
    try:
        with Image.open(path) as im:
            im = im.convert("RGB").resize((64, 36))
    except Exception:
        return None
    try:
        q = im.quantize(colors=16, method=Image.MEDIANCUT)
        counts = q.getcolors()
        pal = q.getpalette()
    except Exception:
        return None
    if not counts or not pal:
        return None
    total = sum(c for c, _ in counts)
    hue_bins = [0.0] * 7
    sat_total = 0.0
    brown = 0.0
    for count, idx in counts:
        r, g, b = pal[idx * 3], pal[idx * 3 + 1], pal[idx * 3 + 2]
        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        # 跳过 灰/黑/白/极亮（不做主色）
        if s < 0.15 or v < 0.08 or v > 0.97:
            continue
        sat_total += count
        hh = h * 360
        bi = _hue_index(hh, v)
        hue_bins[bi] += count
        # 棕：橙/黄区 + 中低明度 + 中等饱和（放宽 s>=0.18 以涵盖皮毛/沙漠的灰棕）
        if 12 <= hh < 55 and 0.22 <= v < 0.68 and s >= 0.18:
            brown += count

    if total == 0 or sat_total / total < 0.03:
        return "灰白"
    best = max(hue_bins)
    if best == 0:
        return "灰白"
    bi = hue_bins.index(best)
    frac = best / sat_total
    if frac < 0.45:
        return "多彩"
    # 棕特判：主色落在暗橙/黄且棕系占比高
    if bi in (1, 2) and brown / sat_total > 0.4:
        return "棕"
    return HUE_NAMES[bi]


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
