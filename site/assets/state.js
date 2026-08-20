/**
 * 全局状态管理
 * 所有跨模块共享的可变状态集中在此，避免顶层全局变量污染。
 */

/** @type {Array<WallpaperItem>} */
export let items = [];

/** @type {Array<WallpaperItem>} 当前筛选后的结果 */
export let filtered = [];

/** @type {number} 已渲染到 DOM 的卡片数量 */
export let rendered = 0;

/** @type {Map<string, WallpaperItem>} date -> item 快速索引 */
export let byDate = new Map();

/** @type {Set<string>} 已勾选的 date 集合 */
export const selected = new Set();

/** @type {string} 当前激活的分类 */
export let activeCat = '';

/** @type {string} 当前激活的颜色 */
export let activeColor = '';

/** @type {string} 最小年月 YYYYMM */
export let dateMinYm = '';

/** @type {string} 最大年月 YYYYMM */
export let dateMaxYm = '';

/**
 * @param {Array<WallpaperItem>} value
 */
export function setItems(value) {
  items = value;
  byDate = new Map(value.map(i => [i.date, i]));
}

/**
 * 合并某一年份的完整数据到全局索引
 * @param {Array<WallpaperItem>} yearItems
 */
export function mergeYearItems(yearItems) {
  if (!yearItems || yearItems.length === 0) return;
  for (const it of yearItems) {
    const idx = items.findIndex(i => i.date === it.date);
    if (idx >= 0) {
      items[idx] = it;
    } else {
      items.push(it);
    }
    byDate.set(it.date, it);
  }
  // Keep newest-first order
  items.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * @param {Array<WallpaperItem>} value
 */
export function setFiltered(value) {
  filtered = value;
}

/**
 * @param {number} value
 */
export function setRendered(value) {
  rendered = value;
}

/**
 * @param {string} value
 */
export function setActiveCat(value) {
  activeCat = value;
}

/**
 * @param {string} value
 */
export function setActiveColor(value) {
  activeColor = value;
}

/**
 * @param {string} min
 * @param {string} max
 */
export function setDateBounds(min, max) {
  dateMinYm = min;
  dateMaxYm = max;
}
