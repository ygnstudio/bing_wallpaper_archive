const grid = document.getElementById('grid');
const searchEl = document.getElementById('search');
const yearEl = document.getElementById('year');
const monthEl = document.getElementById('month');
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
const lbCopyMd = document.getElementById('lb-copy-md');
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
const batchResNote = document.getElementById('batch-res-note');
const catPills = document.getElementById('cat-pills');
const colorPills = document.getElementById('color-pills');
const sortEl = document.getElementById('sort');
const dateToggle = document.getElementById('date-toggle');
const datePanel = document.getElementById('date-panel');
const archiveStats = document.getElementById('archive-stats');
const hero = document.getElementById('hero');
const heroBgImg = document.getElementById('hero-bg-img');
const heroDate = document.getElementById('hero-date');
const heroTitle = document.getElementById('hero-title');
const heroDesc = document.getElementById('hero-desc');
const heroDownload = document.getElementById('hero-download');
const heroView = document.getElementById('hero-view');

const PAGE = 60;            // 每批渲染的卡片数
const ROOT_MARGIN = '600px';
let items = [];
let filtered = [];
let rendered = 0;
let current = null;         // 当前灯箱对应的数据项
let byDate = new Map();     // date -> item
const selected = new Set(); // 已勾选的 date 集合

let activeCat = '';
let activeColor = '';

// 分类/颜色筛选的可选项顺序
const CATEGORY_ORDER = ['动物', '风景', '建筑', '植物', '人物', '太空', '交通', '美食', '抽象艺术', '其他'];
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
  renderCategoryPills();
  renderColorPills();
  renderHero();
  applyFilter();
  updateStats();
}

