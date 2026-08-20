/**
 * 数据与网络 API
 * 负责 index.json 加载、分辨率 URL 构建、图片字节获取。
 */

import { DEFAULT_LIGHTBOX_RES, CACHE_BUST } from './config.js';
import { mergeYearItems } from './state.js';

/**
 * 加载轻量主索引
 * @param {string} [cacheBust] - 可选缓存戳
 * @returns {Promise<Array<WallpaperItem>>}
 */
export async function loadIndex(cacheBust) {
  const url = cacheBust ? `./data/index.json?v=${cacheBust}` : './data/index.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

/** @type {Set<string>} 已加载完整数据的年份 */
const loadedYears = new Set();

/**
 * 按需加载某一年份的完整数据（含 url/copyrightlink/urlbase），
 * 并合并到全局 items。同一自然年内只加载一次。
 * @param {string} year
 * @returns {Promise<void>}
 */
export async function ensureYearLoaded(year) {
  if (loadedYears.has(year)) return;
  const base = `./data/${year}.json`;
  const url = CACHE_BUST ? `${base}?v=${CACHE_BUST}` : base;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const yearItems = await res.json();
  mergeYearItems(yearItems);
  loadedYears.add(year);
}

/**
 * 确保单张壁纸的完整数据已加载
 * @param {WallpaperItem} it
 * @returns {Promise<WallpaperItem>}
 */
export async function ensureItemLoaded(it) {
  if (it.url) return it;
  const year = it.date.slice(0, 4);
  await ensureYearLoaded(year);
  // state.mergeYearItems 会更新 byDate，返回合并后的对象
  // 但这里原对象引用可能仍是旧的，重新从全局取最保险
  const { byDate } = await import('./state.js');
  return byDate.get(it.date) || it;
}

/**
 * 根据基础 URL 和分辨率构造完整图片 URL
 * @param {string} url
 * @param {string} res
 * @returns {string}
 */

/**
 * 根据基础 URL 和分辨率构造完整图片 URL
 * @param {string} url
 * @param {string} res
 * @returns {string}
 */
export function buildResUrl(url, res) {
  if (!url) return '';
  if (!res || res === '1920x1080') return url;
  const m = url.match(/th\?id=(OHR\.[^&]+)/i);
  if (m) {
    const oid = m[1].replace(/\.jpg$/i, '').replace(/_(UHD|\d+X\d+)$/i, '');
    return 'https://www.bing.com/th?id=' + oid + '_' + res.toUpperCase() + '.jpg';
  }
  if (url.includes('cdn.bimg.cc')) {
    return url.replace(/_(UHD|\d+X\d+)?\.jpg$/i, '_' + res.toUpperCase() + '.jpg');
  }
  return url;
}

/**
 * 获取某张壁纸可选的分辨率列表
 * @param {WallpaperItem} item
 * @returns {Array<ResOption>}
 */
export function supportedResolutions(item) {
  const u = item.url || '';
  const bing = /bing\.com\/th\?id=OHR/i.test(u);
  if (!bing) {
    return [{ v: '1920x1080', label: '1080p（已是最清）' }];
  }
  if (item.uhd === false) {
    return [{ v: '1920x1080', label: '1080p（仅此分辨率）' }];
  }
  return [
    { v: 'UHD', label: 'UHD (4K)' },
    { v: '1920x1080', label: '1080p' }
  ];
}

/**
 * 获取默认分辨率（优先 1080p，没有则取第一个可用）
 * @param {WallpaperItem} item
 * @returns {string}
 */
export function defaultResolution(item) {
  const opts = supportedResolutions(item);
  const def = opts.find(o => o.v === DEFAULT_LIGHTBOX_RES);
  return def ? def.v : opts[0].v;
}

/**
 * 拉取图片二进制数据
 * @param {string} url
 * @returns {Promise<Uint8Array>}
 */
export async function fetchBytes(url) {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * 按优先顺序尝试获取某张图片的字节，失败自动降级到缩略图
 * @param {WallpaperItem} it
 * @param {string} res
 * @returns {Promise<ZipEntry|null>}
 */
export async function fetchWithFallback(it, res) {
  const order = [res];
  if (res === 'UHD') order.push('1920x1080');
  for (const r of order) {
    if (r === 'UHD' && it.uhd === false) continue;
    try {
      const url = buildResUrl(it.url, r) || it.url;
      const bytes = await fetchBytes(url);
      const suffix = r === 'UHD' ? '_UHD' : '';
      return { bytes, name: it.date + suffix + '.jpg' };
    } catch (_) { }
  }
  if (it.thumbnail) {
    try {
      const bytes = await fetchBytes('./' + it.thumbnail);
      return { bytes, name: it.date + '_thumb.webp' };
    } catch (_) { }
  }
  return null;
}
