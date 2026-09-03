#!/usr/bin/env node
/**
 * 站点构建脚本
 * - 用 Rollup 打包 JS（ES module -> IIFE，减少网络请求）
 * - 合并、minify CSS
 * - 为 JS/CSS 生成 content-hash 文件名
 * - 将 site/index.html、about.html 中的缓存戳替换为真实 hash
 * - 复制 data/ 等静态资源到 dist/
 */

import { createHash } from 'crypto';
import { readFile, writeFile, copyFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 依赖解析：标准 Node 解析（项目 node_modules，CI/本机 npm install 后均命中），
// 特殊环境可通过 NPM_MODULE_BASE 环境变量指定额外 node_modules 目录。
// 不再硬编码个人机器路径（此前写死 /Users/... 导致其他环境无法构建）。
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function resolveModule(name) {
  try {
    return require.resolve(name);
  } catch {
    const base = process.env.NPM_MODULE_BASE;
    if (base) return require.resolve(join(base, name));
    throw new Error(`无法解析依赖 ${name}：请先在项目根目录执行 npm install，或通过 NPM_MODULE_BASE 环境变量指定 node_modules 路径`);
  }
}

const { rollup } = await import(resolveModule('rollup'));
const { nodeResolve } = await import(resolveModule('@rollup/plugin-node-resolve'));
const terser = (await import(resolveModule('@rollup/plugin-terser'))).default;
const { minify: minifyCss } = await import(resolveModule('csso'));

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'site');
const DIST = join(ROOT, 'dist');

const isDev = process.argv.includes('--dev');

/**
 * 计算文件内容 hash（8 位）
 * @param {Buffer|string} content
 * @returns {string}
 */
function hash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * 确保目录存在
 * @param {string} dir
 */
async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/**
 * 递归复制目录
 * @param {string} src
 * @param {string} dst
 */
async function copyDir(src, dst) {
  await ensureDir(dst);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await copyFile(s, d);
    }
  }
}

/**
 * 合并 site/assets/*.css 为一个文件
 * @returns {Promise<{css: string, hash: string}>}
 */
async function bundleCss() {
  const cssDir = join(SRC, 'assets');
  const files = (await readdir(cssDir))
    .filter(f => f.endsWith('.css'))
    .sort();
  let css = '';
  for (const f of files) {
    css += `/* ${f} */\n` + await readFile(join(cssDir, f), 'utf-8') + '\n';
  }
  const min = isDev ? css : minifyCss(css).css;
  return { css: min, hash: hash(min) };
}

/**
 * 用 Rollup 打包 JS
 * @returns {Promise<{code: string, hash: string}>}
 */
async function bundleJs() {
  const bundle = await rollup({
    input: join(SRC, 'assets', 'app.js'),
    plugins: [
      nodeResolve(),
      ...(isDev ? [] : [terser()])
    ]
  });
  const { output } = await bundle.generate({
    format: 'iife',
    sourcemap: isDev
  });
  await bundle.close();
  const code = output[0].code;
  return { code, hash: hash(code) };
}

/**
 * 处理 HTML：替换缓存戳为真实 hash
 * @param {string} name
 * @param {string} jsHash
 * @param {string} cssHash
 */
async function processHtml(name, jsHash, cssHash) {
  const src = join(SRC, name);
  const dst = join(DIST, name);
  let html = await readFile(src, 'utf-8');
  html = html
    .replace(/\.\/assets\/style\.css\?v=[^"']+/g, `./assets/style.${cssHash}.css`)
    .replace(/<script[^>]*src="\.\/assets\/app\.js\?v=[^"]+"[^>]*><\/script>/g,
      `<script src="./assets/app.${jsHash}.js"></script>`);
  await writeFile(dst, html);
}

/**
 * 校验 metadata.json 与 index.json 一致性
 * @returns {void}
 */
function validateData() {
  const metaPath = join(ROOT, 'data', 'metadata.json');
  const idxPath = join(ROOT, 'data', 'index.json');

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const idx = JSON.parse(readFileSync(idxPath, 'utf-8'));

  const errors = [];

  // metadata 结构检查
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    errors.push('metadata.json 必须是对象');
  } else {
    for (const [date, item] of Object.entries(meta)) {
      if (!/^\d{8}$/.test(date)) errors.push(`metadata 非法日期 key: ${date}`);
      for (const f of ['title', 'url', 'urlbase']) {
        if (!(f in item)) errors.push(`${date} 缺少字段 ${f}`);
      }
      if ('uhd' in item && item.uhd !== null && typeof item.uhd !== 'boolean') {
        errors.push(`${date} 的 uhd 字段必须是 boolean 或 null`);
      }
    }
  }

  // index 结构检查
  if (!Array.isArray(idx)) {
    errors.push('index.json 必须是数组');
  } else {
    const seen = new Set();
    for (const item of idx) {
      const date = item.date;
      if (!/^\d{8}$/.test(date)) errors.push(`index 非法日期: ${date}`);
      if (seen.has(date)) errors.push(`index 重复日期: ${date}`);
      seen.add(date);
      for (const f of ['date', 'title']) {
        if (!(f in item)) errors.push(`${date} 缺少字段 ${f}`);
      }
      if ('uhd' in item && item.uhd !== null && typeof item.uhd !== 'boolean') {
        errors.push(`${date} 的 uhd 字段必须是 boolean 或 null`);
      }
    }
  }

  // 一致性检查
  if (typeof meta === 'object' && meta !== null && !Array.isArray(meta) && Array.isArray(idx)) {
    const metaDates = new Set(Object.keys(meta));
    const idxDates = new Set(idx.map(i => i.date));
    const missingInIdx = [...metaDates].filter(d => !idxDates.has(d));
    const missingInMeta = [...idxDates].filter(d => !metaDates.has(d));
    if (missingInIdx.length) errors.push(`metadata 中有但 index 中缺失: ${missingInIdx.slice(0, 5).join(', ')}`);
    if (missingInMeta.length) errors.push(`index 中有但 metadata 中缺失: ${missingInMeta.slice(0, 5).join(', ')}`);

    const idxMap = new Map(idx.map(i => [i.date, i]));
    for (const date of metaDates) {
      const m = meta[date];
      const i = idxMap.get(date);
      if (!i) continue;
    for (const k of ['title', 'copyright', 'category', 'color', 'uhd']) {
      if (m[k] !== i[k]) {
        errors.push(`${date} 字段 ${k} 不一致: metadata=${JSON.stringify(m[k])} index=${JSON.stringify(i[k])}`);
      }
    }
    }
  }

  if (errors.length) {
    console.error('数据校验失败:');
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
    throw new Error(`validateData: ${errors.length} 处错误`);
  }

  console.log(`Data validated: metadata=${Object.keys(meta).length} index=${idx.length}`);
}

