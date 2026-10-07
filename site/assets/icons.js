/** One stroke weight and view box for all interface actions. */
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  folder: '<path d="M3 7V5h7l2 3h9v12H3Z"/>',
  filter: '<path d="M3 7h18M3 17h18"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  landscape: '<path d="m3 20 7-12 4 6 3-4 5 10Z"/><circle cx="17" cy="5" r="2"/>',
  leaf: '<path d="M20 3C9 2 3 7 4 14c1 7 13 7 15-3 1-4 1-8 1-8ZM3 22l12-13"/>',
  building: '<path d="M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-4 6v-3h4v3"/>',
  paw: '<ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="10" rx="2" ry="3"/><ellipse cx="9" cy="5" rx="2" ry="3"/><ellipse cx="15" cy="5" rx="2" ry="3"/><ellipse cx="19" cy="10" rx="2" ry="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  view: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v18M8 16l5-6 8 9"/>',
  shuffle: '<path d="M20 7h-5a4 4 0 0 0-3.3 1.8l-4.4 6.4A4 4 0 0 1 4 17H2m14-14 4 4-4 4M2 7h2a4 4 0 0 1 3.3 1.8l4.4 6.4A4 4 0 0 0 15 17h5m-4-4 4 4-4 4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  up: '<path d="m5 11 7-7 7 7M12 4v16"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
export function initIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