function updateStats() {
  const withImg = items.filter(i => i.thumbnail).length;
  archiveStats.textContent = `已归档 ${items.length.toLocaleString()} 张 · 每日更新`;
  document.title = `Bing 每日壁纸归档 · ${items.length.toLocaleString()} 张`;
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

// 在当前「其他维度」筛选条件下，统计某个维度（category/color）某取值的数量。
// 例如统计「动物」数量时，会应用年份、月份、颜色、搜索条件，但不限制分类本身，
// 这样切换年月/颜色后，每个分类 pill 上的数字会实时反映可匹配的数量。
function countBy(dim, value) {
  const q = searchEl.value.trim().toLowerCase();
  const y = yearEl.value;
  const m = monthEl.value;
  return items.filter(i => {
    if (y && i.date.slice(0, 4) !== y) return false;
    if (m && i.date.slice(4, 6) !== m) return false;
    if (dim !== 'category' && activeCat && i.category !== activeCat) return false;
    if (dim !== 'color' && activeColor && i.color !== activeColor) return false;
    if (q) {
      const hay = ((i.title || '') + (i.copyright || '') + (i.date || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return i[dim] === value;
  }).length;
}

function renderCategoryPills() {
  const present = new Set(items.map(i => i.category).filter(Boolean));
  catPills.innerHTML = '';
  const allBtn = makePill('全部', '', activeCat === '', catPills, (v) => { activeCat = v; applyFilter(); });
  allBtn.setAttribute('role', 'tab');
  for (const c of CATEGORY_ORDER) {
    if (!present.has(c)) continue;
    const n = countBy('category', c);
    const btn = makePill(c, c, activeCat === c, catPills, (v) => { activeCat = v; applyFilter(); }, n);
    btn.setAttribute('role', 'tab');
  }
}

function renderColorPills() {
  const present = new Set(items.map(i => i.color).filter(Boolean));
  colorPills.innerHTML = '';
  const allBtn = makeColorPill('全部', '', activeColor === '', colorPills, (v) => { activeColor = v; applyFilter(); });
  allBtn.setAttribute('role', 'tab');
  for (const c of COLOR_ORDER) {
    if (!present.has(c)) continue;
    const n = countBy('color', c);
    const btn = makeColorPill(c, c, activeColor === c, colorPills, (v) => { activeColor = v; applyFilter(); }, n);
    btn.setAttribute('role', 'tab');
  }
}

function makePill(label, value, active, parent, onClick, count) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill' + (active ? ' active' : '');
  btn.textContent = count != null ? `${label} ${count}` : label;
  btn.addEventListener('click', () => onClick(value));
  parent.appendChild(btn);
  return btn;
}

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

function renderHero() {
  const latest = items[0];
  if (!latest) return;
  hero.hidden = false;
  const full = buildResUrl(latest.url, 'UHD') || latest.url;
  heroBgImg.src = full;
  heroBgImg.alt = latest.title || latest.date;
  // UHD 不可用时（如历史镜像图）回退 1080p 原图，避免显示模糊缩略图
  heroBgImg.onerror = () => {
    heroBgImg.onerror = null;
    const fb = buildResUrl(latest.url, '1920x1080') || latest.url;
    if (heroBgImg.src !== fb) heroBgImg.src = fb;
  };
  heroDate.textContent = formatDate(latest.date);
  heroTitle.textContent = latest.title || latest.date;
  heroDesc.textContent = latest.copyright || '';
  heroDownload.onclick = () => downloadHero(latest, 'UHD');
  heroView.onclick = () => openLightbox(latest);
}

function formatDate(d) {
  if (!d || d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

async function downloadHero(it, res) {
  if (res === 'UHD' && it.uhd === false) res = '1920x1080'; // 该图无 4K，回退 1080p
  try {
    const url = buildResUrl(it.url, res) || it.url;
    const bytes = await fetchBytes(url);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${it.date}_${res}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) {
    openLightbox(it);
  }
}

function getFiltered() {
  const q = searchEl.value.trim().toLowerCase();
  const y = yearEl.value;
  const m = monthEl.value;
  const cat = activeCat;
  const col = activeColor;
  const out = items.filter(i => {
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
  const sort = sortEl.value;
  if (sort === 'oldest') out.reverse();
  return out;
}

function applyFilter() {
  if (document.activeElement !== monthEl) rebuildMonthOptions();
  filtered = getFiltered();
  rendered = 0;
  grid.innerHTML = '';
  renderMore();
  renderCategoryPills();
  renderColorPills();
}

function renderMore() {
  const batch = filtered.slice(rendered, rendered + PAGE);
  const frag = document.createDocumentFragment();
  for (const it of batch) {
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
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = it.thumbnail;
      img.alt = it.title || it.date;
      media.appendChild(img);
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
    frag.appendChild(card);
  }
  grid.appendChild(frag);
  rendered += batch.length;
  emptyEl.hidden = filtered.length !== 0;
  sentinel.textContent = rendered < filtered.length
    ? `加载更多…（${rendered}/${filtered.length}）`
    : (rendered ? '已显示全部' : '');
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && rendered < filtered.length) renderMore();
  }
}, { rootMargin: ROOT_MARGIN });
io.observe(sentinel);

searchEl.addEventListener('input', applyFilter);
yearEl.addEventListener('change', applyFilter);
monthEl.addEventListener('change', applyFilter);
sortEl.addEventListener('change', applyFilter);

dateToggle.addEventListener('click', () => {
  const hidden = !datePanel.hidden;
  datePanel.hidden = hidden;
  dateToggle.classList.toggle('open', !hidden);
});

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
  batchZip.disabled = n < 1;
  batchZip.textContent = n === 0 ? '未选择'
    : n === 1 ? '下载这张'
    : `打包下载 ZIP（${n}）`;
  batchSelectAll.disabled = filtered.length === 0;
  batchClear.disabled = n === 0;
  refreshBatchRes();
}

// 按所选图片的 4K 可用性自动调整分辨率选择器：
// - 全部支持 4K → 允许 4K，默认 4K
// - 含无 4K 的图（或全部仅 1080p）→ 锁定 1080p 并禁用 4K 选项（不混用分辨率）
function refreshBatchRes() {
  const sel = [...selected].map(d => byDate.get(d)).filter(Boolean);
  if (sel.length === 0) {
    enableUhdOption(true);
    batchResNote.hidden = true;
    return;
  }
  const allUhd = sel.every(it => it.uhd !== false);
  const allNonUhd = sel.every(it => it.uhd === false);
  if (allUhd) {
    enableUhdOption(true);
    if (batchRes.value !== 'UHD') batchRes.value = 'UHD';
    batchResNote.hidden = true;
  } else {
    enableUhdOption(false);
    batchRes.value = '1920x1080';
    batchResNote.hidden = false;
    batchResNote.textContent = allNonUhd
      ? '所选图片仅支持 1080p，已自动按 1080p 下载'
      : '部分所选图片无 4K，已按 1080p 下载（不混用分辨率）';
  }
}

function enableUhdOption(enabled) {
  for (const opt of batchRes.options) {
    if (opt.value === 'UHD') opt.disabled = !enabled;
  }
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
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
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
    cv.setUint32(16, crc, true);
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

async function fetchWithFallback(it, res) {
  const order = [res];
  if (res === 'UHD') order.push('1920x1080'); // 4K 不可用时回退 1080p
  for (const r of order) {
    if (r === 'UHD' && it.uhd === false) continue; // 明确无 4K 则跳过
    try {
      const url = buildResUrl(it.url, r) || it.url;
      const bytes = await fetchBytes(url);
      const suffix = r === 'UHD' ? '_UHD' : '';
      return { bytes, name: it.date + suffix + '.jpg' };
    } catch (_) { }
  }
  if (it.thumbnail) {
    try {
      const bytes = await fetchBytes('./' + it.thumbnail);
      return { bytes, name: it.date + '_thumb.jpg' };
    } catch (_) { }
  }
  return null;
}

async function downloadSingle(date) {
  const it = byDate.get(date);
  if (!it) return;
  const got = await fetchWithFallback(it, batchRes.value);
  if (!got) { batchProgress.textContent = '无可用图片，取消'; return; }
  const blob = new Blob([got.bytes], { type: 'image/jpeg' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = got.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  batchProgress.textContent = '已下载这张 ✓';
}

async function doBatchDownload() {
  const n = selected.size;
  if (n === 0) return;
  if (n === 1) { await downloadSingle([...selected][0]); return; }
  if (n >= 50 && !confirm(`将打包 ${n} 张图片，文件可能较大、耗时较长，继续？`)) return;
  const res = batchRes.value;
  batchZip.disabled = true;
  batchClear.disabled = true;
  batchSelectAll.disabled = true;

  const queue = [...selected];
  const entries = [];
  let done = 0;
  const CONC = 4;

  async function worker() {
    while (queue.length) {
      const date = queue.shift();
      const it = byDate.get(date);
      if (!it) { done++; continue; }
      const got = await fetchWithFallback(it, res);
      if (got) entries.push(got);
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
batchToggle.addEventListener('click', () => { batchPanel.hidden = !batchPanel.hidden; });
document.addEventListener('click', (e) => {
  if (batchPanel.hidden) return;
  if (!batchbar.contains(e.target)) batchPanel.hidden = true;
});
updateBatchBar();

function supportedResolutions(item) {
  const u = item.url || '';
  const bing = /bing\.com\/th\?id=OHR/i.test(u);
  if (!bing) {
    return [{ v: '1920x1080', label: '1080p（已是最清）' }];
  }
  // uhd 为 false 时该图确实无 4K 源，只给 1080p
  if (item.uhd === false) {
    return [{ v: '1920x1080', label: '1080p（仅此分辨率）' }];
  }
  return [
    { v: 'UHD', label: 'UHD (4K)' },
    { v: '1920x1080', label: '1080p' },
  ];
}

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
  const def = opts.find(o => o.v === '1920x1080') || opts[0];
  lbRes.value = def.v;
  applyResolution();
  lightbox.hidden = false;
}

lbRes.addEventListener('change', applyResolution);

lbCopy.onclick = async () => {
  if (!current) return;
  const url = buildResUrl(current.url, lbRes.value) || current.url || '';
  try {
    await navigator.clipboard.writeText(url);
    lbCopy.textContent = '已复制 ✓';
    setTimeout(() => (lbCopy.textContent = '复制链接'), 1500);
  } catch {
    lbCopy.textContent = '复制失败';
  }
};

lbCopyMd.onclick = async () => {
  if (!current) return;
  const url = buildResUrl(current.url, lbRes.value) || current.url || '';
  const alt = current.title || current.date || '';
  const md = `![${alt}](${url})`;
  try {
    await navigator.clipboard.writeText(md);
    lbCopyMd.textContent = '已复制 ✓';
    setTimeout(() => (lbCopyMd.textContent = '复制 Markdown'), 1500);
  } catch {
    lbCopyMd.textContent = '复制失败';
  }
};

document.getElementById('close').onclick = () => (lightbox.hidden = true);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.hidden = true; });
lbImg.addEventListener('click', () => { if (lbLink.href) window.open(lbLink.href, '_blank', 'noopener'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.hidden = true; });

load().catch(err => { archiveStats.textContent = '加载失败：' + err; });
