/**
 * 筛选逻辑
 * 日期范围、分类、颜色、搜索关键词的组合过滤与计数。
 */

import { activeCat, activeColor, items } from './state.js';

/**
 * 判断 item 的日期是否落在当前选择范围内
 * @param {WallpaperItem} i
 * @param {string} from - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @param {string} to - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @returns {boolean}
 */
export function inDateRange(i, from, to) {
  const day = i.date;
  if (from && day < from.replaceAll('-', '').padEnd(8, '0')) return false;
  if (to && day > to.replaceAll('-', '').padEnd(8, '9')) return false;
  return true;
}

/**
 * 统计某个维度（category/color）在当前其他维度条件下的命中数量
 * @param {'category'|'color'} dim
 * @param {string} value
 * @param {string} q - 搜索词
 * @param {string} dateFrom - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @param {string} dateTo - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @returns {number}
 */
export function countBy(dim, value, q, dateFrom, dateTo) {
  const query = q.trim().toLowerCase();
  return items.filter(i => {
    if (!inDateRange(i, dateFrom, dateTo)) return false;
    if (dim !== 'category' && activeCat && i.category !== activeCat) return false;
    if (dim !== 'color' && activeColor && i.color !== activeColor) return false;
    if (query) {
      const hay = ((i.title || '') + (i.copyright || '') + (i.date || '')).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return i[dim] === value;
  }).length;
}

/**
 * 应用所有活跃筛选条件，返回结果数组
 * @param {string} q - 搜索词
 * @param {string} dateFrom - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @param {string} dateTo - YYYY-MM-DD 或空（兼容 YYYY-MM）
 * @returns {Array<WallpaperItem>}
 */
export function getFiltered(q, dateFrom, dateTo) {
  const query = q.trim().toLowerCase();
  return items.filter(i => {
    if (!inDateRange(i, dateFrom, dateTo)) return false;
    if (activeCat && i.category !== activeCat) return false;
    if (activeColor && i.color !== activeColor) return false;
    if (query) {
      const hay = ((i.title || '') + (i.copyright || '') + (i.date || '')).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

/** One archive scan produces results and both facet counts. */
export function evaluateFilters(q, dateFrom, dateTo) {
  const query = q.trim().toLowerCase();
  const from = dateFrom.replaceAll('-', '').padEnd(dateFrom ? 8 : 0, '0');
  const to = dateTo.replaceAll('-', '').padEnd(dateTo ? 8 : 0, '9');
  const results = [], categories = new Map(), colors = new Map();
  for (const item of items) {
    if ((from && item.date < from) || (to && item.date > to)) continue;
    if (query && !searchText(item).includes(query)) continue;
    const categoryMatches = !activeCat || item.category === activeCat;
    const colorMatches = !activeColor || item.color === activeColor;
    // Each facet ignores its own active value, just as countBy does.
    if (colorMatches) categories.set(item.category, (categories.get(item.category) || 0) + 1);
    if (categoryMatches) colors.set(item.color, (colors.get(item.color) || 0) + 1);
    if (categoryMatches && colorMatches) results.push(item);
  }
  return { results, categories, colors };
}
// Full-year metadata replaces item objects; WeakMap entries naturally expire.
const searchTexts = new WeakMap();
function searchText(item) {
  let text = searchTexts.get(item);
  if (text === undefined) {
    text = ((item.title || '') + (item.copyright || '') + (item.date || '')).toLowerCase();
    searchTexts.set(item, text);
  }
  return text;
}

/**
 * 将日期格式 YYYYMMDD 显示为 YYYY.MM.DD
 * @param {string} d
 * @returns {string}
 */
export function formatDate(d) {
  if (!d || d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}
