**[English](README.md) | 简体中文**

<p align="center">
  <img src="./assets/readme/hero-zh-v2.svg" width="100%" alt="Bing Archive: 每天，换一个视角。">
</p>

<p align="center"><img src="./site/assets/og-image.jpg" width="100%" alt="壁纸归档中的 Bing 图片"></p>

浏览自动更新的 Bing 每日壁纸，按分类和颜色筛选、搜索信息、预览原图并批量下载。

[打开壁纸站](https://ygn-bing-wallpaper.pages.dev/) · [GitHub Pages 备用站](https://yangn-st.github.io/bing_wallpaper_archive/)

## 浏览

- 组合关键词、年份、月份、分类和颜色筛选。
- 预览原图，按可用性切换 1080p 或 UHD，并复制图片链接。
- 单张直接下载，多张在浏览器中打包 ZIP。

站点由静态 HTML、CSS 和 JavaScript 构成。GitHub Actions 每四小时计划检查一次，实际触发可能延迟。归档数量以[英文首页的自动更新区块](README.md#archive)为准。

## 数据与更新

数据来自 Bing 的 `zh-CN` `HPImageArchive` API。分类使用关键词和视觉模型，颜色由缩略图计算，自动标签可能有误。

工作流检查最近图片及缺失缩略图，下载、分类、重建索引并校验后提交。归档日期使用官方 `startdate`，缺失或无效时停止。检查报告保存为 Actions artifact，`data/first-seen.json` 记录检查器首次观察时间，不代表 Bing 发布时间。

<details>
<summary>开发与部署</summary>

安装 `requirements.txt` 和锁文件中的 JavaScript 依赖，然后运行：

```sh
python3 scripts/download.py
python3 scripts/classify.py
python3 scripts/generate_index.py
python3 scripts/update_readme_stats.py
python3 scripts/check_archive.py
npm run build
```

本地构建使用数据副本，更新数据后需要重新构建。`npm run test:archive` 检查归档日期和同步保护。部署及回滚详见 [Cloudflare Pages 文档](docs/cloudflare-pages.md)。

</details>

## 许可

见 [LICENSE](LICENSE)。壁纸版权属于原作者与 Bing，本项目用于归档与学习。
