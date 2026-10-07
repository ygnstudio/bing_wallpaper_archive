import { updatePhotoAccent } from './accent.js';
import { animateIn } from './motion.js';
import { t, setMessage } from './i18n.js';
import { icon } from './icons.js';
/** Rendering for the compact photo archive. */
import { CATEGORY_ORDER, COLOR_ORDER, COLOR_HEX, PAGE_SIZE, DEFAULT_HERO_RES } from './config.js';
import { formatDate } from './filter.js';
import { buildResUrl, ensureItemLoaded } from './api.js';
import { activeCat, activeColor, filtered, rendered, selected, setRendered, items } from './state.js';

function updateChoices(container, values, active, onClick, count, color = false) {
  // Reuse buttons so clicking a filter does not discard keyboard focus.
  if (!container.children.length) {
    for (const value of ['', ...values]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = value;
      button.className = color ? 'color-pill' : 'pill';
      if (color) {
        const dot = document.createElement('span');
        dot.className = 'color-dot' + (value ? '' : ' all');
        if (value) dot.style.background = COLOR_HEX[value];
        button.append(dot);
      } else {
        const label = document.createElement('span');
        label.className = 'choice-label';
        button.append(label);
      }
      container.append(button);
    }
  }
  for (const button of container.children) {
    const value = button.dataset.value;
    const label = t(value || (color ? '全部颜色' : '全部'));
    if (!color) button.querySelector('.choice-label').textContent=label;
    const n = value ? count(value) : null;
    button.classList.toggle('active', value === active);
    button.setAttribute('aria-pressed', String(value === active));
    button.setAttribute('aria-label', n === null ? label : t('{label}，{n} 张',{label,n:n.toLocaleString()}));
    button.title = n === null ? label : `${label} · ${n.toLocaleString()} 张`;
    button.onclick = () => onClick(value);
  }
}

export function renderCategoryPills(container, onClick, q, dateFrom, dateTo, countFn) {
  const present = new Set(items.map(i => i.category));
  updateChoices(container, CATEGORY_ORDER.filter(c => present.has(c)), activeCat, onClick,
    value => countFn({ dim: 'category', value, q, dateFrom, dateTo, activeCat, activeColor }));
}
export function renderColorPills(container, onClick, q, dateFrom, dateTo, countFn) {
  const present = new Set(items.map(i => i.color));
  updateChoices(container, COLOR_ORDER.filter(c => present.has(c)), activeColor, onClick,
    value => countFn({ dim: 'color', value, q, dateFrom, dateTo, activeCat, activeColor }), true);
}

let heroGeneration = 0;
let heroDate = '';
export async function renderHero(els) {
  const generation = ++heroGeneration;
  const candidates = items.filter(it => it.date !== heroDate);
  const choice = candidates[Math.floor(Math.random() * candidates.length)] || items[0];
  if (!choice) return;
  let latest = choice;
  const replacing = !!heroDate;
  heroDate = latest.date;
  els.hero.hidden = false;
  document.body.classList.add('has-hero');
  const full = buildResUrl(latest.url, DEFAULT_HERO_RES) || latest.url;
  els.heroBgImg.alt = latest.title || latest.date;
  els.heroBgImg.src = latest.thumbnail || full;
  els.heroBgImg.decoding = 'async';
  updatePhotoAccent(latest.thumbnail, () => generation === heroGeneration);
  if(replacing) { animateIn(els.heroBgImg,0); animateIn(els.heroTitle,6); }
  els.heroDate.textContent = formatDate(latest.date);
  els.heroDate.dateTime = `${latest.date.slice(0,4)}-${latest.date.slice(4,6)}-${latest.date.slice(6,8)}`;
  els.heroTitle.textContent = latest.title || latest.date;
  els.heroDesc.textContent = latest.copyright || '';
  const uhd = latest.uhd !== false;
  els.heroDownloadText.textContent = t(uhd ? '下载 UHD' : '下载 1080p');
  els.heroDownload.setAttribute('aria-label',els.heroDownloadText.textContent);
  document.getElementById('hero-download-compact').textContent=uhd ? 'UHD' : '1080p';
  setMessage(els.heroStatus,'');
  els.heroDownload.onclick = () => els.downloadHero(latest, uhd ? 'UHD' : '1920x1080');
  els.heroView.onclick = () => els.openLightbox(latest);
  // Paint the local thumbnail before fetching the year's full metadata.
  try {
    const loaded = await ensureItemLoaded(choice);
    if (generation !== heroGeneration) return;
    latest = loaded;
    const full = buildResUrl(latest.url, DEFAULT_HERO_RES) || latest.url;
    if (!full) return;
    const hi = new Image();
    hi.onload = () => { if (generation === heroGeneration) els.heroBgImg.src = full; };
    hi.src = full;
  } catch {
    // The local photo and its actions remain usable; opening/downloading retries.
    if (!choice.thumbnail && generation === heroGeneration) throw new Error('Hero unavailable');
  }
}

