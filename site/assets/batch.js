import { enhanceChoices, refreshChoices } from './choices.js';
import { reveal } from './motion.js';
import { t, setMessage } from './i18n.js';
import { saveBlob } from './download.js';
let busy = false;
let retryDates = [];
let syncPanel = () => {};
/**
 * 批量下载组件
 * 选择管理、分辨率锁定、前端 ZIP 打包。
 */

import { BATCH_LIMIT, BATCH_CONCURRENCY } from './config.js';
import { fetchWithFallback, ensureItemLoaded } from './api.js';
import { selected, byDate, filtered } from './state.js';

/**
 * 计算 CRC32
 * @param {Uint8Array} buf
 * @returns {number}
 */
function crc32(buf) {
  if (!crc32.table) {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * 使用 STORE 方式构建 ZIP Blob
 * @param {Array<ZipEntry>} entries
 * @returns {Blob}
 */
function buildZipStore(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = e.bytes;
    const c = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + data.length;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(end, p);
  return new Blob([out], { type: 'application/zip' });
}

/**
 * 初始化批量面板事件
 * @param {Object} els
 * @param {HTMLElement} els.grid
 * @param {HTMLElement} els.batchbar
 * @param {HTMLElement} els.batchPanel
 * @param {HTMLElement} els.batchToggle
 * @param {HTMLButtonElement} els.batchZip
 * @param {HTMLButtonElement} els.batchClear
 * @param {HTMLButtonElement} els.batchSelectAll
 * @param {HTMLSelectElement} els.batchRes
 * @param {HTMLElement} els.batchCount
 * @param {HTMLElement} els.batchBadge
 * @param {HTMLElement} els.batchResNote
 * @param {HTMLElement} els.batchProgress
 */
export function initBatch(els) {
  enhanceChoices(els.batchRes);
  // Reserve the actual bar height after wrapping, text zoom, or orientation changes.
  const syncBatchSpace = () => {
    const height = els.batchPanel.hidden ? 0 : Math.ceil(els.batchPanel.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--batch-height', `${height}px`);
  };
  if ('ResizeObserver' in window) new ResizeObserver(syncBatchSpace).observe(els.batchPanel);
  window.addEventListener('resize', syncBatchSpace, { passive: true });
  els.grid.addEventListener('change', (e) => {
    const sel = e.target.closest('.sel');
    if (!sel) return;
    if (busy) { sel.checked=selected.has(sel.dataset.date); return; }
    retryDates=[];
    const date = sel.dataset.date;
    if (sel.checked && selected.size >= BATCH_LIMIT) {
      sel.checked = false;
      setMessage(els.batchProgress,'一次最多选择 {n} 张',{n:BATCH_LIMIT});
      return;
    }
    if (sel.checked) selected.add(date); else selected.delete(date);
    setMessage(els.batchProgress,'');
    sel.closest('.card').classList.toggle('selected', sel.checked);
    updateBatchBar(els);
  });

  els.batchZip.addEventListener('click', () => doBatchDownload(els));
  els.batchClear.addEventListener('click', () => clearSelection(els));
  els.batchSelectAll.addEventListener('click', () => selectAllFiltered(els));
  syncPanel = () => {
    const open = document.body.classList.contains('selection-mode') || selected.size > 0 || busy;
    reveal(els.batchPanel,open);
    document.body.classList.toggle('batch-visible',open);
    els.batchDone.hidden = !document.body.classList.contains('selection-mode');
    els.batchPanel.querySelector('.batch-help').hidden = els.batchDone.hidden;
    syncBatchSpace();
  };
  function setSelectionMode(open) {
    document.body.classList.toggle('selection-mode', open);
    els.batchToggle.setAttribute('aria-pressed', String(open));
    els.batchToggleText.textContent = t(open ? '正在选择' : '批量选择');
    syncPanel();
  }
  els.batchToggle.addEventListener('click', () => setSelectionMode(!document.body.classList.contains('selection-mode')));
  els.batchDone.addEventListener('click', () => { setSelectionMode(false); els.batchToggle.focus({ preventScroll: true }); });
  document.addEventListener('keydown', e => {
    if (!e.defaultPrevented && e.key === 'Escape' && !els.batchPanel.hidden && els.lightbox.hidden) {
      setSelectionMode(false); els.batchToggle.focus({ preventScroll: true });
    }
  });
  updateBatchBar(els);
}

/**
 * 更新批量面板状态
 * @param {Object} els
 */
export function updateBatchBar(els) {
  const n = selected.size;
  els.batchCount.textContent = String(n);
  els.batchBadge.textContent = String(n);
  els.batchBadge.hidden = n === 0;
  els.batchZip.disabled = busy || n < 1;
  els.batchZip.textContent = t(retryDates.length ? '重试下载' : n === 0 ? '未选择' : n === 1 ? '下载这张' : '打包下载 ZIP（{n}）',{n});
  els.batchSelectAll.disabled = busy || filtered.length === 0;
  els.batchSelectAll.textContent = t('选择前 {n} 张',{n:Math.min(filtered.length,BATCH_LIMIT)});
  els.batchClear.disabled = busy || n === 0;
  els.batchRes.disabled = busy;
  syncPanel();
  refreshBatchRes(els);
  refreshChoices(els.batchRes);
}

/**
 * 根据已选图片的 4K 可用性调整分辨率选项
 * @param {Object} els
 */
function refreshBatchRes(els) {
  const sel = [...selected].map(d => byDate.get(d)).filter(Boolean);
  if (sel.length === 0) {
    enableUhdOption(els.batchRes, true);
    els.batchResNote.hidden = true;
    return;
  }
  const allUhd = sel.every(it => it.uhd !== false);
  const allNonUhd = sel.every(it => it.uhd === false);
  if (allUhd) {
    enableUhdOption(els.batchRes, true);
    // A valid user-selected resolution must survive selection and filter changes.
    els.batchResNote.hidden = true;
  } else {
    enableUhdOption(els.batchRes, false);
    els.batchRes.value = '1920x1080';
    els.batchResNote.hidden = false;
    els.batchResNote.textContent = allNonUhd
      ? t('所选图片仅支持 1080p，已自动按 1080p 下载')
      : t('部分所选图片无 4K，已按 1080p 下载（不混用分辨率）');
  }
}

/**
 * 启用/禁用 UHD 选项
 * @param {HTMLSelectElement} select
 * @param {boolean} enabled
 */
function enableUhdOption(select, enabled) {
  for (const opt of select.options) {
    if (opt.value === 'UHD') opt.disabled = !enabled;
  }
}

/**
 * 清空选择
 * @param {Object} els
 */
function clearSelection(els) {
  if (busy) return;
  retryDates=[];
  selected.clear();
  setMessage(els.batchProgress,'');
  els.grid.querySelectorAll('.sel').forEach(cb => { cb.checked = false; });
  els.grid.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  updateBatchBar(els);
}

/**
 * 全选当前筛选结果
 * @param {Object} els
 */
function selectAllFiltered(els) {
  if (busy) return;
  retryDates=[];
  for (const it of filtered) {
    if (selected.size >= BATCH_LIMIT) break;
    selected.add(it.date);
  }
  els.grid.querySelectorAll('.sel').forEach(cb => { cb.checked = selected.has(cb.dataset.date); });
  els.grid.querySelectorAll('.card').forEach(c => c.classList.toggle('selected', selected.has(c.dataset.date)));
  updateBatchBar(els);
}

/** Download a stable selection, report failures, and always release controls. */
async function doBatchDownload(els) {
  if (busy || !selected.size) return;
  const dates=retryDates.length ? [...retryDates] : [...selected];
  const res=els.batchRes.value, entries=[], failed=[];
  let done=0;
  busy=true;
  updateBatchBar(els);
  setMessage(els.batchProgress,'正在准备下载…');
  const queue=[...dates];
  try {
    async function worker() {
      while(queue.length) {
        const date=queue.shift();
        try {
          const item=await ensureItemLoaded(byDate.get(date));
          const got=await fetchWithFallback(item,res);
          if (!got) throw new Error('Unavailable');
          entries.push(got);
        } catch { failed.push(date); }
        done++;
        setMessage(els.batchProgress,'打包中 {done}/{n}',{done,n:dates.length});
      }
    }
    await Promise.all(Array.from({length:Math.min(BATCH_CONCURRENCY,dates.length)},worker));
    retryDates=failed;
    if (!entries.length) { setMessage(els.batchProgress,'无可用图片，请重试或打开原图'); return; }
    if (dates.length===1) {
      const item=entries[0];
      saveBlob(new Blob([item.bytes],{type:item.thumbnail?'image/webp':'image/jpeg'}),item.name);
    } else {
      saveBlob(buildZipStore(entries),`bing_wallpapers_${res}_${new Date().toISOString().slice(0,10)}_${entries.length}.zip`);
    }
    const low=entries.filter(entry=>entry.resolution!==res).length;
    setMessage(els.batchProgress,failed.length || low ? '已发起 {n} 张下载；失败 {failed} 张，降级 {low} 张' : '已发起 {n} 张下载',{n:entries.length,failed:failed.length,low});
  } catch {
    retryDates=dates;
    setMessage(els.batchProgress,'下载失败，请重试或打开原图');
  } finally { busy=false; updateBatchBar(els); }
}
