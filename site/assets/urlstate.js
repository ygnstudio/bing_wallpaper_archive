/**
 * URL 状态同步
 * 筛选条件用 replaceState 同步（不产生历史记录），
 * 灯箱用 pushState（后退即关闭）。
 */

/**
 * 从 URL 读取筛选与灯箱状态
 * @returns {{q: string, cat: string, col: string, from: string, to: string, d: string}}
 */
export function readStateFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') || '',
    cat: p.get('cat') || '',
    col: p.get('col') || '',
    from: p.get('from') || '',
    to: p.get('to') || '',
    d: p.get('d') || ''
  };
}

/**
 * 将筛选条件同步到 URL（替换当前历史记录）
 * @param {{q: string, cat: string, col: string, from: string, to: string}} s
 * @param {{keepLightbox?: boolean, lightboxDate?: string}} [opt]
 */
export function syncFiltersToUrl(s, opt = {}) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.cat) p.set('cat', s.cat);
  if (s.col) p.set('col', s.col);
  if (s.from) p.set('from', s.from);
  if (s.to) p.set('to', s.to);
  if (opt.keepLightbox && opt.lightboxDate) p.set('d', opt.lightboxDate);
  const qs = p.toString();
  history.replaceState(history.state, '', qs ? `?${qs}` : location.pathname);
}

/**
 * 灯箱打开/切换时更新 URL
 * @param {boolean} push - 首次打开用 pushState（后退可关闭），切换用 replaceState
 * @param {string} date - YYYYMMDD
 */
export function setLightboxUrl(push, date) {
  const p = new URLSearchParams(location.search);
  p.set('d', date);
  const url = `?${p.toString()}`;
  if (push) history.pushState({ lb: date }, '', url);
  else history.replaceState({ lb: date }, '', url);
}

/**
 * 灯箱关闭时清除 URL 中的 d 参数
 * 通过 history.back() 撤销 pushState；若非本页推入（直链进入）则 replaceState。
 */
export function clearLightboxUrl() {
  const p = new URLSearchParams(location.search);
  if (!p.has('d')) return;
  if (history.state && history.state.lb) {
    history.back();
  } else {
    p.delete('d');
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `?${qs}` : location.pathname);
  }
}
