/**
 * 灯箱（Lightbox）组件
 * 大图查看、分辨率切换、链接复制、下载。
 */

import { buildResUrl, defaultResolution, supportedResolutions, ensureItemLoaded } from './api.js';

/** @type {WallpaperItem|null} */
let current = null;

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
 */
export function initLightbox(els) {
  els.lbRes.addEventListener('change', () => applyResolution(els));
  els.lbClose.onclick = () => (els.lightbox.hidden = true);
  els.lightbox.addEventListener('click', (e) => { if (e.target === els.lightbox) els.lightbox.hidden = true; });
  els.lbImg.addEventListener('click', () => { if (els.lbLink.href) window.open(els.lbLink.href, '_blank', 'noopener'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') els.lightbox.hidden = true; });

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
 */
export async function openLightbox(it, els) {
  current = await ensureItemLoaded(it);
  els.lbNote.hidden = true;
  const opts = supportedResolutions(current);
  els.lbRes.innerHTML = '';
  for (const o of opts) {
    const el = document.createElement('option');
    el.value = o.v;
    el.textContent = o.label;
    els.lbRes.appendChild(el);
  }
  els.lbRes.value = defaultResolution(current);
  applyResolution(els);
  els.lightbox.hidden = false;
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
