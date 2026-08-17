const grid = document.getElementById('grid');
const subtitle = document.getElementById('subtitle');
const searchEl = document.getElementById('search');
const yearEl = document.getElementById('year');
const monthEl = document.getElementById('month');
const catEl = document.getElementById('category');
const colorEl = document.getElementById('color');
const sentinel = document.getElementById('sentinel');
const emptyEl = document.getElementById('empty');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbTitle = document.getElementById('lb-title');
const lbCopyright = document.getElementById('lb-copyright');
const lbNote = document.getElementById('lb-note');
const lbLink = document.getElementById('lb-link');
const lbDownload = document.getElementById('lb-download');
const lbCopy = document.getElementById('lb-copy');
const lbRes = document.getElementById('lb-res');
const batchbar = document.getElementById('batchbar');
const batchToggle = document.getElementById('batch-toggle');
const batchPanel = document.getElementById('batch-panel');
const batchBadge = document.getElementById('batch-badge');
const batchCount = document.getElementById('batch-count');
const batchRes = document.getElementById('batch-res');
const batchZip = document.getElementById('batch-zip');
const batchClear = document.getElementById('batch-clear');
const batchSelectAll = document.getElementById('batch-selectall');
const batchProgress = document.getElementById('batch-progress');

const PAGE = 60;            // 每批渲染的卡片数
const ROOT_MARGIN = '600px';
let items = [];
let filtered = [];
let rendered = 0;
let current = null;         // 当前灯箱对应的数据项
let byDate = new Map();     // date -> item，批量打包时按 date 反查
const selected = new Set(); // 已勾选的 date 集合（与虚拟化渲染解耦）

// 分类/颜色筛选的可选项顺序（仅展示数据中存在的项）
const CATEGORY_ORDER = ['动物', '风景', '建筑', '植物', '美食', '交通', '太空', '人物', '抽象艺术', '其他'];
const COLOR_ORDER = ['蓝', '绿', '红', '黄', '橙', '紫', '粉', '棕', '灰白', '多彩'];
const COLOR_HEX = {
  '蓝': '#4a9eff', '绿': '#46c46a', '红': '#ef5350', '黄': '#ffd54f',
  '橙': '#ff9f43', '紫': '#ab6bff', '粉': '#ff8fc7', '棕': '#a9794f',
  '灰白': '#bcc3cc', '多彩': 'linear-gradient(135deg,#ef5350,#ffd54f,#46c46a,#4a9eff,#ab6bff)'
};

async function load() {
  const res = await fetch('./data/index.json');
  items = await res.json();
  byDate = new Map(items.map(i => [i.date, i]));
  buildYearOptions();
  buildCategoryOptions();
  buildColorOptions();
  applyFilter();
  const withImg = items.filter(i => i.thumbnail).length;
  const oldest = items.length ? items[items.length - 1].date : '-';
  const newest = items.length ? items[0].date : '-';
  subtitle.textContent =
    `共 ${items.length} 张 · 含缩略图 ${withImg} 张 · ${oldest}–${newest} · 点开看全图（来源 Bing）`;
}

function buildYearOptions() {
  const years = [...new Set(items.map(i => i.date.slice(0, 4)))].sort().reverse();
  for (const y of years) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y + ' 年';
    yearEl.appendChild(o);
  }
}

function rebuildMonthOptions() {
  const y = yearEl.value;
  monthEl.innerHTML = '<option value="">全部月份</option>';
  if (!y) return;
  const months = [...new Set(
    items.filter(i => i.date.slice(0, 4) === y).map(i => i.date.slice(4, 6))
  )].sort();
  for (const m of months) {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m + ' 月';
    monthEl.appendChild(o);
  }
}

function buildCategoryOptions() {
  const present = new Set(items.map(i => i.category).filter(Boolean));
  catEl.innerHTML = '<option value="">全部分类</option>';
  for (const c of CATEGORY_ORDER) {
    if (!present.has(c)) continue;
    const o = document.createElement('option');
    o.value = c;
    const n = items.filter(i => i.category === c).length;
    o.textContent = c + `（${n}）`;
    catEl.appendChild(o);
  }
}

