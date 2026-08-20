/**
 * 筛选逻辑
 * 日期范围、分类、颜色、搜索关键词的组合过滤与计数。
 */

import { activeCat, activeColor, items, dateMinYm, dateMaxYm } from './state.js';

/**
 * 判断 item 的日期是否落在当前选择范围内
 * @param {WallpaperItem} i
 * @param {string} from - YYYY-MM 或空
 * @param {string} to - YYYY-MM 或空
 * @returns {boolean}
 */
export function inDateRange(i, from, to) {
  const ym = +i.date.slice(0, 6);
  if (from && ym < +from.replace('-', '')) return false;
  if (to && ym > +to.replace('-', '')) return false;
  return true;
}

/**
 * 统计某个维度（category/color）在当前其他维度条件下的命中数量
 * @param {'category'|'color'} dim
 * @param {string} value
 * @param {string} q - 搜索词
 * @param {string} dateFrom - YYYY-MM 或空
 * @param {string} dateTo - YYYY-MM 或空
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
 * @param {string} dateFrom - YYYY-MM 或空
 * @param {string} dateTo - YYYY-MM 或空
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

/**
 * 将 YYYYMM 格式化为 YYYY-MM
 * @param {string} ym
 * @returns {string}
 */
export function fmtYm(ym) {
  return ym.slice(0, 4) + '-' + ym.slice(4, 6);
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

export { dateMinYm, dateMaxYm };
