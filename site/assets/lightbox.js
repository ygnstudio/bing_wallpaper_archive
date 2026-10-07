import { enhanceChoices, refreshChoices } from './choices.js';
import { reveal, animateIn } from './motion.js';
import { t, setMessage } from './i18n.js';
import { downloadPhoto } from './download.js';
/**
 * 灯箱（Lightbox）组件
 * 大图查看、上一张/下一张导航、分辨率切换、链接复制、下载、URL 状态同步。
 */

import { buildResUrl, defaultResolution, supportedResolutions, ensureItemLoaded } from './api.js';
import { filtered } from './state.js';
import { setLightboxUrl, clearLightboxUrl } from './urlstate.js';

/** @type {WallpaperItem|null} */
let current = null;

/** 是否已为本次灯箱会话推入历史记录 */
let pushed = false;
let previousFocus = null;
let requestId = 0;
async function hideLightbox(els) {
  const id = ++requestId;
  current = null;
  if (!(await reveal(els.lightbox,false)) || id !== requestId) return;
  document.body.style.overflow = '';
  previousFocus?.focus({ preventScroll: true });
}
function setResolutionOptions(els, preferred) {
  els.lbRes.replaceChildren();
  for (const option of supportedResolutions(current)) {
    const el = document.createElement('option');
    el.value = option.v; el.textContent = option.label; els.lbRes.append(el);
  }
  els.lbRes.value = [...els.lbRes.options].some(o => o.value === preferred) ? preferred : defaultResolution(current);
  refreshChoices(els.lbRes);
}

/**
 * 初始化灯箱事件
 * @param {Object} els
 * @param {HTMLElement} els.lightbox
 * @param {HTMLElement} els.lbClose
 * @param {HTMLImageElement} els.lbImg
 * @param {HTMLElement} els.lbTitle
 * @param {HTMLElement} els.lbCopyright
 * @param {HTMLElement} els.lbNote
 * @param {HTMLSelectElement} els.lbRes
 * @param {HTMLAnchorElement} els.lbLink
 * @param {HTMLAnchorElement} els.lbDownload
 * @param {HTMLButtonElement} els.lbCopy
 * @param {HTMLButtonElement} els.lbCopyMd
 * @param {HTMLButtonElement} els.lbPrev
 * @param {HTMLButtonElement} els.lbNext
 */
