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
  els.lbRes.addEventListener('change', () => applyResolution(els));
  els.lbClose.onclick = () => closeLightbox(els);
  els.lightbox.addEventListener('click', (e) => { if (e.target === els.lightbox) closeLightbox(els); });
  els.lbImg.addEventListener('click', () => { if (els.lbLink.href) window.open(els.lbLink.href, '_blank', 'noopener'); });
  els.lbImg.addEventListener('load', () => els.lbImg.classList.add('loaded'));
  document.addEventListener('keydown', (e) => {
    if (els.lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox(els);
    else if (e.key === 'ArrowLeft') nav(els, -1);
    else if (e.key === 'ArrowRight') nav(els, 1);
  });
  els.lbPrev.addEventListener('click', () => nav(els, -1));
  els.lbNext.addEventListener('click', () => nav(els, 1));

  // 浏览器后退：关闭灯箱（popstate 已由 clearLightboxUrl 触发）
  window.addEventListener('popstate', () => {
    pushed = false;
    if (!els.lightbox.hidden) els.lightbox.hidden = true;
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
  current = await ensureItemLoaded(it);
  els.lbNote.hidden = true;
  const opts2 = supportedResolutions(current);
  els.lbRes.innerHTML = '';
  for (const o of opts2) {
    const el = document.createElement('option');
    el.value = o.v;
    el.textContent = o.label;
    els.lbRes.appendChild(el);
  }
  els.lbRes.value = defaultResolution(current);
  applyResolution(els);
  els.lightbox.hidden = false;
  updateNavVisibility(els);
  if (opts.fromUrl) {
    pushed = true; // 历史里已有 ?d，后退即关闭
  } else {
    setLightboxUrl(true, current.date);
    pushed = true;
  }
}

/**
 * 关闭灯箱并同步历史
 * @param {Object} els
 */
function closeLightbox(els) {
  els.lightbox.hidden = true;
  current = null;
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
  current = await ensureItemLoaded(next);
  applyResolution(els);
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
      els.lbNote.textContent = '所选分辨率源不可用，已回退缩略图。';
    }
  };
  els.lbImg.classList.remove('loaded');
  els.lbImg.src = full || it.thumbnail || '';
  els.lbTitle.textContent = it.title || it.date;
  els.lbCopyright.innerHTML = it.copyrightlink
    ? `<a href="${it.copyrightlink}" target="_blank" rel="noopener">${it.copyright || ''}</a>`
    : (it.copyright || '');
  els.lbLink.href = full || '#';
  els.lbDownload.href = full || it.thumbnail || '#';
  els.lbDownload.download = (it.date || 'bing') + (res !== '1920x1080' ? '_' + res : '') + '.jpg';
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
    btn.textContent = okText + ' ✓';
    setTimeout(() => (btn.textContent = resetText), 1500);
  } catch {
    btn.textContent = '复制失败';
  }
}