export function renderMore(els) {
  const batch = filtered.slice(rendered, rendered + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  batch.forEach(it => fragment.append(createCard(it, els.openLightbox)));
  els.grid.append(fragment);
  setRendered(rendered + batch.length);
  els.emptyEl.hidden = filtered.length !== 0;
  els.sentinel.textContent = rendered < filtered.length
    ? t('继续浏览 · 已显示 {n} 张',{n:rendered})
    : (rendered ? t('已显示全部壁纸') : '');
  return batch.length;
}

function createCard(it, openLightbox) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.date = it.date;
  const sel = document.createElement('input');
  sel.type = 'checkbox';
  sel.className = 'sel';
  sel.dataset.date = it.date;
  sel.checked = selected.has(it.date);
  sel.setAttribute('aria-label', t('选择 {title}',{title:it.title || it.date}));
  card.classList.toggle('selected', sel.checked);
  const selectionHit = document.createElement('label');
  selectionHit.className = 'selection-hit';
  selectionHit.append(sel);
  card.append(selectionHit);
  const media = document.createElement('button');
  media.type = 'button';
  media.className = 'media';
  media.setAttribute('aria-label', t('查看 {title}',{title:it.title || it.date}));
  if (it.thumbnail) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 480; img.height = 270;
    img.src = it.thumbnail;
    img.alt = '';
    media.append(img);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'ph';
    placeholder.textContent = t('查看原图');
    media.append(placeholder);
  }
  media.onclick = () => {
    if (document.body.classList.contains('selection-mode')) sel.click();
    else openLightbox(it);
  };
  card.append(media);
  const info = document.createElement('div');
  info.className = 'info';
  const title = document.createElement('h3');
  title.className = 'title';
  title.dataset.sourceText='';
  title.textContent = it.title || it.date;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const date = document.createElement('time');
  date.dateTime = `${it.date.slice(0,4)}-${it.date.slice(4,6)}-${it.date.slice(6,8)}`;
  date.textContent = formatDate(it.date);
  const tag = document.createElement('span');
  tag.dataset.category=it.category || '';
  tag.textContent = t(it.category || '');
  meta.append(date, tag);
  info.append(title, meta);
  card.append(info);
  return card;
}
export function updateFilterCount(el) {
  el.textContent = t('{n} 张壁纸',{n:filtered.length.toLocaleString()});
}
export function updateStats(el) {
  el.textContent = t('已收录 {n} 张 · 每日更新',{n:items.length.toLocaleString()});
  document.title = t('Bing 每日壁纸归档 · {n} 张',{n:items.length.toLocaleString()});
}

export function refreshHeroLabels(els) {
  const current=items.find(item=>item.date===heroDate);
  if(current) els.heroDownloadText.textContent=t(current.uhd===false?'下载 1080p':'下载 UHD');
}