export function initLightbox(els) {
  enhanceChoices(els.lbRes);
  els.lbDownload.addEventListener('click',()=>{ if(current) downloadPhoto(current,els.lbRes.value,els.lbDownload,els.lbStatus); });
  document.addEventListener('languagechange',()=>{ if(current) { const preferred=els.lbRes.value; setResolutionOptions(els,preferred); } });
  els.lbRes.addEventListener('change', () => applyResolution(els));
  els.lbClose.onclick = () => closeLightbox(els);
  els.lightbox.addEventListener('click', (e) => { if (e.target === els.lightbox) closeLightbox(els); });
  els.lbImg.addEventListener('click', () => { if (els.lbLink.href) window.open(els.lbLink.href, '_blank', 'noopener'); });
  els.lbImg.addEventListener('load', () => { els.lbImg.classList.add('loaded'); if(!els.lightbox.hidden) animateIn(els.lbImg,0); });
  document.addEventListener('keydown', (e) => {
    if (els.lightbox.hidden) return;
    if (e.key === 'Tab') {
      const focusable = [...els.lightbox.querySelectorAll('button:not([disabled]),a[href],select,summary')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(els); }
    if (e.target.closest('select,input,[role=radiogroup]')) return;
    else if (e.key === 'ArrowLeft') nav(els, -1);
    else if (e.key === 'ArrowRight') nav(els, 1);
  });
  els.lbPrev.addEventListener('click', () => nav(els, -1));
  els.lbNext.addEventListener('click', () => nav(els, 1));

  // 浏览器后退：关闭灯箱（popstate 已由 clearLightboxUrl 触发）
  window.addEventListener('popstate', () => {
    pushed = false;
    if (!els.lightbox.hidden) hideLightbox(els);
  });

  els.lbCopy.onclick = async () => {
    if (!current) return;
    const url = buildResUrl(current.url, els.lbRes.value) || current.url || '';
    await copyToClipboard(url, els.lbCopy, '已复制', '复制链接');
  };

  els.lbCopyMd.onclick = async () => {
    if (!current) return;
    const url = buildResUrl(current.url, els.lbRes.value) || current.url || '';
    const alt = current.title || current.date || '';
    await copyToClipboard(`![${alt}](${url})`, els.lbCopyMd, '已复制', '复制 Markdown');
  };
}

/**
 * 打开灯箱
 * @param {WallpaperItem} it
 * @param {Object} els
 * @param {{fromUrl?: boolean}} [opts] - fromUrl: URL 已带 d 参数（直链进入），不再额外 push
 */
export async function openLightbox(it, els, opts = {}) {
  const id = ++requestId;
  const entering = els.lightbox.hidden;
  if (entering) previousFocus = document.activeElement;
  current = null;
  els.lightbox.dataset.loadState = 'loading';
  els.lbTitle.textContent = it.title || it.date;
  els.lbCopyright.replaceChildren();
  if (document.activeElement === els.lbRetry) els.lbClose.focus({preventScroll:true});
  els.lbNote.hidden = els.lbRetry.hidden = true;
  els.lbPrev.hidden = els.lbNext.hidden = true;
  els.lbLink.removeAttribute('href');
  setMessage(els.lbStatus,'正在读取归档…');
  reveal(els.lightbox,true);
  document.body.style.overflow = 'hidden';
  if (entering) {
    els.lbClose.focus({preventScroll:true});
    if (!opts.fromUrl) setLightboxUrl(true, it.date);
    pushed = true;
  }
  let loaded;
  try { loaded=await ensureItemLoaded(it); }
  catch {
    if (id !== requestId || els.lightbox.hidden) return;
    els.lightbox.dataset.loadState = 'error';
    setMessage(els.lbStatus,'图片详情加载失败，请重试');
    els.lbRetry.hidden = false;
    els.lbRetry.onclick = () => openLightbox(it, els, opts);
    return;
  }
  if (id !== requestId || els.lightbox.hidden) return;
  current = loaded;
  els.lightbox.dataset.loadState = 'ready';
  setMessage(els.lbStatus,'');
  setResolutionOptions(els, defaultResolution(current));
  applyResolution(els);
  updateNavVisibility(els);
  // Retrying within the same session must not add another history entry.
  if (!entering) setLightboxUrl(false, current.date);
}

/**
 * 关闭灯箱并同步历史
 * @param {Object} els
 */
function closeLightbox(els) {
  hideLightbox(els);
  if (pushed) {
    pushed = false;
    clearLightboxUrl();
  }
}

/**
 * 按 filtered 列表导航上一张/下一张（循环）
 * @param {Object} els
 * @param {1|-1} dir
 */
async function nav(els, dir) {
  if (!current || filtered.length === 0) return;
  const idx = filtered.findIndex(x => x.date === current.date);
  const base = idx >= 0 ? idx : 0;
  const next = filtered[(base + dir + filtered.length) % filtered.length];
  if (!next || next.date === current.date) return;
  const id = ++requestId;
  let loaded;
  try { loaded=await ensureItemLoaded(next); } catch {
    if (id === requestId && !els.lightbox.hidden) setMessage(els.lbStatus,'加载失败，请刷新重试');
    return;
  }
  if (id !== requestId || els.lightbox.hidden) return;
  current = loaded;
  setResolutionOptions(els, els.lbRes.value);
  els.lbNote.hidden = true;
  applyResolution(els);
  animateIn(els.lbTitle.parentElement,6);
  setLightboxUrl(false, current.date);
}

/**
 * 仅剩一张时隐藏导航按钮
 * @param {Object} els
 */
function updateNavVisibility(els) {
  const show = filtered.length > 1;
  els.lbPrev.hidden = !show;
  els.lbNext.hidden = !show;
}

/**
 * 应用当前选择的分辨率
 * @param {Object} els
 */
function applyResolution(els) {
  const it = current;
  if (!it) return;
  const res = els.lbRes.value;
  const full = buildResUrl(it.url, res);
  let fellBack = false;
  els.lbImg.onerror = () => {
    if (!fellBack && it.thumbnail) {
      fellBack = true;
      els.lbImg.src = it.thumbnail;
      els.lbNote.hidden = false;
      els.lbNote.textContent = t('所选分辨率源不可用，已回退缩略图。');
    }
  };
  els.lbImg.classList.remove('loaded');
  els.lbImg.src = full || it.thumbnail || '';
  els.lbImg.alt = it.title || it.date;
  els.lbTitle.textContent = it.title || it.date;
  els.lbCopyright.replaceChildren();
  if (it.copyrightlink) {
    const link = document.createElement('a');
    link.href = it.copyrightlink; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = it.copyright || ''; els.lbCopyright.append(link);
  } else els.lbCopyright.textContent = it.copyright || '';
  els.lbLink.href = full || '#';
  setMessage(els.lbStatus,'');
}

/**
 * 复制文本到剪贴板并临时反馈
 * @param {string} text
 * @param {HTMLButtonElement} btn
 * @param {string} okText
 * @param {string} resetText
 */
async function copyToClipboard(text, btn, okText, resetText) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = t(okText) + ' ✓';
    setTimeout(() => (btn.textContent = t(resetText)), 1500);
  } catch {
    btn.textContent = t('复制失败，请打开原图后复制地址');
  }
}
