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

/** @type {Map<string, number>} date -> 在 items 数组中的下标，用于 O(1) 合并 */
let itemIndex = new Map();

/** @type {Set<string>} 已勾选的 date 集合 */
export const selected = new Set();

/** @type {string} 当前激活的分类 */
export let activeCat = '';

/** @type {string} 当前激活的颜色 */
export let activeColor = '';

/** @type {string} 最小日期 YYYYMMDD */
export let dateMin = '';

/** @type {string} 最大日期 YYYYMMDD */
export let dateMax = '';

/**
 * @param {Array<WallpaperItem>} value
 */
export function setItems(value) {
  items = value;
  byDate = new Map(value.map(i => [i.date, i]));
  itemIndex = new Map(value.map((i, idx) => [i.date, idx]));
}

/**
 * 合并某一年份的完整数据到全局索引
 * 通过 itemIndex 映射做 O(1) 定位替换，整体 O(n)。
 * @param {Array<WallpaperItem>} yearItems
 */
export function mergeYearItems(yearItems) {
  if (!yearItems || yearItems.length === 0) return;
  for (const it of yearItems) {
    const idx = itemIndex.get(it.date);
    if (idx !== undefined) {
      items[idx] = it;
    } else {
      itemIndex.set(it.date, items.length);
      items.push(it);
    }
    byDate.set(it.date, it);
  }
  // Keep newest-first order
  items.sort((a, b) => b.date.localeCompare(a.date));
  // 排序后重建下标映射，保持后续合并 O(1)
  itemIndex = new Map(items.map((i, idx) => [i.date, idx]));
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
  dateMin = min;
  dateMax = max;
}
