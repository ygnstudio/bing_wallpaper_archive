# 更新日志

本项目所有用户可见的变更都会记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 灯箱「上一张 / 下一张」导航：按钮 + 键盘方向键，基于当前筛选结果循环切换。
- URL 状态同步：分类 / 颜色 / 搜索 / 日期范围同步至查询参数（可分享、刷新保持），
  灯箱以 `?d=日期` 直链访问，浏览器后退即关闭。
- 搜索输入 250ms 防抖，避免逐键全量筛选与计数重算。
- Hero 背景先用本地缩略图即时呈现，1080p 高清图预加载完成后交叉淡入。
- 缩略图加载淡入 + 网格骨架微光占位；卡片批内交错进场动画。
- `og:image` / `twitter:image` 换为真实 1920x1080 JPG 壁纸（`assets/og-image.jpg`），
  `twitter:card` 升级为 `summary_large_image`。
- 新增 `tests/e2e-verify.mjs` 浏览器端验证脚本（21 项断言，覆盖灯箱导航 /
  URL 同步 / 防抖 / 直链恢复 / 触摸端表现）。

### Changed

- 触摸设备上卡片标题与分类标签常显（原先仅 hover 可见，移动端不可见）。
- `mergeYearItems` 合并年份完整数据由 `findIndex` O(n²) 改为 Map 索引 O(n)。
- 灯箱大图与开关增加淡入 / 缩放过场，动画遵循 `prefers-reduced-motion`。

### Added (历史)

- 初始化 `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `CHANGELOG.md`，
  补全 `.github/` 协作模板（Issue 模板与 PR 模板）。

## 变更类型说明

- **Added** 新增功能
- **Changed** 对已有功能的变更
- **Deprecated** 即将移除的功能
- **Removed** 已移除的功能
- **Fixed** Bug 修复
- **Security** 安全相关修复
