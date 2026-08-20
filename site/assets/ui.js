/**
 * 通用 UI 渲染
 * 分类/颜色 Pill、卡片网格、Hero、统计信息。
 */

import { CATEGORY_ORDER, COLOR_ORDER, COLOR_HEX, PAGE_SIZE, DEFAULT_HERO_RES } from './config.js';
import { countBy, formatDate, getFiltered } from './filter.js';
import { buildResUrl, defaultResolution } from './api.js';
import { activeCat, activeColor, filtered, rendered, selected, setRendered, items } from './state.js';

/**
 * 渲染分类 Pill
 * @param {HTMLElement} container
 * @param {Function} onClick
 * @param {string} q
 * @param {string} dateFrom
 * @param {string} dateTo
 * @param {Function} countFn
 */
export async function renderCategoryPills(container, onClick, q, dateFrom, dateTo, countFn) {
  const present = new Set(items.map(i => i.category).filter(Boolean));
  container.innerHTML = '';
  const allBtn = makePill('全部', '', activeCat === '', container, onClick);
  allBtn.setAttribute('role', 'tab');
  for (const c of CATEGORY_ORDER) {
    if (!present.has(c)) continue;
    const n = await countFn({ dim: 'category', value: c, q, dateFrom, dateTo, activeCat, activeColor });
    const btn = makePill(c, c, activeCat === c, container, onClick, n);
    btn.setAttribute('role', 'tab');
  }
}

/**
 * 渲染颜色 Pill
 * @param {HTMLElement} container
 * @param {Function} onClick
 * @param {string} q
 * @param {string} dateFrom
 * @param {string} dateTo
 * @param {Function} countFn
 */
export async function renderColorPills(container, onClick, q, dateFrom, dateTo, countFn) {
  const present = new Set(items.map(i => i.color).filter(Boolean));
  container.innerHTML = '';
  const allBtn = makeColorPill('全部', '', activeColor === '', container, onClick);
  allBtn.setAttribute('role', 'tab');
  for (const c of COLOR_ORDER) {
    if (!present.has(c)) continue;
    const n = await countFn({ dim: 'color', value: c, q, dateFrom, dateTo, activeCat, activeColor });
    const btn = makeColorPill(c, c, activeColor === c, container, onClick, n);
    btn.setAttribute('role', 'tab');
  }
}

/**
 * 创建普通 Pill 按钮
 * @param {string} label
 * @param {string} value
 * @param {boolean} active
 * @param {HTMLElement} parent
 * @param {Function} onClick
 * @param {number} [count]
 * @returns {HTMLButtonElement}
 */
function makePill(label, value, active, parent, onClick, count) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill' + (active ? ' active' : '');
  btn.textContent = count != null ? `${label} ${count}` : label;
  btn.addEventListener('click', () => onClick(value));
  parent.appendChild(btn);
  return btn;
}

/**
 * 创建颜色 Pill 按钮
 * @param {string} label
 * @param {string} value
 * @param {boolean} active
 * @param {HTMLElement} parent
 * @param {Function} onClick
 * @param {number} [count]
 * @returns {HTMLButtonElement}
 */
function makeColorPill(label, value, active, parent, onClick, count) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'color-pill' + (active ? ' active' : '');
  const dot = document.createElement('span');
  dot.className = 'color-dot';
  if (value) dot.style.background = COLOR_HEX[value] || 'transparent';
  else dot.classList.add('all');
  btn.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = count != null ? `${label} ${count}` : label;
  btn.appendChild(text);
  btn.addEventListener('click', () => onClick(value));
  parent.appendChild(btn);
  return btn;
}

/**
 * 渲染顶部 Hero 区域
 * @param {Object} els
 * @param {Function} els.downloadHero
 * @param {Function} els.openLightbox
 */
