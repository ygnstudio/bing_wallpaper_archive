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
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// 本地开发走 managed workspace；CI 走项目 node_modules
const MANAGED_NODE_MODULES = '/Users/rashida/.workbuddy/binaries/node/workspace/node_modules';
const MODULE_BASE = existsSync(MANAGED_NODE_MODULES) ? MANAGED_NODE_MODULES : join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');

const { rollup } = await import(join(MODULE_BASE, 'rollup', 'dist', 'rollup.js'));
const { nodeResolve } = await import(join(MODULE_BASE, '@rollup', 'plugin-node-resolve', 'dist', 'es', 'index.js'));
const terser = (await import(join(MODULE_BASE, '@rollup', 'plugin-terser', 'dist', 'es', 'index.js'))).default;
const { minify: minifyCss } = await import(join(MODULE_BASE, 'csso', 'lib', 'index.js'));

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

async function main() {
  console.log(isDev ? 'Building (dev)...' : 'Building (prod)...');

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

  // 生成资源清单，供 SW 预缓存
  await writeFile(join(DIST, 'assets', 'manifest.json'), JSON.stringify({
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

  // 复制 data/
  await copyDir(join(SRC, 'data'), join(DIST, 'data'));

  // 转换缩略图为 webp（仓库仍只存 jpg，构建产物含 webp）
  if (existsSync(join(SRC, 'thumbnails'))) {
    await convertThumbnails();
  }

  console.log(jsName);
  console.log(cssName);
  console.log('manifest.json');
  console.log('Build complete.');
}

/**
 * 调用 Python 脚本将 site/thumbnails 转为 webp
 * @returns {Promise<void>}
 */
function convertThumbnails() {
  return new Promise((resolve, reject) => {
    const py = process.env.PYTHON || '/Users/rashida/.workbuddy/binaries/python/envs/default/bin/python3';
    const script = join(ROOT, 'scripts', 'convert_thumbnails.py');
    const child = spawn(py, [script, join(SRC, 'thumbnails'), join(DIST, 'thumbnails')], {
      stdio: 'inherit'
    });
    child.on('close', code => code === 0 ? resolve() : reject(new Error('convert_thumbnails.py exited ' + code)));
    child.on('error', reject);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
