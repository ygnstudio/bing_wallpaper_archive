// 双主题 × 视口验证矩阵
import { chromium } from '/Users/ygnan/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.mjs';
import { homedir } from 'os';
import { join } from 'path';
import { readdirSync, existsSync } from 'fs';

function findChromium() {
  const cacheDir = join(homedir(), 'Library/Caches/ms-playwright');
  for (const dir of readdirSync(cacheDir)) {
    if (!dir.startsWith('chromium_headless_shell-')) continue;
    for (const platform of readdirSync(join(cacheDir, dir))) {
      const exec = join(cacheDir, dir, platform, 'chrome-headless-shell');
      if (existsSync(exec)) return exec;
    }
  }
  throw new Error('no chromium');
}

let passed = 0, failed = 0;
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`✓ ${name}`); }
  else { failed++; console.error(`✗ ${name} ${extra}`); }
}

const browser = await chromium.launch({ executablePath: findChromium(), headless: true });

// === 深色（显式 colorScheme: dark） ===
const darkCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const dark = await darkCtx.newPage();
const errors = [];
dark.on('pageerror', e => errors.push(String(e)));
await dark.goto('http://localhost:8742/', { waitUntil: 'networkidle' });
await dark.waitForTimeout(1000);
ok('跟随系统偏好为深色', await dark.evaluate(() => document.documentElement.dataset.theme) === 'dark');
ok('深色背景正确', await dark.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(11, 13, 16)');
ok('深色强调金色', await dark.evaluate(() => getComputedStyle(document.querySelector('.logo')).backgroundColor) === 'rgb(232, 185, 35)');
await dark.screenshot({ path: '/tmp/theme-dark-desktop.png' });

// 深色侧：Hero 暗卡 + 灯箱黑场 + 关闭按钮几何基准
const heroCardBgDark = await dark.evaluate(() => getComputedStyle(document.querySelector('.hero-card')).backgroundColor);
ok('Hero 卡深色下为暗卡', heroCardBgDark === 'rgb(24, 26, 32)', heroCardBgDark);
await dark.locator('.card').first().click();
await dark.waitForTimeout(800);
const closeRectDark = await dark.evaluate(() => { const r = document.getElementById('close').getBoundingClientRect(); return [r.width, r.height]; });
const lbBgDark = await dark.evaluate(() => getComputedStyle(document.querySelector('.lightbox')).backgroundColor);
ok('灯箱深色背景为黑场', lbBgDark === 'rgba(0, 0, 0, 0.92)', lbBgDark);
await dark.keyboard.press('Escape');
await dark.waitForTimeout(400);

// 切换到浅色
await dark.click('#theme-toggle');
await dark.waitForTimeout(400);
ok('切换后 data-theme=light', await dark.evaluate(() => document.documentElement.dataset.theme) === 'light');
ok('浅色背景纸白', await dark.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(250, 247, 242)');
ok('浅色强调墨蓝', await dark.evaluate(() => getComputedStyle(document.querySelector('.logo')).backgroundColor) === 'rgb(27, 54, 93)');
ok('meta theme-color 同步', await dark.evaluate(() => document.querySelector('meta[name=theme-color]').content) === '#faf7f2');
// localStorage 持久化
await dark.reload({ waitUntil: 'networkidle' });
await dark.waitForTimeout(800);
ok('刷新后浅色保持', await dark.evaluate(() => document.documentElement.dataset.theme) === 'light');
await dark.screenshot({ path: '/tmp/theme-light-desktop.png' });

// 浅色侧：Hero 卡变纸白卡（同几何），灯箱背景纸色、标题墨色
const heroCardBgLight = await dark.evaluate(() => getComputedStyle(document.querySelector('.hero-card')).backgroundColor);
ok('Hero 卡浅色下为纸白卡', heroCardBgLight === 'rgb(255, 255, 255)', heroCardBgLight);
await dark.locator('.card').first().click();
await dark.waitForTimeout(800);
const lbBg = await dark.evaluate(() => getComputedStyle(document.querySelector('.lightbox')).backgroundColor);
ok('灯箱浅色背景为纸色', lbBg === 'rgba(250, 247, 242, 0.96)', lbBg);
const lbColor = await dark.evaluate(() => getComputedStyle(document.querySelector('.lb-meta h2')).color);
ok('灯箱标题浅色下为墨色', lbColor === 'rgb(31, 28, 23)', lbColor);
const closeRectLight = await dark.evaluate(() => { const r = document.getElementById('close').getBoundingClientRect(); return [r.width, r.height]; });
ok('灯箱关闭按钮几何两主题一致', JSON.stringify(closeRectLight) === JSON.stringify(closeRectDark), `${closeRectDark} vs ${closeRectLight}`);
await dark.screenshot({ path: '/tmp/theme-light-lightbox.png' });
await dark.close();

// === 浅色移动端 ===
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await mob.goto('http://localhost:8742/', { waitUntil: 'networkidle' });
await mob.waitForTimeout(1000);
ok('移动端默认跟随系统(浅色)', await mob.evaluate(() => document.documentElement.dataset.theme) === 'light');
await mob.screenshot({ path: '/tmp/theme-light-mobile.png' });
// 日期触发器实底
const mtBg = await mob.evaluate(() => getComputedStyle(document.querySelector('.month-trigger')).backdropFilter);
ok('month-trigger 无玻璃', mtBg === 'none', mtBg);
await mob.close();

// === 浅色关于页 ===
const about = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await about.goto('http://localhost:8742/about.html', { waitUntil: 'networkidle' });
await about.waitForTimeout(600);
ok('关于页继承浅色', await about.evaluate(() => document.documentElement.dataset.theme) === 'light');
await about.click('#theme-toggle');
await about.waitForTimeout(300);
ok('关于页可切换', await about.evaluate(() => document.documentElement.dataset.theme) === 'dark');
await about.screenshot({ path: '/tmp/theme-about-dark.png' });
await about.close();

console.log('\n页面错误:', errors.length ? errors : '无');
ok('无页面 JS 错误', errors.length === 0);
console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
