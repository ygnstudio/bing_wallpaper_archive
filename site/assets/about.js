import { initIcons } from './icons.js';
import { setMessage } from './i18n.js';
import { reveal } from './motion.js';

/** About shares the gallery's settings and modal motion without gallery state. */
export function initAbout() {
  initIcons();
  const toggle = document.getElementById('about-settings');
  const sheet = document.getElementById('about-preferences');
  const closeButton = document.getElementById('about-settings-close');
  const close = async () => {
    if (!sheet.open) return;
    sheet.classList.add('is-closing');
    if (await reveal(sheet, false)) {
      sheet.close();
      sheet.hidden = false;
      sheet.classList.remove('is-closing');
    }
  };
  toggle.addEventListener('click', () => {
    sheet.classList.remove('is-closing');
    toggle.setAttribute('aria-expanded', 'true');
    sheet.hidden = true;
    sheet.showModal();
    reveal(sheet, true);
    closeButton.focus();
  });
  closeButton.addEventListener('click', close);
  sheet.addEventListener('cancel', event => { event.preventDefault(); close(); });
  sheet.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  });
  sheet.addEventListener('click', event => {
    if (event.target !== sheet) return;
    const bounds = sheet.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });

  const status = document.getElementById('about-archive-status');
  fetch('./data/index.json')
    .then(response => {
      if (!response.ok) throw new Error('Archive unavailable');
      return response.json();
    })
    .then(items => {
      if (!Array.isArray(items) || !items.length) throw new Error('Empty archive');
      const dates = items.map(item => item.date).filter(date => /^\d{8}$/.test(date)).sort();
      if (!dates.length) throw new Error('Missing archive dates');
      const dateLabel = date => `${date.slice(0,4)}.${date.slice(4,6)}.${date.slice(6,8)}`;
      setMessage(status, '已收录 {n} 张壁纸 · {from} 至 {to}', {
        n: items.length.toLocaleString('en-US'),
        from: dateLabel(dates[0]),
        to: dateLabel(dates.at(-1))
      });
    })
    .catch(() => setMessage(status, '暂时无法读取归档数量，请稍后重试。'));
}