function buildColorOptions() {
  const present = new Set(items.map(i => i.color).filter(Boolean));
  colorEl.innerHTML = '<option value="">全部颜色</option>';
  for (const c of COLOR_ORDER) {
    if (!present.has(c)) continue;
    const o = document.createElement('option');
    o.value = c;
    const n = items.filter(i => i.color === c).length;
    o.textContent = c + `（${n}）`;
    colorEl.appendChild(o);
  }
}

function getFiltered() {
  const q = searchEl.value.trim().toLowerCase();
  const y = yearEl.value;
  const m = monthEl.value;
  const cat = catEl.value;
  const col = colorEl.value;
  return items.filter(i => {
    if (y && i.date.slice(0, 4) !== y) return false;
    if (m && i.date.slice(4, 6) !== m) return false;
    if (cat && i.category !== cat) return false;
    if (col && i.color !== col) return false;
    if (q) {
      const hay = ((i.title || '') + (i.copyright || '') + (i.date || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function applyFilter() {
  if (document.activeElement !== monthEl) rebuildMonthOptions();
  filtered = getFiltered();
  rendered = 0;
  grid.innerHTML = '';
  renderMore();
}

function renderMore() {
  const batch = filtered.slice(rendered, rendered + PAGE);
  const frag = document.createDocumentFragment();
  for (const it of batch) {
    const a = document.createElement('a');
    a.className = 'card';
    a.dataset.date = it.date;
    a.href = it.url || '#';
    a.title = (it.title || '') + (it.copyright ? ' — ' + it.copyright : '');

    // 勾选框：用于批量打包下载（点击不触发灯箱）
    const sel = document.createElement('input');
    sel.type = 'checkbox';
    sel.className = 'sel';
    sel.dataset.date = it.date;
    sel.checked = selected.has(it.date);
    sel.title = '选择打包下载';
    if (sel.checked) a.classList.add('selected');
    a.appendChild(sel);

    if (it.thumbnail) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = it.thumbnail;
      img.alt = it.title || it.date;
      a.appendChild(img);
    } else {
      a.classList.add('missing');
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = it.date;
      a.appendChild(ph);
    }

    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = it.title || it.date;
    a.appendChild(cap);

    const tags = document.createElement('div');
    tags.className = 'tags';
    if (it.category) {
      const ct = document.createElement('span');
      ct.className = 'tag tag-cat';
      ct.textContent = it.category;
      tags.appendChild(ct);
    }
    if (it.color) {
      const cd = document.createElement('span');
      cd.className = 'tag tag-color';
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = COLOR_HEX[it.color] || 'transparent';
      cd.appendChild(dot);
      cd.appendChild(document.createTextNode(it.color));
      tags.appendChild(cd);
    }
    a.appendChild(tags);
    frag.appendChild(a);
  }
  grid.appendChild(frag);
  rendered += batch.length;
  emptyEl.hidden = filtered.length !== 0;
  sentinel.textContent = rendered < filtered.length
    ? `加载更多…（${rendered}/${filtered.length}）`
    : (rendered ? '已显示全部' : '');
}

// 滚动到接近底部时自动加载下一批，避免一次性把数千张卡片塞进 DOM
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && rendered < filtered.length) renderMore();
  }
}, { rootMargin: ROOT_MARGIN });
io.observe(sentinel);

searchEl.addEventListener('input', applyFilter);
yearEl.addEventListener('change', applyFilter);
monthEl.addEventListener('change', applyFilter);
catEl.addEventListener('change', applyFilter);
colorEl.addEventListener('change', applyFilter);

grid.addEventListener('click', (e) => {
  if (e.target.closest('.sel')) return;   // 勾选框：交给原生 toggle，不开灯箱
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  const it = items.find(i => i.date === card.dataset.date);
  if (it) openLightbox(it);
});

// 勾选状态变化：维护 selected 集合并同步卡片高亮
grid.addEventListener('change', (e) => {
  const sel = e.target.closest('.sel');
  if (!sel) return;
  const date = sel.dataset.date;
  if (sel.checked) selected.add(date); else selected.delete(date);
  sel.closest('.card').classList.toggle('selected', sel.checked);
  updateBatchBar();
});

// ===== 批量打包下载（纯前端 ZIP，STORE 不压缩） =====
function updateBatchBar() {
  const n = selected.size;
  batchCount.textContent = String(n);
  batchBadge.textContent = String(n);
  batchBadge.hidden = n === 0;
  batchZip.disabled = n < 2;
  batchZip.textContent = n < 2 ? '打包下载（至少 2 张）' : `打包下载 ZIP（${n}）`;
  batchSelectAll.disabled = filtered.length === 0;
  batchClear.disabled = n === 0;
}

function clearSelection() {
  selected.clear();
  grid.querySelectorAll('.sel').forEach(cb => { cb.checked = false; });
  grid.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  updateBatchBar();
}

function selectAllFiltered() {
  for (const it of filtered) selected.add(it.date);
  grid.querySelectorAll('.sel').forEach(cb => { cb.checked = selected.has(cb.dataset.date); });
  grid.querySelectorAll('.card').forEach(c => c.classList.toggle('selected', selected.has(c.dataset.date)));
  updateBatchBar();
}

async function fetchBytes(url) {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

// CRC32（用于 ZIP 本地/中央目录校验）
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

// 构造 STORE（无压缩）ZIP：entries = [{name, data:Uint8Array}]
function buildZipStore(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = e.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);   // 本地文件头签名
    lv.setUint16(4, 20, true);           // version needed
    lv.setUint16(6, 0, true);            // flags
    lv.setUint16(8, 0, true);            // method = 0 (store)
    lv.setUint16(10, 0, true);           // mod time
    lv.setUint16(12, 0, true);           // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // comp size
    lv.setUint32(22, data.length, true); // uncomp size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);           // extra len
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);   // 中央目录头签名
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);           // method
    cv.setUint16(12, 0, true);           // time
    cv.setUint16(14, 0, true);           // date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);           // extra
    cv.setUint16(32, 0, true);           // comment
    cv.setUint16(34, 0, true);           // disk
    cv.setUint16(36, 0, true);           // internal attr
    cv.setUint32(38, 0, true);           // external attr
    cv.setUint32(42, offset, true);      // 本地头偏移
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + data.length;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);     // 中央目录结束签名
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

