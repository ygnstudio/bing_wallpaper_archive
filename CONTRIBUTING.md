# 贡献指南

感谢你对 **bing_wallpaper_archive** 的兴趣！这是一个 Bing 每日壁纸归档项目，自动抓取并按日结构化存储元数据、缩略图和归档数据。这份指南告诉你如何参与贡献。

## 行为准则

参与本项目即表示你同意遵守 [Code of Conduct](./CODE_OF_CONDUCT.md)。请在所有交流中保持尊重。

## 我能贡献什么

- 报 Bug / 提功能建议 → 直接开 [Issue](../../issues)
- 修 Bug / 加功能 → 提 Pull Request
- 改文档 / 改抓取脚本 → 同样欢迎提 PR
- 帮忙回答其他用户的 Issue → 任何用户都能参与

## 提 Issue 前

1. 先在 [Issues](../../issues) 搜索关键词，避免重复。
2. 选对应的 Issue 模板（Bug 报告 / 功能建议 / 提问）。
3. Bug 报告请尽量给出：复现命令、报错日志、抓取的日期 / 区域、相关元数据片段。

## 本地开发

### 环境要求

- Node.js 18+
- Python 3.10+
- Git LFS（仓库可能用 LFS 管理图片，先 `brew install git-lfs && git lfs install`）

### 克隆与构建

```bash
git clone https://github.com/ygnstudio/bing_wallpaper_archive.git
cd bing_wallpaper_archive
npm install
pip install -r requirements.txt
```

仓库内 `scripts/` 是抓取与归档脚本，`site/` 是站点生成。具体可用脚本见 `package.json` 的 `scripts` 段。

### 测试

```bash
npm test
```

测试目录 `tests/`。

## 提 Pull Request

1. Fork 本仓库
2. 从 `main` 创建分支：`git checkout -b feat/my-feature`
3. 本地提交前请运行：
   ```bash
   npm test
   ```
4. commit message 遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：
   - `feat: 新增 X` / `fix: 修复 Y` / `docs: 改文档` / `refactor: 重构`
5. 如果改了用户可见行为（抓取规则、归档结构、站点输出），更新 [`CHANGELOG.md`](./CHANGELOG.md) 的 `[Unreleased]` 部分
6. 推到自己的 fork：`git push origin feat/my-feature`
7. 在 GitHub 上发起 PR 到 `main`，按 PR 模板勾选自检清单

## 代码风格

- **不要把大文件、二进制资源直接 commit 到源代码改动里**——抓取产物应归档到对应日期目录，不要夹带进逻辑改动
- 抓取 / 归档脚本保持小而聚焦，单脚本只做一件事
- 元数据 schema 改动请同步更新 `schemas/` 与对应测试
- 新依赖请在 PR 描述里说明理由

## 版本与发布

- 版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)
- 变更记录见 [`CHANGELOG.md`](./CHANGELOG.md)
- 发布由维护者统一进行，贡献者只需保证 PR 干净、CHANGELOG 已更新

## 联系

- Issue 优先：[GitHub Issues](../../issues)
- 邮箱：[markwalsh6809@gmail.com](mailto:markwalsh6809@gmail.com)
- GitHub 主页：<https://github.com/ygnstudio>
