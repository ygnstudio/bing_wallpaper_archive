/**
 * 应用入口
 * 组合各模块，完成初始化、事件绑定与全局交互。
 */

import './types.js';
import { CACHE_BUST, ROOT_MARGIN } from './config.js';
import { loadIndex, buildResUrl, fetchBytes, ensureItemLoaded } from './api.js';
import { setItems, setFiltered, setRendered, setDateBounds, setActiveCat, setActiveColor, activeCat, activeColor } from './state.js';
import { getFiltered } from './filter.js';
import { initMonthPicker, setupDateInputs, swapDateRange } from './picker.js';
import { renderCategoryPills, renderColorPills, renderHero, renderMore, updateFilterCount, updateStats } from './ui.js';
import { initLightbox, openLightbox } from './lightbox.js';
import { initBatch, updateBatchBar } from './batch.js';
import { initWorker, getFiltered as workerGetFiltered, countBy as workerCountBy } from './filter-worker.js';

// === DOM 元素 ===
const els = {
  grid: document.getElementById('grid'),
  sentinel: document.getElementById('sentinel'),
  emptyEl: document.getElementById('empty'),
  searchEl: document.getElementById('search'),
  dateFrom: /** @type {HTMLInputElement} */ (document.getElementById('date-from')),
  dateTo: /** @type {HTMLInputElement} */ (document.getElementById('date-to')),
  dateFromTrigger: document.getElementById('date-from-trigger'),
  dateToTrigger: document.getElementById('date-to-trigger'),
  dateClear: document.getElementById('date-clear'),
  dateSwap: document.getElementById('date-swap'),
  monthPicker: document.getElementById('month-picker'),
  mpPrev: document.getElementById('mp-prev'),
  mpNext: document.getElementById('mp-next'),
  mpYear: document.getElementById('mp-year'),
  mpGrid: document.getElementById('mp-grid'),
  mpClear: document.getElementById('mp-clear'),
  mpThis: document.getElementById('mp-this'),
  lightbox: document.getElementById('lightbox'),
  lbClose: document.getElementById('close'),
  lbImg: /** @type {HTMLImageElement} */ (document.getElementById('lb-img')),
  lbTitle: document.getElementById('lb-title'),
  lbCopyright: document.getElementById('lb-copyright'),
  lbNote: document.getElementById('lb-note'),
  lbRes: /** @type {HTMLSelectElement} */ (document.getElementById('lb-res')),
  lbLink: /** @type {HTMLAnchorElement} */ (document.getElementById('lb-link')),
  lbDownload: /** @type {HTMLAnchorElement} */ (document.getElementById('lb-download')),
  lbCopy: document.getElementById('lb-copy'),
  lbCopyMd: document.getElementById('lb-copy-md'),
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
  heroView: document.getElementById('hero-view')
};

// === 月份选择器相关函数（需访问 DOM） ===
function updateDateTriggerText() {
  const fromText = els.dateFromTrigger.querySelector('.month-trigger-text');
  const toText = els.dateToTrigger.querySelector('.month-trigger-text');
  fromText.textContent = els.dateFrom.value || '';
  toText.textContent = els.dateTo.value || '';
}

// === 初始化 ===
async function init() {
  const data = await loadIndex(CACHE_BUST);
  setItems(data);
  const allYm = data.map(i => i.date.slice(0, 6)).sort();
  setDateBounds(allYm[0], allYm[allYm.length - 1]);

  // 后台预加载最近两年的完整数据（Hero / 当前滚动区域常用）
  const currentYear = String(new Date().getFullYear());
  const prevYear = String(+currentYear - 1);
  import('./api.js').then(({ ensureYearLoaded }) => {
    ensureYearLoaded(currentYear).catch(() => {});
    ensureYearLoaded(prevYear).catch(() => {});
  });

  // 在后台初始化 Worker（失败会自动 fallback 主线程）
  initWorker().catch(() => {});

  setupDateInputs(els);
  updateDateTriggerText();
  initMonthPicker({ ...els, updateDateTriggerText, applyFilter });
  initLightbox(els);
  initBatch({ ...els, openLightbox: (it) => openLightbox(it, els) });
  bindEvents();
  detectTouch();
  setupBatchbarNearFooter();

  await renderHero({
    hero: els.hero,
    heroBgImg: els.heroBgImg,
    heroDate: els.heroDate,
    heroTitle: els.heroTitle,
    heroDesc: els.heroDesc,
    heroDownload: els.heroDownload,
    heroDownloadText: els.heroDownloadText,
    heroView: els.heroView,
    downloadHero,
    openLightbox: (it) => openLightbox(it, els)
  });
  await applyFilter();
  updateStats(els.archiveStats);
}

/**
 * 应用筛选并重置渲染
 */
async function applyFilter() {
  const q = els.searchEl.value;
  const dateFrom = els.dateFrom.value;
  const dateTo = els.dateTo.value;
  const params = { q, dateFrom, dateTo, activeCat, activeColor };
  const filteredData = await workerGetFiltered(params);
  setFiltered(filteredData);
  setRendered(0);
  els.grid.innerHTML = '';
  renderMore({ ...els, openLightbox: (it) => openLightbox(it, els) });
  await Promise.all([
    renderCategoryPills(els.catPills, (v) => { setActiveCat(v); applyFilter(); }, q, dateFrom, dateTo, workerCountBy),
    renderColorPills(els.colorPills, (v) => { setActiveColor(v); applyFilter(); }, q, dateFrom, dateTo, workerCountBy)
  ]);
  updateFilterCount(els.filterCount);
  updateBatchBar(els);
}

// === Hero 下载 ===
/**
 * 下载最新壁纸（Hero）
 * @param {WallpaperItem} it
 * @param {string} res
 */
async function downloadHero(it, res) {
  if (res === 'UHD' && it.uhd === false) res = '1920x1080';
  try {
    const full = await ensureItemLoaded(it);
    const url = buildResUrl(full.url, res) || full.url;
    const bytes = await fetchBytes(url);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${full.date}_${res}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) {
    openLightbox(it, els);
  }
}

// === 事件绑定 ===
function bindEvents() {
  els.searchEl.addEventListener('input', applyFilter);
  els.dateClear.addEventListener('click', () => {
    els.dateFrom.value = '';
    els.dateTo.value = '';
    updateDateTriggerText();
    applyFilter();
  });
  els.dateSwap.addEventListener('click', (e) => { e.stopPropagation(); swapDateRange({ ...els, updateDateTriggerText, applyFilter }); });
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

// === 页脚进入视口时隐藏批量按钮 ===
function setupBatchbarNearFooter() {
  const footer = document.querySelector('.footer');
  if (!footer || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      els.batchbar.classList.toggle('near-footer', e.isIntersecting && e.intersectionRatio > 0.05);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: [0, 0.05, 0.2] });
  observer.observe(footer);
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
    els.archiveStats.textContent = '页面运行出现异常，请刷新重试';
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[site unhandled]', e.reason);
  if (els.archiveStats && !els.archiveStats.textContent.includes('加载失败')) {
    els.archiveStats.textContent = '页面运行出现异常，请刷新重试';
  }
});

init().catch(err => { els.archiveStats.textContent = '加载失败：' + err; });

// 注册 Service Worker（线上环境启用缓存）
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./assets/sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}
