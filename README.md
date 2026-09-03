# Bing 每日壁纸归档

自动归档必应（Bing）每日壁纸的轻量站点：每日抓取 → 自动打标签 → 生成缩略图 → GitHub Pages 展示。支持分类/颜色筛选、全文搜索、原图查看、批量打包下载。

🌐 **在线地址**：<https://ygnstudio.github.io/bing_wallpaper_archive/>

## 功能特性

- **每日自动更新**：GitHub Actions 每天 09:00（北京时间）自动抓取 Bing 最新壁纸，全自动、零人工。
- **分类筛选**：10 类 —— 人物 / 动物 / 美食 / 交通 / 建筑 / 太空 / 植物 / 抽象艺术 / 风景 / 其他。
- **颜色筛选**：10 色 —— 蓝 / 绿 / 红 / 黄 / 橙 / 紫 / 粉 / 棕 / 灰白 / 多彩，基于缩略图主色自动计算。
- **多维检索**：按标题 / 版权 / 日期全文搜索，年份、月份、分类、颜色下拉可任意叠加。
- **原图查看**：灯箱查看原图，支持 1080p / UHD 4K 分辨率切换、复制原图直链。
- **批量下载**：勾选 2 张及以上打包成 ZIP（纯前端实现，无压缩、免第三方库）；选 1 张则直接下载原图。
- **纯静态、零后端**：前端原生 HTML/CSS/JS，托管 GitHub Pages，无数据库、无框架、无服务端。

## 数据规模

- 收录 **2016-03-05 至今** 共 **3834 张**壁纸（其中 3834 张含缩略图）。
- **每日自动更新**：每天由 GitHub Actions 抓取最新壁纸入库，总量持续增长。
- 数据源：Bing 官方 `HPImageArchive` API（`mkt=zh-CN`）。

## 目录结构

```
bing_wallpaper_archive/
├── data/                      # 数据
│   ├── metadata.json          #   全量元数据（标题/版权/url/urlbase/uhd/分类/颜色）
│   ├── index.json             #   轻量站点索引（前端首屏直接读取）
│   └── YYYY.json              #   按年份存放的完整数据（懒加载）
├── thumbnails/                # 缩略图（按 YYYY/MM/ 存放，480×270，webp）
├── site/                      # 前端源码（原生 HTML/CSS/JS）
│   ├── index.html / about.html
│   └── assets/                #   JS/CSS 模块、Service Worker、Web Worker
├── scripts/                   # Python / Node 脚本
│   ├── download.py            #   每日抓取最新壁纸并生成缩略图
│   ├── classify.py            #   关键词分类 + Pillow 主色提取
│   ├── vlm_classify.py        #   Qwen2-VL 视觉语言模型精修分类
│   ├── generate_index.py      #   由 metadata.json 重建 index.json
│   ├── detect_uhd.py          #   4K（UHD）可用性探测
│   ├── validate.py            #   JSON Schema 数据校验
│   ├── check_archive.py       #   缩略图完整性检查
│   ├── convert_thumbnails.py  #   jpg → webp 批量转换（外部数据导入时用）
│   ├── update_readme_stats.py #   自动同步 README 数据规模
│   └── build.js               #   Rollup 构建站点到 dist/
├── schemas/                   # JSON Schema
│   ├── metadata.schema.json
│   └── index.schema.json
├── tests/                     # 单元测试
│   └── unit.test.js
└── .github/workflows/         # GitHub Actions
    ├── update.yml             #   每日自动更新
    ├── detect-uhd.yml         #   每周 4K 可用性探测
    └── pages.yml              #   Pages 构建部署
```

## 自动更新流程

每天 09:00（北京时间）由 GitHub Actions 触发：

```mermaid
flowchart LR
    A[download.py<br>抓取最新壁纸] --> B[classify.py<br>打分类/颜色标签]
    B --> B2[vlm_classify.py<br>VLM 精修分类]
    B2 --> D[detect_uhd.py<br>探测 4K 可用性]
    D --> C[generate_index.py<br>重建站点索引]
    C --> E[update_readme_stats.py<br>同步 README 数据]
    E --> F[check_archive.py<br>校验缩略图]
    F --> G[提交并推送]
    G --> H[pages.yml<br>自动部署上线]
```

`detect-uhd.yml` 仅在需要手动强制重探测全量图片时使用，日常增量由 `update.yml` 自动兜底。

## 分类与颜色是怎么来的

- **分类**：两层流水线 ——
  - 关键词启发式（`classify.py`，最长命中 + 单字词过滤地名误伤），约 90% 准确率。
  - VLM 视觉语言模型（`vlm_classify.py`，Qwen2-VL-2B，图文一起读），每日 CI 自动跑最新图，将难例（标题/版权含动物词但图是建筑、植物词但图是桥等语义冲突）修对。
  - 历史数据已由一次性回填校准，剩余少量「其他」（极难判/无明显主体）。
- **颜色**：用 Pillow 中位切分量化出主色，再按色相 / 饱和度 / 明度归到 9 色 + 多彩。这是纯像素算法，稳定可复现。

## License

详见 [LICENSE](LICENSE)。壁纸图片版权归原作者与 Bing 所有，本项目仅用于归档与学习。
