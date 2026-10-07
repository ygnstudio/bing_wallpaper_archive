# Cloudflare Pages 部署

本项目是原生 HTML/CSS/JS 静态站，由 Node.js + Rollup 构建；没有 Astro、Pagefind 或跨仓库的 `BING_ARCHIVE_DIR` 依赖。搜索和语言切换沿用现有前端实现。

正式入口：[Cloudflare Pages](https://ygn-bing-wallpaper.pages.dev/) · [GitHub Pages 备用](https://ygnstudio.github.io/bing_wallpaper_archive/)

## 项目配置

Cloudflare：Workers & Pages → Create application → Continue to Pages → Import Git repository。

| 项目 | 设置 |
| --- | --- |
| Repository | `ygnstudio/bing_wallpaper_archive` |
| Project name | `ygn-bing-wallpaper` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | 仓库根目录 |
| Node.js | `.node-version` 固定到 22，与 GitHub Actions 一致 |
| `SITE_URL` | `https://ygn-bing-wallpaper.pages.dev`；绑定域名后改为真实正式地址 |

`CF_PAGES=1` 由 Cloudflare Pages Git 构建自动提供。本地模拟构建时手动设置该变量。

```sh
npm ci
npm test
npm run test:archive
npm run test:deployment
CF_PAGES=1 SITE_URL=https://ygn-bing-wallpaper.pages.dev npm run build
```

`test:deployment` 依次构建 GitHub 子路径版和 Cloudflare 根目录版，并检查 URL、静态资源、JSON-LD、数据完整性及 Service Worker；最后留下的是测试域名产物，发布前必须再次执行正式构建。

## 域名、路由和搜索引擎

`SITE_URL` 在构建时统一替换 canonical、Open Graph、JSON-LD、robots.txt 和 sitemap 中的站点前缀。未设置时继续使用 GitHub Pages 原地址，保证现有备用工作流不受影响。不要将每次变化的预览部署 URL 当作正式地址。

Cloudflare 会把 `about.html` 重定向为 `/about`，因此其 canonical/sitemap 使用 `/about`；GitHub 保留 `about.html`。导航和图片仍使用相对路径。语言是客户端同页切换，没有独立语言 URL，因此不伪造 hreflang。

构建输出顶层 `404.html`，避免 Pages 把不存在的路径作为单页应用回退到首页。Cloudflare 的 `_headers` 要求浏览器重新验证可变资源，并对 `*.项目名.pages.dev` 预览地址添加 noindex；正式 `项目名.pages.dev` 可索引。

如绑定自己的域名：在 Pages → Custom domains 添加域名，按提示配置 DNS；证书激活后更新 Production 和 Preview 的 `SITE_URL` 并重新构建。根域名与子域名接入要求不同，执行前查看官方文档。现有其他域名和服务无需改动。

## 缓存和 PWA

Service Worker 输出到 `/sw.js`（GitHub 为项目子路径下的 `sw.js`），默认作用域覆盖整个站点。预缓存 URL 基于真实 scope 解析。缓存按站点作用域和构建版本隔离，只清理本站旧版本，不删除同源其他项目的缓存。页面及动态数据优先联网，离线时回退缓存；Bing 等跨域图片由浏览器直接请求。

## 链接和自动生成内容

README 的主入口、GitHub 仓库 Description / Website、关于页及首页页脚共同说明主站和备用入口。作者小红书主页为 https://www.xiaohongshu.com/user/profile/66a7e7ae000000001d023641 。修改正式域名时同步这些位置和 Cloudflare 的 `SITE_URL`。

`update_readme_stats.py` 只更新 README 的 `archive-stats` 标记区；标记缺失、重复或索引为空时中止写入，防止覆盖人工内容。CI 和每日更新都会运行保护测试。构建只替换 HTML head 中的 SEO 地址，不替换正文中刻意保留的 GitHub 备用链接。

## 数据与图片更新

`data/` 和 `thumbnails/` 与源码在同一仓库，Cloudflare 构建直接复制它们。继续由 GitHub 的 Daily Update 工作流检查、下载并提交新壁纸；Cloudflare Git 集成监听 `main` 更新，GitHub Pages 原工作流保留。每日更新和手动 4K 检测在有内容提交时均显式触发 `pages.yml`，因为 `GITHUB_TOKEN` 的推送不会自动启动另一个 GitHub Actions push 工作流。手动 4K 检测同时提交重新生成的按年详情文件，避免首页索引和详情页数据不一致。两个写入数据的工作流使用同一并发组，避免相互覆盖。Cloudflare 仍由 Git 集成触发；下一次实际机器人提交后核对其部署结果。无变化的轮询不发布；仅补充观察记录的提交不主动触发 GitHub 备用部署。

缩略图随站点托管，原图来自 Bing，并非 GitHub Raw。普通 Cloudflare Pages 不是中国大陆 CDN，也不能改善浏览器到 Bing 原图服务器的链路。原图失败时站点现有逻辑会尝试其他分辨率或回退缩略图；下载完成提示可能明确说明回退，不能把缩略图当作原图交付。

## 上线检查

- 首页数据数量和最新日期与 `main` 一致，按日期/标题搜索、分类筛选、语言切换正常。
- 缩略图加载、详情、1080p/UHD 切换、单图及批量下载正常；记录 Bing 源失败。
- `/about` 可打开，`/about.html` 跳转正确，不存在地址返回 404。
- canonical、JSON-LD、sitemap、robots.txt 指向正式地址；生产站不含 noindex。
- `/sw.js` 返回 JavaScript，作用域覆盖本站；更新后页面和数据不会被旧缓存卡住。
- GitHub Pages 的项目路径仍能独立打开，不强制跳到 Cloudflare。
- 在大陆宽带与手机网络实测，不根据单次本地测试承诺访问性能。

## 回滚

Cloudflare 部署问题：在 Deployments 中回滚到先前成功的生产部署，再修复或 revert 出错提交，避免自动部署再次引入故障。DNS、环境变量和外部 Bing 图片不会随产物回滚。

平台不可达时继续使用 [GitHub Pages 备用站](https://ygnstudio.github.io/bing_wallpaper_archive/)。若后续切换自定义域名，先备份 DNS，并预先演练备用域名绑定及 HTTPS，不能只改 DNS 就假定 GitHub 可接管。

官方文档：[Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)、[静态资源路由](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[响应头](https://developers.cloudflare.com/pages/configuration/headers/)、[自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)、[回滚](https://developers.cloudflare.com/pages/configuration/rollbacks/)、[China Network](https://developers.cloudflare.com/china-network/)。
