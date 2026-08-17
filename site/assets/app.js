const grid = document.getElementById('grid');
const subtitle = document.getElementById('subtitle');
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
const lbRes = document.getElementById('lb-res');

const PAGE = 60;            // 每批渲染的卡片数
const ROOT_MARGIN = '600px';
let items = [];
let filtered = [];
let rendered = 0;
let current = null;         // 当前灯箱对应的数据项

async function load() {
  const res = await fetch('./data/index.json');
  items = await res.json();
  buildYearOptions();
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

function getFiltered() {
  const q = searchEl.value.trim().toLowerCase();
  const y = yearEl.value;
  const m = monthEl.value;
  return items.filter(i => {
    if (y && i.date.slice(0, 4) !== y) return false;
    if (m && i.date.slice(4, 6) !== m) return false;
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

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  const it = items.find(i => i.date === card.dataset.date);
  if (it) openLightbox(it);
});

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
  lbRes.value = opts[0].v;
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