export function renderHero(els) {
  const latest = items[0];
  if (!latest) return;
  els.hero.hidden = false;

  // 首屏默认加载 1080p，点击/下载再按需升级 UHD
  const initialRes = DEFAULT_HERO_RES;
  const full = buildResUrl(latest.url, initialRes) || latest.url;
  els.heroBgImg.src = full;
  els.heroBgImg.alt = latest.title || latest.date;

  // 若 1080p 也失败，回退原 url
  els.heroBgImg.onerror = () => {
    els.heroBgImg.onerror = null;
    if (els.heroBgImg.src !== latest.url) els.heroBgImg.src = latest.url;
  };

  els.heroDate.textContent = formatDate(latest.date);
  els.heroTitle.textContent = latest.title || latest.date;
  els.heroDesc.textContent = latest.copyright || '';

  const heroUhd = latest.uhd !== false;
  els.heroDownloadText.textContent = heroUhd ? '下载 UHD 4K' : '下载 1080p';
  els.heroDownload.onclick = () => els.downloadHero(latest, heroUhd ? 'UHD' : '1920x1080');
  els.heroView.onclick = () => {
    els.openLightbox(latest);
  };
}

/**
 * 渲染一批卡片
 * @param {Object} els
 * @param {HTMLElement} els.grid
 * @param {HTMLElement} els.sentinel
 * @param {HTMLElement} els.emptyEl
 * @param {Function} els.openLightbox
 * @returns {number} 本次渲染数量
 */
export function renderMore(els) {
  const batch = filtered.slice(rendered, rendered + PAGE_SIZE);
  const frag = document.createDocumentFragment();
  for (const it of batch) {
    frag.appendChild(createCard(it, els.openLightbox));
  }
  els.grid.appendChild(frag);
  const newRendered = rendered + batch.length;
  setRendered(newRendered);
  els.emptyEl.hidden = filtered.length !== 0;
  els.sentinel.textContent = newRendered < filtered.length
    ? `加载更多…（${newRendered}/${filtered.length}）`
    : (newRendered ? '已显示全部' : '');
  return batch.length;
}

/**
 * 创建单张卡片 DOM
 * @param {WallpaperItem} it
 * @param {Function} openLightbox
 * @returns {HTMLElement}
 */
function createCard(it, openLightbox) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.date = it.date;
  card.title = (it.title || '') + (it.copyright ? ' — ' + it.copyright : '');

  const sel = document.createElement('input');
  sel.type = 'checkbox';
  sel.className = 'sel';
  sel.dataset.date = it.date;
  sel.checked = selected.has(it.date);
  sel.title = '选择打包下载';
  if (sel.checked) card.classList.add('selected');
  card.appendChild(sel);

    const media = document.createElement('div');
    media.className = 'media';
    if (it.thumbnail) {
      const webpUrl = it.thumbnail.replace(/\.jpg$/i, '.webp');
      const picture = document.createElement('picture');
      const source = document.createElement('source');
      source.srcset = webpUrl;
      source.type = 'image/webp';
      picture.appendChild(source);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = it.thumbnail;
      img.alt = it.title || it.date;
      picture.appendChild(img);
      media.appendChild(picture);
    } else {
    card.classList.add('missing');
    const ph = document.createElement('div');
    ph.className = 'ph';
    ph.textContent = it.date;
    media.appendChild(ph);
  }
  card.appendChild(media);

  const info = document.createElement('div');
  info.className = 'info';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = it.title || it.date;
  info.appendChild(title);

  const tag = document.createElement('div');
  tag.className = 'tag';
  if (it.category) tag.textContent = it.category;
  info.appendChild(tag);
  card.appendChild(info);

  card.addEventListener('click', (e) => {
    if (e.target.closest('.sel')) return;
    openLightbox(it);
  });
  return card;
}

/**
 * 更新筛选结果计数
 * @param {HTMLElement} filterCount
 */
export function updateFilterCount(filterCount) {
  if (!filterCount) return;
  filterCount.textContent = `当前筛选：${filtered.length.toLocaleString()} 张`;
}

/**
 * 更新顶部统计与页面标题
 * @param {HTMLElement} archiveStats
 */
export function updateStats(archiveStats) {
  archiveStats.textContent = `已归档 ${items.length.toLocaleString()} 张 · 每日更新`;
  document.title = `Bing 每日壁纸归档 · ${items.length.toLocaleString()} 张`;
}
