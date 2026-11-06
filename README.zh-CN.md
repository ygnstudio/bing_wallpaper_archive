**[English](README.md) | 简体中文**

<p align="center">
  <img src="./assets/readme/hero-zh-v2.svg" width="100%" alt="Bing Archive：每天，换一个视角。">
</p>

<p align="center"><img src="./site/assets/og-image.jpg" width="100%" alt="壁纸归档中的 Bing 图片"></p>

自动更新的 Bing 每日壁纸归档。可以按分类或颜色筛选、搜索图片信息、预览原图并批量下载。

[打开壁纸站](https://ygn-bing-wallpaper.pages.dev/) · [GitHub Pages 备用站](https://yangn-st.github.io/bing_wallpaper_archive/)

## 浏览

- 组合关键词、年份、月份、分类和颜色筛选。
- 搜索标题、版权文字和归档日期。
- 预览原图，在可用时切换 1080p 或 UHD，也可以复制图片链接。
- 单张直接下载，或选择多张后在浏览器中打包成 ZIP。

## 归档

<!-- archive-stats:start -->
- 收录 **3899 张**壁纸，最早可追溯到 **2016-03-05**，其中 3899 张含缩略图。
<!-- archive-stats:end -->

图片来自 Bing 面向 `zh-CN` 的 `HPImageArchive` API。分类使用关键词规则和视觉模型，颜色由缩略图计算。两类标签都是自动生成的，可能有误。

## 更新方式

- GitHub Actions 每四小时检查一次新图片，大致在北京时间 00:37、04:37、08:37、12:37、16:37 和 20:37 运行。实际执行可能延迟。
- 每次运行先检查官方最近八条记录，并扫描归档中缺失的缩略图。没有新增且没有缺图时，会跳过下载、分类和重建步骤。
- 新图片会先下载、分类、重建索引并校验，通过后工作流才提交。校验失败会停止提交，不会发布不完整的数据。
- Cloudflare Pages 根据提交构建主站，工作流还会显式触发 GitHub Pages 备用站部署。

## 分类与颜色

- **分类**：人物、动物、美食、交通、建筑、太空、植物、抽象艺术、风景和其他，共十类。关键词规则处理大部分图片；Qwen2-VL 会复核新图片，修正语义冲突。
- **颜色**：蓝、绿、红、黄、橙、紫、粉、棕、灰白和多彩，共十种。Pillow 从缩略图提取主色，再按色相、饱和度和明度归入对应色板。

## 归档日期与本地构建

每次更新检查 Bing 最近八条记录，并以官方 `startdate` 作为归档日期。不使用下载当天日期，也不根据 `fullstartdate` 推算日期；日期缺失或无效时会停止更新。已有图片的日期、分类和颜色不会被后续运行更改。

本地构建使用数据快照，不会自动跟随远端分支。本地刷新数据后需要重新构建站点：

```sh
python3 scripts/download.py
python3 scripts/classify.py
python3 scripts/generate_index.py
python3 scripts/update_readme_stats.py
python3 scripts/check_archive.py
npm run build
```

首次运行前需要安装 `requirements.txt` 中的 Python 依赖和锁文件中的 JavaScript 依赖。`npm run test:archive` 会检查归档日期处理和同步保护逻辑。

## 开发与部署

<details>
<summary>更新流程与部署说明</summary>

更新流程定义在 `.github/workflows/update.yml`，按顺序执行，并把检查报告保存为保留 90 天的 Actions artifact。`data/first-seen.json` 记录检查器首次观察到每张图片的时间，不代表 Bing 的发布时间。

Cloudflare Pages 托管主站，GitHub Pages 作为备用站。部署配置和回滚前的验证步骤见 [Cloudflare Pages 文档](docs/cloudflare-pages.md)。

两个 README 中的 `archive-stats` 区块由 `scripts/update_readme_stats.py` 重新生成。区块外的链接、简介和部署说明由人工维护，更新时会保留。

</details>

## 许可

壁纸版权属于原作者与 Bing，本项目用于归档与学习。代码使用 MIT 许可。

[MIT](LICENSE) · [关注 YanGN 的小红书](https://www.xiaohongshu.com/user/profile/66a7e7ae000000001d023641)