async function doBatchDownload() {
  const n = selected.size;
  if (n < 2) return;
  if (n >= 50 && !confirm(`将打包 ${n} 张图片，文件可能较大、耗时较长，继续？`)) return;
  const res = batchRes.value;            // '1920x1080' | 'UHD'
  batchZip.disabled = true;
  batchClear.disabled = true;
  batchSelectAll.disabled = true;

  const dates = [...selected];
  const queue = dates.slice();
  const entries = [];
  let done = 0;
  const CONC = 4;

  async function worker() {
    while (queue.length) {
      const date = queue.shift();
      const it = byDate.get(date);
      if (!it) { done++; continue; }
      const suffix = res === 'UHD' ? '_UHD' : '';
      let bytes = null;
      let name = date + suffix + '.jpg';
      try {
        const url = buildResUrl(it.url, res) || it.url;
        bytes = await fetchBytes(url);
      } catch (_) { /* 原图失败，下面回退缩略图 */ }
      if (!bytes && it.thumbnail) {
        try { bytes = await fetchBytes('./' + it.thumbnail); name = date + '_thumb.jpg'; } catch (_) {}
      }
      if (bytes) entries.push({ name, data: bytes });
      done++;
      batchProgress.textContent = `打包中 ${done}/${n}`;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONC, n) }, worker));

  if (!entries.length) {
    batchProgress.textContent = '无可用图片，打包取消';
    batchZip.disabled = false; batchClear.disabled = false; batchSelectAll.disabled = false;
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = buildZipStore(entries);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bing_wallpapers_${res}_${stamp}_${entries.length}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  batchProgress.textContent = `已下载 ${entries.length} 张 ✓`;
  batchZip.disabled = false; batchClear.disabled = false; batchSelectAll.disabled = false;
}

