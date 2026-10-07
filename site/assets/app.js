import { t, translateStatic, setMessage } from './i18n.js';
import { downloadPhoto } from './download.js';
import { animateIn, scrollToGallery, canAnimate } from './motion.js';
import { initNavigation } from './navigation.js';
/**
 * 应用入口
 * 组合各模块，完成初始化、事件绑定与全局交互。
 */

import './types.js';
import { CACHE_BUST, ROOT_MARGIN } from './config.js';
import { loadIndex } from './api.js';
import { setItems, setFiltered, setRendered, setDateBounds, setActiveCat, setActiveColor, activeCat, activeColor, byDate, rendered, filtered } from './state.js';
import { evaluateFilters } from './filter.js';
import { initIcons } from './icons.js';
import { normalizeDate } from './dates.js';
import { setupDateInputs, syncDateInputs } from './picker.js';
import { renderCategoryPills, renderColorPills, renderHero, refreshHeroLabels, renderMore, updateFilterCount, updateStats } from './ui.js';
import { initLightbox, openLightbox } from './lightbox.js';
import { initBatch, updateBatchBar } from './batch.js';
import { readStateFromUrl, syncFiltersToUrl } from './urlstate.js';

// === DOM 元素 ===
const els = {
  grid: document.getElementById('grid'),
  heroStatus: document.getElementById('hero-status'),
  lbStatus: document.getElementById('lb-status'),
  lbRetry: document.getElementById('lb-retry'),
  sentinel: document.getElementById('sentinel'),
  emptyEl: document.getElementById('empty'),
  searchEl: document.getElementById('search'),
  dateFrom: /** @type {HTMLInputElement} */ (document.getElementById('date-from')),
  dateTo: /** @type {HTMLInputElement} */ (document.getElementById('date-to')),
  dateClear: document.getElementById('date-clear'),
  dateToggle: document.getElementById('date-toggle'),
  datePanel: document.getElementById('date-panel'),
  dateLabel: document.getElementById('date-label'),
  filterReset: document.getElementById('filter-reset'),
  colorLabel: document.getElementById('color-label'),
  batchDone: document.getElementById('batch-done'),
  batchToggleText: document.getElementById('batch-toggle-text'),
  heroShuffle: document.getElementById('hero-shuffle'),
  lightbox: document.getElementById('lightbox'),
  lbClose: document.getElementById('close'),
  lbImg: /** @type {HTMLImageElement} */ (document.getElementById('lb-img')),
  lbTitle: document.getElementById('lb-title'),
  lbCopyright: document.getElementById('lb-copyright'),
  lbNote: document.getElementById('lb-note'),
  lbRes: /** @type {HTMLSelectElement} */ (document.getElementById('lb-res')),
  lbLink: /** @type {HTMLAnchorElement} */ (document.getElementById('lb-link')),
  lbDownload: /** @type {HTMLButtonElement} */ (document.getElementById('lb-download')),
  lbCopy: document.getElementById('lb-copy'),
  lbCopyMd: document.getElementById('lb-copy-md'),
  lbPrev: document.getElementById('lb-prev'),
  lbNext: document.getElementById('lb-next'),
  batchbar: document.getElementById('batchbar'),
  batchPanel: document.getElementById('batch-panel'),
  batchToggle: document.getElementById('batch-toggle'),
  batchBadge: document.getElementById('batch-badge'),
  batchCount: document.getElementById('batch-count'),
  batchRes: /** @type {HTMLSelectElement} */ (document.getElementById('batch-res')),
  batchZip: document.getElementById('batch-zip'),
  batchClear: document.getElementById('batch-clear'),
  batchSelectAll: document.getElementById('batch-selectall'),
  batchProgress: document.getElementById('batch-progress'),
  batchResNote: document.getElementById('batch-res-note'),
  catPills: document.getElementById('cat-pills'),
  colorPills: document.getElementById('color-pills'),
  filterCount: document.getElementById('filter-count'),
  archiveStats: document.getElementById('archive-stats'),
  hero: document.getElementById('hero'),
  heroBgImg: /** @type {HTMLImageElement} */ (document.getElementById('hero-bg-img')),
  heroDate: document.getElementById('hero-date'),
  heroTitle: document.getElementById('hero-title'),
  heroDesc: document.getElementById('hero-desc'),
  heroDownload: document.getElementById('hero-download'),
  heroDownloadText: document.getElementById('hero-download-text'),
  heroView: document.getElementById('hero-view'),
  backToTop: document.getElementById('back-to-top')
};

