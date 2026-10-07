import { t } from './i18n.js';
import { reveal, scrollToGallery } from './motion.js';

/** Navigation and search share a modal, with native focus containment. */
export function initNavigation({ resetFilters, applySearch }) {
  const search = document.querySelector('.nav-search');
  const sheet = document.getElementById('nav-sheet');
  const content = sheet.querySelector('.sheet-content');
  const title = document.getElementById('sheet-title');
  const navigation = document.getElementById('sidebar');
  const home = document.getElementById('navigation-home');
  const toggle = document.getElementById('sidebar-toggle');
  const filters = document.getElementById('filter-toolbar');
  const filterToggle = document.getElementById('filter-toggle');
  const searchToggle = document.getElementById('mobile-search');
  const filterActions = sheet.querySelector('.filter-dialog-actions');
  const titles = {navigation:'设置',search:'搜索壁纸',filters:'筛选'};
  let panel = '';
  const restore = () => {
    document.getElementById('search-home').after(search);
    home.append(navigation);
    document.getElementById('filter-home').append(filters);
    filterToggle.setAttribute('aria-expanded','false');
    searchToggle.setAttribute('aria-expanded','false');
    filterActions.hidden=true;
    toggle.setAttribute('aria-expanded','false');
    panel = '';
  };
  const close = async () => {
    if (!sheet.open) return;
    sheet.classList.add('is-closing');
    if (await reveal(sheet,false)) { sheet.close(); sheet.hidden=false; sheet.classList.remove('is-closing'); }
  };
  const open = kind => {
    if(sheet.open) sheet.close();
    restore();
    sheet.classList.remove('is-closing');
    panel = kind;
    title.textContent = t(titles[kind]);
    sheet.dataset.panel=kind;
    filterActions.hidden=kind!=='filters';
    filterToggle.setAttribute('aria-expanded',String(kind==='filters'));
    searchToggle.setAttribute('aria-expanded',String(kind==='search'));
    content.append(kind==='navigation'?navigation:kind==='filters'?filters:search);
    toggle.setAttribute('aria-expanded',String(kind==='navigation'));
    sheet.hidden=true;
    sheet.showModal();
    reveal(sheet,true);
    (kind==='search'?document.getElementById('search'):content.querySelector('button')).focus();
  };
  sheet.addEventListener('cancel',event=>{ event.preventDefault(); close(); });
  sheet.addEventListener('close', () => { if (!sheet.open) restore(); });
  sheet.addEventListener('click', event => { if (event.target === sheet) { const r=sheet.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) close(); } });
  document.getElementById('sheet-close').addEventListener('click',close);
  document.getElementById('mobile-search').addEventListener('click',event=>open('search'));
  const gallery = scrollToGallery;
  filterToggle.addEventListener('click',()=>open('filters'));
  document.getElementById('filter-dialog-reset').addEventListener('click',resetFilters);
  document.getElementById('filter-dialog-done').addEventListener('click',async()=>{ await close(); gallery(); });
  search.addEventListener('submit',async event=>{ event.preventDefault(); applySearch(); await close(); gallery(); });
  toggle.addEventListener('click',()=>open('navigation'));
  document.addEventListener('languagechange',()=>{
    if(panel) title.textContent=t(titles[panel]);
  });
  initScrollControls();
}

/** Keep floating controls out of the way until page scrolling settles. */
function initScrollControls() {
  const root = document.documentElement;
  let idleTimer;
  const show = () => {
    clearTimeout(idleTimer);
    root.classList.remove('controls-scrolling');
  };
  window.addEventListener('scroll', () => {
    if (root.dataset.input === 'keyboard' || document.querySelector('dialog[open]')) {
      show();
      return;
    }
    root.classList.add('controls-scrolling');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(show, 320);
  }, { passive:true });
  // Keyboard users can reach the controls immediately, even during smooth scrolling.
  document.addEventListener('keydown', show, true);
  document.addEventListener('focusin', show);
  window.addEventListener('pageshow', show);
}
