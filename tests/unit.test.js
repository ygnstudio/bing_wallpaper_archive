#!/usr/bin/env node
/**
 * 单元回归测试
 * 覆盖 filter、api、zip 等纯函数逻辑。
 */

import { normalizeDate, daysInMonth } from '../site/assets/dates.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getFiltered, inDateRange, countBy } from '../site/assets/filter.js';
import { setItems, setActiveCat, setActiveColor } from '../site/assets/state.js';
import { syncFiltersToUrl, readStateFromUrl } from '../site/assets/urlstate.js';
import { buildResUrl, supportedResolutions } from '../site/assets/api.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const url = 'https://www.bing.com/th?id=OHR.Test_ZH-CN1234567890_1920x1080.jpg';

const items = [
  { date: '20240101', title: '雪山', category: '风景', color: '蓝', uhd: true },
  { date: '20240115', title: '城市夜景', category: '建筑', color: '蓝', uhd: false },
  { date: '20240201', title: '小猫', category: '动物', color: '黄', uhd: true },
  { date: '20240220', title: '美食', category: '美食', color: '黄', uhd: null }
];

// 模拟 state 已被 filter.js 使用；这里 items 通过 getFiltered 参数传入后
// 实际上 filter.js 内部使用 state.items，所以以下测试需要在导入前设置 state。
// 为简化，我们只测试不依赖 state 的函数。

test('inDateRange 空范围通过', () => {
  assert(inDateRange(items[0], '', '') === true);
});

test('inDateRange 按年月过滤', () => {
  assert(inDateRange(items[0], '2024-01', '2024-01') === true);
  assert(inDateRange(items[2], '2024-01', '2024-01') === false);
});

test('日期范围精确到天且包含两端', () => {
  assert(inDateRange(items[1], '2024-01-15', '2024-01-15'));
  assert(!inDateRange(items[0], '2024-01-15', '2024-01-15'));
  assert(!inDateRange(items[2], '2024-01-15', '2024-01-15'));
  assert(inDateRange(items[1], '2024-01-15', '2024-02-01'));
  assert(inDateRange(items[2], '2024-01-15', '2024-02-01'));
});
test('单边日期范围按天截断', () => {
  assert(!inDateRange(items[0], '2024-01-02', ''));
  assert(inDateRange(items[1], '2024-01-02', ''));
  assert(inDateRange(items[2], '', '2024-02-01'));
  assert(!inDateRange(items[3], '', '2024-02-01'));
});
test('旧月份链接展开为正确的月初月末', () => {
  assert(normalizeDate('2024-02') === '2024-02-01');
  assert(normalizeDate('2024-02', true) === '2024-02-29');
  assert(normalizeDate('2023-02', true) === '2023-02-28');
  assert(normalizeDate('2024-12', true) === '2024-12-31');
  assert(normalizeDate('2024-02-15', true) === '2024-02-15');
});
test('拒绝不存在的日期并正确处理闰年', () => {
  for (const value of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-00-01', '2024-01-00', 'invalid']) assert(normalizeDate(value) === '', value);
  assert(normalizeDate('2024-02-29') === '2024-02-29');
  assert(daysInMonth(2000, 1) === 29 && daysInMonth(2100, 1) === 28);
});
test('Worker 与主线程的日范围筛选一致', () => {
  const context = { self: {} };
  runInNewContext(readFileSync(new URL('../site/assets/worker.js', import.meta.url), 'utf8'), context);
  for (const [from,to] of [['2024-01-15','2024-01-15'],['2024-01-15','2024-02-01'],['','2024-02-01'],['2024-01','2024-01']])
    for (const item of items) assert(context.inDateRange(item,from,to) === inDateRange(item,from,to));
});

test('buildResUrl 生成 UHD 链接', () => {
  const url = 'https://www.bing.com/th?id=OHR.Test_ZH-CN1234567890_1920x1080.jpg';
  const uhd = buildResUrl(url, 'UHD');
  assert(uhd.includes('_UHD.jpg'), `应为 UHD: ${uhd}`);
});

test('buildResUrl 1080p 返回原链接', () => {
  const url = 'https://www.bing.com/th?id=OHR.Test_ZH-CN1234567890_1920x1080.jpg';
  assert(buildResUrl(url, '1920x1080') === url);
});

test('supportedResolutions uhd=false 只返回 1080p', () => {
  const opts = supportedResolutions({ url, uhd: false });
  assert(opts.length === 1 && opts[0].v === '1920x1080');
});

test('supportedResolutions uhd=true 返回 4K 和 1080p', () => {
  const opts = supportedResolutions({ url, uhd: true });
  assert(opts.length === 2);
  assert(opts.some(o => o.v === 'UHD'));
});

test('组合筛选保留中文子串匹配', () => {
  setItems(items);
  setActiveCat('建筑'); setActiveColor('蓝');
  const result = getFiltered('夜', '2024-01', '2024-02');
  assert(result.length === 1 && result[0].date === '20240115');
  setActiveCat(''); setActiveColor('');
});

test('单边月份范围保留另一端全部数据', () => {
  assert(getFiltered('', '2024-02', '').length === 2);
  assert(getFiltered('', '', '2024-01').length === 2);
});

test('日期和中文筛选可通过 URL 完整恢复', () => {
  const previousLocation = globalThis.location, previousHistory = globalThis.history;
  try {
    globalThis.location = { pathname: '/archive/', search: '' };
    globalThis.history = { state: null, replaceState(state, title, url) {
      globalThis.location.search = new URL(url, 'https://example.test').search;
    }};
    syncFiltersToUrl({ q: '雪山', cat: '风景', col: '蓝', from: '2024-01-15', to: '2024-02-20' }, { keepLightbox: true, lightboxDate: '20240101' });
    const restored = readStateFromUrl();
    assert(restored.from === '2024-01-15' && restored.to === '2024-02-20');
    assert(restored.q === '雪山' && restored.cat === '风景' && restored.col === '蓝');
    assert(restored.d === '20240101');
  } finally {
    if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation;
    if (previousHistory === undefined) delete globalThis.history; else globalThis.history = previousHistory;
  }
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