// === 日期选择器相关函数（需访问 DOM） ===
function updateDateTriggerText() {
  syncDateInputs();
  const from = els.dateFrom.value, to = els.dateTo.value;
  els.dateLabel.textContent = from || to ? t('{from} 至 {to}',{from:from || t('最早'),to:to || t('最新')}) : t('日期范围');
  els.dateToggle.classList.toggle('has-value', !!(from || to));
}

// === 初始化 ===
async function init() {
  initIcons();
  const data = await loadIndex(CACHE_BUST);
  setItems(data);
  const allDates = data.map(i => i.date).sort();
  setDateBounds(allDates[0], allDates[allDates.length - 1]);

  // 从 URL 恢复筛选状态（分享链接 / 刷新保持）
  const urlState = readStateFromUrl();
  if (urlState.q) els.searchEl.value = urlState.q;
  els.dateFrom.value = normalizeDate(urlState.from);
  els.dateTo.value = normalizeDate(urlState.to, true);
  const presentCats = new Set(data.map(i => i.category).filter(Boolean));
  const presentColors = new Set(data.map(i => i.color).filter(Boolean));
  if (urlState.cat && presentCats.has(urlState.cat)) setActiveCat(urlState.cat);
  if (urlState.col && presentColors.has(urlState.col)) setActiveColor(urlState.col);

  setupDateInputs({ ...els, updateDateTriggerText, applyFilter });
  updateDateTriggerText();
  if (els.dateFrom.value || els.dateTo.value) {
    els.datePanel.hidden = false;
    els.dateToggle.setAttribute('aria-expanded', 'true');
  }
  initLightbox(els);
  initBatch({ ...els, openLightbox: (it) => openLightbox(it, els) });
  bindEvents();
  detectTouch();
  setupBackToTop();

  const heroEls = { ...els, downloadHero, openLightbox: (it) => openLightbox(it, els) };
  renderHero(heroEls).catch(() => { els.hero.hidden = true; });
  els.heroShuffle.addEventListener('click', async () => {
    els.heroShuffle.disabled = true;
    try { await renderHero(heroEls); }
    catch { setMessage(els.heroStatus,'加载失败，请刷新重试'); }
    finally { els.heroShuffle.disabled = false; }
  });
  applyFilter(urlState.d);
  updateStats(els.archiveStats);
  translateStatic();
  document.addEventListener('languagechange', () => {
    updateDateTriggerText(); updateStats(els.archiveStats); updateFilterCount(els.filterCount); updateBatchBar(els); refreshHeroLabels(els);
    updateFilterControls();
    els.sentinel.textContent=rendered < filtered.length ? t('继续浏览 · 已显示 {n} 张',{n:rendered}) : rendered ? t('已显示全部壁纸') : '';
    els.grid.querySelectorAll('.card').forEach(card=>{
      const item=byDate.get(card.dataset.date);
      card.querySelector('.sel').setAttribute('aria-label',t('选择 {title}',{title:item.title || item.date}));
      card.querySelector('.media').setAttribute('aria-label',t('查看 {title}',{title:item.title || item.date}));
      card.querySelector('[data-category]').textContent=t(item.category || '');
    });
    translateStatic();
  });

  // URL 带 d 参数时直接打开对应灯箱（分享直达）
  if (urlState.d) {
    const it = byDate.get(urlState.d);
    if (it) openLightbox(it, els, { fromUrl: true });
  }
}

/**
 * 应用筛选并重置渲染
 */
function applyFilter(lightboxDate = '') {
  const replacing = els.grid.children.length > 0;
  const q = els.searchEl.value;
  const dateFrom = els.dateFrom.value, dateTo = els.dateTo.value;
  const snapshot = evaluateFilters(q, dateFrom, dateTo);
  setFiltered(snapshot.results);
  setRendered(0);
  els.grid.replaceChildren();
  renderMore({ ...els, openLightbox: (it) => openLightbox(it, els) });
  if(replacing) animateIn(els.grid,6);
  updateFilterControls(snapshot);
  els.filterReset.hidden = !(q || dateFrom || dateTo || activeCat || activeColor);
  updateFilterCount(els.filterCount);
  updateBatchBar(els);
  syncFiltersToUrl({ q, from: dateFrom, to: dateTo, cat: activeCat, col: activeColor }, { keepLightbox: !!lightboxDate, lightboxDate });
}

