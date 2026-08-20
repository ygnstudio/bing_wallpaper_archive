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
    const data = e.data;
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
  els.grid.addEventListener('change', (e) => {
    const sel = e.target.closest('.sel');
    if (!sel) return;
    const date = sel.dataset.date;
    if (sel.checked) selected.add(date); else selected.delete(date);
    sel.closest('.card').classList.toggle('selected', sel.checked);
    updateBatchBar(els);
  });

  els.batchZip.addEventListener('click', () => doBatchDownload(els));
  els.batchClear.addEventListener('click', () => clearSelection(els));
  els.batchSelectAll.addEventListener('click', () => selectAllFiltered(els));
  els.batchToggle.addEventListener('click', () => { els.batchPanel.hidden = !els.batchPanel.hidden; });
  document.addEventListener('click', (e) => {
    if (els.batchPanel.hidden) return;
    if (!els.batchbar.contains(e.target)) els.batchPanel.hidden = true;
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
  els.batchZip.disabled = n < 1;
  els.batchZip.textContent = n === 0 ? '未选择'
    : n === 1 ? '下载这张'
    : `打包下载 ZIP（${n}）`;
  els.batchSelectAll.disabled = filtered.length === 0;
  els.batchClear.disabled = n === 0;
  refreshBatchRes(els);
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
    if (els.batchRes.value !== 'UHD') els.batchRes.value = 'UHD';
    els.batchResNote.hidden = true;
  } else {
    enableUhdOption(els.batchRes, false);
    els.batchRes.value = '1920x1080';
    els.batchResNote.hidden = false;
    els.batchResNote.textContent = allNonUhd
      ? '所选图片仅支持 1080p，已自动按 1080p 下载'
      : '部分所选图片无 4K，已按 1080p 下载（不混用分辨率）';
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
  selected.clear();
  els.grid.querySelectorAll('.sel').forEach(cb => { cb.checked = false; });
  els.grid.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  updateBatchBar(els);
}

/**
 * 全选当前筛选结果
 * @param {Object} els
 */
function selectAllFiltered(els) {
  for (const it of filtered) selected.add(it.date);
  els.grid.querySelectorAll('.sel').forEach(cb => { cb.checked = selected.has(cb.dataset.date); });
  els.grid.querySelectorAll('.card').forEach(c => c.classList.toggle('selected', selected.has(c.dataset.date)));
  updateBatchBar(els);
}

/**
 * 下载单张图片
 * @param {string} date
 * @param {string} res
 */
async function downloadSingle(date, res) {
  let it = byDate.get(date);
  if (!it) return;
  it = await ensureItemLoaded(it);
  const got = await fetchWithFallback(it, res);
  if (!got) return;
  const blob = new Blob([got.bytes], { type: 'image/jpeg' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = got.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * 执行批量下载
 * @param {Object} els
 */
async function doBatchDownload(els) {
  const n = selected.size;
  if (n === 0) return;
  if (n === 1) {
    await downloadSingle([...selected][0], els.batchRes.value);
    return;
  }
  if (n > BATCH_LIMIT) {
    els.batchProgress.textContent = `一次最多打包 ${BATCH_LIMIT} 张，请减少选择`;
    return;
  }
  if (n >= 20 && !confirm(`将打包 ${n} 张图片，文件可能较大、耗时较长，继续？`)) return;

  const res = els.batchRes.value;
  els.batchZip.disabled = true;
  els.batchClear.disabled = true;
  els.batchSelectAll.disabled = true;

  const queue = [...selected];
  const entries = [];
  let done = 0;

  async function worker() {
    while (queue.length) {
      const date = queue.shift();
      let it = byDate.get(date);
      if (!it) { done++; continue; }
      it = await ensureItemLoaded(it);
      const got = await fetchWithFallback(it, res);
      if (got) entries.push(got);
      done++;
      els.batchProgress.textContent = `打包中 ${done}/${n}`;
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, n) }, worker));

  if (!entries.length) {
    els.batchProgress.textContent = '无可用图片，打包取消';
    resetButtons(els);
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = buildZipStore(entries);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bing_wallpapers_${res}_${stamp}_${entries.length}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  els.batchProgress.textContent = `已下载 ${entries.length} 张 ✓`;
  resetButtons(els);
}

/**
 * 重置批量面板按钮状态
 * @param {Object} els
 */
function resetButtons(els) {
  els.batchZip.disabled = false;
  els.batchClear.disabled = false;
  els.batchSelectAll.disabled = filtered.length === 0;
}