/**
 * 生成 sitemap.xml（首页 + 关于页）
 */
async function generateSitemap() {
  const BASE_URL = 'https://ygnstudio.github.io/bing_wallpaper_archive';
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${BASE_URL}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${BASE_URL}/about.html`, lastmod: today, changefreq: 'monthly', priority: '0.5' }
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u =>
      `  <url>\n` +
      `    <loc>${u.loc}</loc>\n` +
      `    <lastmod>${u.lastmod}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
    ).join('\n') +
    `\n</urlset>\n`;
  await writeFile(join(DIST, 'sitemap.xml'), xml);
}

async function main() {
  console.log(isDev ? 'Building (dev)...' : 'Building (prod)...');

  // 构建前校验数据一致性
  validateData();

  // 清理 dist
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true });
  }
  await ensureDir(DIST);

  // 打包 JS/CSS
  const [{ code: jsCode, hash: jsHash }, { css: cssCode, hash: cssHash }] = await Promise.all([
    bundleJs(),
    bundleCss()
  ]);

  // 写入带 hash 的资源
  await ensureDir(join(DIST, 'assets'));
  const jsName = `app.${jsHash}.js`;
  const cssName = `style.${cssHash}.css`;
  await writeFile(join(DIST, 'assets', jsName), jsCode);
  await writeFile(join(DIST, 'assets', cssName), cssCode);

  // 复制 Service Worker 与 Web Worker（不打包，保持独立）
  await copyFile(join(SRC, 'assets', 'sw.js'), join(DIST, 'assets', 'sw.js'));
  await copyFile(join(SRC, 'assets', 'worker.js'), join(DIST, 'assets', 'worker.js'));

  // 生成资源清单，供 SW 预缓存（注意与 PWA manifest.json 区分）
  await writeFile(join(DIST, 'assets', 'asset-manifest.json'), JSON.stringify({
    assets: [
      `./assets/${jsName}`,
      `./assets/${cssName}`,
      `./assets/sw.js`,
      `./assets/worker.js`
    ]
  }));

  // 处理 HTML
  await processHtml('index.html', jsHash, cssHash);
  await processHtml('about.html', jsHash, cssHash);

  // 复制 PWA 与 SEO 静态资源
  await copyFile(join(SRC, 'favicon.svg'), join(DIST, 'favicon.svg'));
  await copyFile(join(SRC, 'manifest.json'), join(DIST, 'manifest.json'));
  await copyFile(join(SRC, 'robots.txt'), join(DIST, 'robots.txt'));

  // 生成 sitemap.xml
  await generateSitemap();

  // 复制 data/（site/data 是本地 dev 符号链接，CI 中可能不存在，回退到根目录真实 data/）
  const dataSrc = existsSync(join(SRC, 'data')) ? join(SRC, 'data') : join(ROOT, 'data');
  await copyDir(dataSrc, join(DIST, 'data'));

  // 复制缩略图（仓库已直接存 webp，无需转换）
  const thumbSrc = existsSync(join(SRC, 'thumbnails')) ? join(SRC, 'thumbnails') : join(ROOT, 'thumbnails');
  if (existsSync(thumbSrc)) {
    await copyDir(thumbSrc, join(DIST, 'thumbnails'));
  }

  console.log(jsName);
  console.log(cssName);
  console.log('asset-manifest.json');
  console.log('sitemap.xml');
  console.log('Build complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
