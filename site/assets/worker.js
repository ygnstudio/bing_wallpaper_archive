/**
 * Web Worker：索引构建与筛选
 * 在后台线程中加载 index.json，构建倒排索引，响应主线程的筛选请求。
 */

/** @type {Array<WallpaperItem>} */
let items = [];
/** @type {Map<string, Set<number>>} */
let invertedIndex = new Map();
let ready = false;

self.onmessage = function (e) {
  const { type, payload, id } = e.data;
  if (type === 'load') {
    loadIndex(payload.url, payload.cacheBust).then(() => {
      self.postMessage({ type: 'ready', id });
    }).catch(err => {
      self.postMessage({ type: 'error', id, error: err.message });
    });
  } else if (type === 'filter') {
    const result = applyFilter(payload);
    self.postMessage({ type: 'result', id, result });
  } else if (type === 'count') {
    const result = countBy(payload);
    self.postMessage({ type: 'result', id, result });
  }
};

/**
 * 加载并索引数据
 * @param {string} url
 * @param {string} [cacheBust]
 */
async function loadIndex(url, cacheBust) {
  const fullUrl = cacheBust ? `${url}?v=${cacheBust}` : url;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  items = await res.json();
  buildInvertedIndex();
  ready = true;
}

/**
 * 构建标题/版权/日期的倒排索引
 */
function buildInvertedIndex() {
  invertedIndex = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const text = ((it.title || '') + ' ' + (it.copyright || '') + ' ' + (it.date || '')).toLowerCase();
    // 按非字母数字汉字分割
    const tokens = text.split(/[^\u4e00-\u9fa5a-z0-9]+/).filter(Boolean);
    const seen = new Set();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      if (!invertedIndex.has(token)) invertedIndex.set(token, new Set());
      invertedIndex.get(token).add(i);
    }
  }
}

/**
 * 应用筛选
 * @param {Object} p
 * @param {string} p.q
 * @param {string} p.activeCat
 * @param {string} p.activeColor
 * @param {string} p.dateFrom
 * @param {string} p.dateTo
 * @returns {Array<WallpaperItem>}
 */
function applyFilter(p) {
  const query = (p.q || '').trim().toLowerCase();
  let candidates = null;

  if (query) {
    const tokens = query.split(/[^\u4e00-\u9fa5a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      const set = invertedIndex.get(token);
      if (!set) return [];
      if (candidates === null) {
        candidates = new Set(set);
      } else {
        for (const idx of candidates) {
          if (!set.has(idx)) candidates.delete(idx);
        }
      }
      if (candidates.size === 0) return [];
    }
  }

  const source = candidates === null ? items : [...candidates].map(i => items[i]);
  return source.filter(i => matches(i, p));
}

/**
 * 统计某维度数量
 * @param {Object} p
 * @param {'category'|'color'} p.dim
 * @param {string} p.value
 * @param {string} p.q
 * @param {string} p.activeCat
 * @param {string} p.activeColor
 * @param {string} p.dateFrom
 * @param {string} p.dateTo
 * @returns {number}
 */
function countBy(p) {
  const query = (p.q || '').trim().toLowerCase();
  let candidates = null;

  if (query) {
    const tokens = query.split(/[^\u4e00-\u9fa5a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      const set = invertedIndex.get(token);
      if (!set) return 0;
      if (candidates === null) {
        candidates = new Set(set);
      } else {
        for (const idx of candidates) {
          if (!set.has(idx)) candidates.delete(idx);
        }
      }
      if (candidates.size === 0) return 0;
    }
  }

  const source = candidates === null ? items : [...candidates].map(i => items[i]);
  return source.filter(i => matchesForCount(i, p)).length;
}

function matches(i, p) {
  if (!inDateRange(i, p.dateFrom, p.dateTo)) return false;
  if (p.activeCat && i.category !== p.activeCat) return false;
  if (p.activeColor && i.color !== p.activeColor) return false;
  return true;
}

function matchesForCount(i, p) {
  if (!inDateRange(i, p.dateFrom, p.dateTo)) return false;
  if (p.dim !== 'category' && p.activeCat && i.category !== p.activeCat) return false;
  if (p.dim !== 'color' && p.activeColor && i.color !== p.activeColor) return false;
  return i[p.dim] === p.value;
}

function inDateRange(i, from, to) {
  const ym = +i.date.slice(0, 6);
  if (from && ym < +from.replace('-', '')) return false;
  if (to && ym > +to.replace('-', '')) return false;
  return true;
}
