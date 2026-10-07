/**
 * 站点优化验证脚本（一次性）
 * 用 playwright-core 驱动 chromium，验证：
 * 1. 首页加载、网格渲染、Hero 淡入
 * 2. 灯箱打开/上一张/下一张/键盘导航
 * 3. URL 状态同步（筛选→query，灯箱→?d=，后退关闭）
 * 4. 搜索防抖与结果
 * 5. 移动端视口截图
 */
// 优先解析项目内 playwright-core，回退到本机受管 workspace（无 npm install 环境也可跑）
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  ({ chromium } = await import('/Users/ygnan/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.mjs'));
}
import { homedir } from 'os';
import { join } from 'path';
import { readdirSync, existsSync } from 'fs';

const BASE = 'http://localhost:8742/';

// 自动探测 playwright 缓存的 headless chromium 可执行文件
function findChromium() {
  const cacheDir = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cacheDir)) throw new Error('未找到 ms-playwright 缓存，请先安装浏览器');
  for (const dir of readdirSync(cacheDir)) {
    if (!dir.startsWith('chromium_headless_shell-')) continue;
    for (const platform of readdirSync(join(cacheDir, dir))) {
      const exec = join(cacheDir, dir, platform, 'chrome-headless-shell');
      if (existsSync(exec)) return exec;
    }
  }
  throw new Error('未找到 chrome-headless-shell 可执行文件');
}
const exec = findChromium();

let passed = 0, failed = 0;
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`✓ ${name}`); }
  else { failed++; console.error(`✗ ${name} ${extra}`); }
}

const browser = await chromium.launch({ executablePath: exec, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// 1. 网格渲染
const cards = await page.locator('.card').count();
ok('网格渲染出卡片', cards >= 30, `count=${cards}`);
const stats = await page.locator('#archive-stats').textContent();
ok('统计显示已归档', /已归档 3,?86\d/.test(stats), stats);

// Hero 淡入
const heroReady = await page.locator('#hero-bg-img.ready').count();
ok('Hero 图片就绪并淡入', heroReady === 1);
await page.screenshot({ path: '/tmp/bwa-desktop-home.png' });

// 2. 灯箱：点第一张卡片
await page.locator('.card').first().click();
await page.waitForTimeout(800);
ok('灯箱打开', await page.locator('#lightbox:not([hidden])').count() === 1);
ok('URL 带 d 参数', /d=\d{8}/.test(page.url()), page.url());
const t1 = await page.locator('#lb-title').textContent();

// 下一张
await page.click('#lb-next');
await page.waitForTimeout(600);
const t2 = await page.locator('#lb-title').textContent();
ok('下一张切换', t1 !== t2, `${t1} -> ${t2}`);
ok('URL d 参数已更新', page.url().includes('d=') , page.url());

// 键盘导航
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
const t3 = await page.locator('#lb-title').textContent();
ok('方向键导航', t2 !== t3);
await page.screenshot({ path: '/tmp/bwa-lightbox.png' });

// 上一张应回到 t2
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
ok('上一张回退', (await page.locator('#lb-title').textContent()) === t2);

// 后退关闭灯箱
await page.goBack();
await page.waitForTimeout(600);
ok('后退关闭灯箱', await page.locator('#lightbox[hidden]').count() === 1);
ok('后退后 d 参数移除', !/[?&]d=/.test(page.url()), page.url());

// 3. 筛选状态 → URL
await page.locator('#cat-pills .pill').nth(1).click();
await page.waitForTimeout(700);
ok('分类筛选同步 URL', /[?&]cat=/.test(page.url()), page.url());
const filteredCount1 = await page.locator('.card').count();
ok('筛选后网格收窄', filteredCount1 >= 1 && filteredCount1 <= cards, `${filteredCount1}`);

// 刷新保持状态
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const activePill = await page.locator('#cat-pills .pill.active').textContent();
ok('刷新后分类保持', activePill.trim().length > 0, activePill);

// 4. 搜索
await page.fill('#search', '雪山');
await page.waitForTimeout(600);
ok('搜索生效（URL q=）', /[?&]q=/.test(page.url()), page.url());
const emptyOrCards = await page.locator('.card').count();
console.log(`  搜索"雪山"结果 ${emptyOrCards} 张（首屏）`);

// 清除分类，看日期范围
await page.goto(BASE + '?cat=%E9%A3%8E%E6%99%AF&from=2025-01&to=2025-12', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const fromVal = await page.locator('#date-from').inputValue();
ok('直链恢复日期范围', fromVal === '2025-01', fromVal);

// 5. 直链打开灯箱
const someDate = '20261005';
await page.goto(`${BASE}?d=${someDate}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok('直链 ?d= 直开灯箱', await page.locator('#lightbox:not([hidden])').count() === 1);
const lbTitle = await page.locator('#lb-title').textContent();
console.log(`  直链灯箱标题: ${lbTitle}`);

// 6. 移动端视口（模拟触摸设备）
const mobilePage = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await mobilePage.goto(BASE, { waitUntil: 'networkidle' });
await mobilePage.waitForTimeout(1200);
await mobilePage.screenshot({ path: '/tmp/bwa-mobile-home.png' });
// 触摸模拟：touch class
const isTouch = await mobilePage.evaluate(() => document.body.classList.contains('touch'));
ok('触摸环境标记 touch class', isTouch);
// touch 下 info 可见性
const infoOpacity = await mobilePage.evaluate(() => {
  const el = document.querySelector('.card .info');
  return getComputedStyle(el).opacity;
});
ok('触摸端卡片信息常显', infoOpacity === '1', `opacity=${infoOpacity}`);
await mobilePage.screenshot({ path: '/tmp/bwa-mobile-cards.png' });

// 移动端灯箱导航按钮位置
await mobilePage.locator('.card').first().click();
await mobilePage.waitForTimeout(800);
ok('移动端灯箱打开', await mobilePage.locator('#lightbox:not([hidden])').count() === 1);
await mobilePage.screenshot({ path: '/tmp/bwa-mobile-lightbox.png' });
await mobilePage.context().close();

console.log('\n页面错误:', errors.length ? errors.slice(0, 5) : '无');
ok('无页面 JS 错误', errors.length === 0, errors.join(' | '));

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