batchZip.addEventListener('click', doBatchDownload);
batchClear.addEventListener('click', clearSelection);
batchSelectAll.addEventListener('click', selectAllFiltered);
// 悬浮按钮：展开/收起选项面板；点击面板外自动收起
batchToggle.addEventListener('click', () => { batchPanel.hidden = !batchPanel.hidden; });
document.addEventListener('click', (e) => {
  if (batchPanel.hidden) return;
  if (!batchbar.contains(e.target)) batchPanel.hidden = true;
});
updateBatchBar();

// 根据图片来源判断可选分辨率：
//   近期 bing.com 的 OHR 图支持 UHD / 1080p；
//   历史 cdn.bimg.cc 镜像图只有固定 1920x1080，因此只给 1080p 选项。
function supportedResolutions(item) {
  const u = item.url || '';
  if (/bing\.com\/th\?id=OHR/i.test(u)) {
    return [
      { v: 'UHD', label: 'UHD (4K)' },
      { v: '1920x1080', label: '1080p' },
    ];
  }
  return [{ v: '1920x1080', label: '1080p（已是最清）' }];
}

// 按所选分辨率构造 Bing 原图 URL（与 scripts/download_full.py 的 build_url 对应）
function buildResUrl(url, res) {
  if (!url) return '';
  if (!res || res === '1920x1080') return url;
  const m = url.match(/th\?id=(OHR\.[^&]+)/i);
  if (m) {
    const oid = m[1].replace(/\.jpg$/i, '').replace(/_(UHD|\d+X\d+)$/i, '');
    return 'https://www.bing.com/th?id=' + oid + '_' + res.toUpperCase() + '.jpg';
  }
  if (url.includes('cdn.bimg.cc')) {
    return url.replace(/_(UHD|\d+X\d+)?\.jpg$/i, '_' + res.toUpperCase() + '.jpg');
  }
  return url;
}

function applyResolution() {
  const it = current;
  if (!it) return;
  const res = lbRes.value;
  const full = buildResUrl(it.url, res);
  let fellBack = false;
  lbImg.onerror = () => {
    // 所选分辨率源不可用时回退缩略图（本地必有），并提示
    if (!fellBack && it.thumbnail) {
      fellBack = true;
      lbImg.src = it.thumbnail;
      lbNote.hidden = false;
      lbNote.textContent = '所选分辨率源不可用，已回退缩略图。';
    }
  };
  lbImg.src = full || it.thumbnail || '';
  lbTitle.textContent = it.title || it.date;
  lbCopyright.innerHTML = it.copyrightlink
    ? `<a href="${it.copyrightlink}" target="_blank" rel="noopener">${it.copyright || ''}</a>`
    : (it.copyright || '');
  lbLink.href = full || '#';
  lbDownload.href = full || it.thumbnail || '#';
  lbDownload.download = (it.date || 'bing') + (res !== '1920x1080' ? '_' + res : '') + '.jpg';
}

function openLightbox(it) {
  current = it;
  lbNote.hidden = true;
  const opts = supportedResolutions(it);
  lbRes.innerHTML = '';
  for (const o of opts) {
    const el = document.createElement('option');
    el.value = o.v;
    el.textContent = o.label;
    lbRes.appendChild(el);
  }
  // 默认 1080p（UHD 仅按需选），避免点开即拉 4K 原图导致慢网首开偏重
  const def = opts.find(o => o.v === '1920x1080') || opts[0];
  lbRes.value = def.v;
  applyResolution();
  lightbox.hidden = false;
}

lbRes.addEventListener('change', applyResolution);

lbCopy.onclick = async () => {
  if (!current) return;
  // 复制当前所选分辨率的 URL
  const url = buildResUrl(current.url, lbRes.value) || current.url || '';
  try {
    await navigator.clipboard.writeText(url);
    lbCopy.textContent = '已复制 ✓';
    setTimeout(() => (lbCopy.textContent = '复制链接'), 1500);
  } catch {
    lbCopy.textContent = '复制失败';
  }
};

document.getElementById('close').onclick = () => (lightbox.hidden = true);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.hidden = true; });
lbImg.addEventListener('click', () => { if (lbLink.href) window.open(lbLink.href, '_blank', 'noopener'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.hidden = true; });

load().catch(err => { subtitle.textContent = '加载失败：' + err; });