function updateFilterControls(snapshot) {
  const q=els.searchEl.value, dateFrom=els.dateFrom.value, dateTo=els.dateTo.value;
  snapshot ||= evaluateFilters(q, dateFrom, dateTo);
  const count = p => (p.dim === 'category' ? snapshot.categories : snapshot.colors).get(p.value) || 0;
  renderCategoryPills(els.catPills, v => { setActiveCat(v); applyFilter(); }, q, dateFrom, dateTo, count);
  renderColorPills(els.colorPills, v => { setActiveColor(v); applyFilter(); }, q, dateFrom, dateTo, count);
  els.colorLabel.textContent = activeColor ? t(activeColor) : t('全部颜色');
  const active=[activeCat ? t(activeCat) : '',activeColor ? t(activeColor) : '',dateFrom || dateTo ? els.dateLabel.textContent : ''].filter(Boolean);
  document.getElementById('active-filters').textContent=active.join(' · ');
  document.getElementById('filter-toggle-text').textContent=t('筛选')+(active.length ? ` (${active.length})` : '');
}

// === Hero 下载 ===
/**
 * 下载最新壁纸（Hero）
 * @param {WallpaperItem} it
 * @param {string} res
 */
async function downloadHero(it, res) {
  return downloadPhoto(it,res,els.heroDownload,els.heroStatus);
}

// === 事件绑定 ===
function bindEvents() {
  // 搜索防抖：停止输入 250ms 后再触发筛选，避免逐键全量重算
  let searchTimer = 0;
  els.searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 250);
  });
  els.dateClear.addEventListener('click', () => {
    els.dateFrom.value = '';
    els.dateTo.value = '';
    updateDateTriggerText();
    applyFilter();
  });
  els.dateToggle.addEventListener('click', () => {
    els.datePanel.hidden = !els.datePanel.hidden;
    els.dateToggle.setAttribute('aria-expanded', String(!els.datePanel.hidden));
  });
  const reset = () => {
    clearTimeout(searchTimer);
    els.searchEl.value = els.dateFrom.value = els.dateTo.value = '';
    setActiveCat(''); setActiveColor('');
    updateDateTriggerText(); applyFilter();
  };
  els.filterReset.addEventListener('click', reset);
  document.getElementById('empty-reset').addEventListener('click', reset);
  initNavigation({ resetFilters:reset, applySearch:()=>{ clearTimeout(searchTimer); applyFilter(); }});
}

// === 无限滚动 ===
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      renderMore({ ...els, openLightbox: (it) => openLightbox(it, els) });
    }
  }
}, { rootMargin: ROOT_MARGIN });
io.observe(els.sentinel);

// === 返回顶部按钮 ===
function setupBackToTop() {
  const btn = els.backToTop;
  if (!btn) return;
  const showThreshold = 400;
  const toggle = () => {
    const scrolled = window.scrollY || document.documentElement.scrollTop;
    btn.classList.toggle('visible', scrolled > showThreshold);
  };
  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: canAnimate(document.body) ? 'smooth' : 'instant' });
  });
  toggle();
}

// === 触摸屏检测 ===
function detectTouch() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');
}

// 全局错误捕获：线上环境打印并提示，避免静默失败
window.addEventListener('error', (e) => {
  console.error('[site error]', e.error || e.message);
  if (els.archiveStats && !els.archiveStats.textContent.includes('加载失败')) {
    els.archiveStats.textContent = t('页面运行出现异常，请刷新重试');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[site unhandled]', e.reason);
  if (els.archiveStats && !els.archiveStats.textContent.includes('加载失败')) {
    els.archiveStats.textContent = t('页面运行出现异常，请刷新重试');
  }
});

init().catch(err => { els.archiveStats.textContent = t('加载失败，请刷新重试'); });

// 注册 Service Worker（线上环境启用缓存）
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}
