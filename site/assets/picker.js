/** Year, month and day selection inside the frosted filter dialog. */
import { dateMin, dateMax } from './state.js';
import { isoDate, daysInMonth } from './dates.js';
import { t } from './i18n.js';
import { animateIn, canAnimate } from './motion.js';
let refresh = () => {};
export function syncDateInputs() { refresh(); }
export function setupDateInputs(els) {
  const toIso = value => `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  const min = toIso(dateMin), max = toIso(dateMax);
  const inputs = [els.dateFrom, els.dateTo];
  const panel = document.createElement('div');
  panel.className = 'month-picker'; panel.id = 'date-picker'; panel.hidden = true;
  panel.innerHTML = '<div class="month-picker-header"><button type="button" class="icon-button" data-step="-1">‹</button><div class="calendar-heading"><button type="button" class="calendar-year" aria-controls="calendar-years" aria-expanded="false"></button><button type="button" class="calendar-month" aria-controls="calendar-months" aria-expanded="false"></button></div><button type="button" class="icon-button" data-step="1">›</button></div><div id="calendar-years" class="month-grid year-grid" role="group" hidden></div><div id="calendar-months" class="month-grid" role="group" hidden></div><div class="calendar-weekdays" aria-hidden="true"></div><div class="day-grid" role="group"></div>';
  els.datePanel.append(panel);
  const yearToggle = panel.querySelector('.calendar-year'), years = panel.querySelector('.year-grid');
  const months = panel.querySelector('#calendar-months');
  const grid = panel.querySelector('.day-grid'), weekdays = panel.querySelector('.calendar-weekdays');
  const monthToggle = panel.querySelector('.calendar-month');
  const minYear = +min.slice(0,4), maxYear = +max.slice(0,4);
  let yearPage = minYear;
  let target = null, year = +max.slice(0,4), month = +max.slice(5,7) - 1;
  function normalizeRange() {
    if (inputs[0].value && inputs[1].value && inputs[0].value > inputs[1].value)
      [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
  }
  normalizeRange();
  const triggers = inputs.map(input => {
    input.min = min; input.max = max; input.hidden = true;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'month-trigger';
    button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
    input.after(button);
    button.addEventListener('click', () => {
      if (target === input && !panel.hidden) { close(); return; }
      target = input;
      const value = (input.value || max) < min ? min : (input.value || max) > max ? max : input.value || max;
      year = +value.slice(0,4); month = +value.slice(5,7) - 1;
      years.hidden = months.hidden = true; panel.hidden = false; render(); animateIn(panel, 6);
      grid.querySelector('[aria-pressed="true"]:not(:disabled),button[tabindex="0"]')?.focus({ preventScroll:true });
      panel.scrollIntoView({ block:'nearest', behavior:canAnimate(panel) ? 'smooth' : 'instant' });
    });
    input.addEventListener('change', () => {
      if (!input.checkValidity()) return;
      normalizeRange(); els.updateDateTriggerText(); els.applyFilter();
    });
    return button;
  });
  function close() {
    panel.hidden = true;
    triggers.forEach(button => button.setAttribute('aria-expanded','false'));
  }
  function render() {
    const locale = document.documentElement.lang;
    const dateFormatter = new Intl.DateTimeFormat(locale, { year:'numeric', month:'long', day:'numeric' });
    const monthFormatter = new Intl.DateTimeFormat(locale, { month:'short' });
    inputs.forEach((input,index) => {
      const label = t(index === 0 ? '开始日期' : '结束日期');
      triggers[index].textContent = input.value ? dateFormatter.format(new Date(input.value+'T12:00:00')) : t('选择日期');
      triggers[index].setAttribute('aria-label', `${label}: ${triggers[index].textContent}`);
      triggers[index].setAttribute('aria-expanded', String(!panel.hidden && target === input));
    });
    const ym = isoDate(year,month,1).slice(0,7);
    panel.querySelectorAll('[data-step]').forEach(button => {
      const previous = +button.dataset.step < 0;
      button.setAttribute('aria-label', t(!years.hidden ? previous ? '上一组年份' : '下一组年份' : !months.hidden ? previous ? '上一年' : '下一年' : previous ? '上个月' : '下个月'));
      button.disabled = !years.hidden ? previous ? yearPage <= minYear : yearPage + 11 >= maxYear : !months.hidden ? previous ? year <= minYear : year >= maxYear : previous ? ym <= min.slice(0,7) : ym >= max.slice(0,7);
    });
    yearToggle.textContent = String(year);
    yearToggle.setAttribute('aria-label', `${t('选择年份')}: ${year}`);
    yearToggle.setAttribute('aria-expanded', String(!years.hidden));
    years.setAttribute('aria-label', t('选择年份'));
    years.replaceChildren();
    for (let y = yearPage; y <= Math.min(yearPage + 11, maxYear); y++) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.year = y;
      button.textContent = String(y); button.setAttribute('aria-pressed', String(y === year)); years.append(button);
    }
    monthToggle.textContent = monthFormatter.format(new Date(year,month,1));
    monthToggle.setAttribute('aria-label', `${t('选择月份')}: ${monthToggle.textContent}`);
    monthToggle.setAttribute('aria-expanded', String(!months.hidden));
    months.setAttribute('aria-label', t('选择月份'));
    grid.setAttribute('aria-label', t(target === inputs[1] ? '结束日期' : '开始日期'));
    months.replaceChildren();
    for (let m = 0; m < 12; m++) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.month = m;
      button.textContent = monthFormatter.format(new Date(year,m,1));
      button.disabled = isoDate(year,m,daysInMonth(year,m)) < min || isoDate(year,m,1) > max;
      button.setAttribute('aria-pressed', String(m === month)); months.append(button);
    }
    grid.hidden = weekdays.hidden = !months.hidden || !years.hidden;
    weekdays.replaceChildren();
    for (let d = 0; d < 7; d++) {
      const label = document.createElement('span');
      label.textContent = new Intl.DateTimeFormat(locale,{ weekday:'narrow' }).format(new Date(2024,0,7+d));
      weekdays.append(label);
    }
    grid.replaceChildren();
    const offset = new Date(year,month,1,12).getDay();
    let firstEnabled;
    for (let day = 1; day <= daysInMonth(year,month); day++) {
      const value = isoDate(year,month,day), button = document.createElement('button');
      button.type = 'button'; button.dataset.value = value; button.textContent = day;
      if (day === 1) button.style.gridColumnStart = String(offset+1);
      button.disabled = value < min || value > max;
      button.setAttribute('aria-label',dateFormatter.format(new Date(year,month,day,12)));
      button.setAttribute('aria-pressed',String(target?.value === value));
      button.tabIndex = -1;
      if (!button.disabled && !firstEnabled) firstEnabled = button;
      grid.append(button);
    }
    const focus = grid.querySelector('[aria-pressed="true"]:not(:disabled)') || firstEnabled;
    if (focus) focus.tabIndex = 0;
  }
  function clampMonth() {
    const ym = isoDate(year,month,1).slice(0,7);
    if (ym < min.slice(0,7)) month = +min.slice(5,7)-1;
    if (ym > max.slice(0,7)) month = +max.slice(5,7)-1;
  }
  panel.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    const step = +button.dataset.step;
    if (!years.hidden) yearPage += step * 12;
    else if (!months.hidden) { year += step; clampMonth(); }
    else {
      const date = new Date(year,month + step,1,12);
      year = date.getFullYear(); month = date.getMonth();
    }
    render();
  }));
  yearToggle.addEventListener('click', () => {
    years.hidden = !years.hidden; months.hidden = true;
    yearPage = minYear + Math.floor((year-minYear)/12)*12; render();
  });
  years.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    year = +button.dataset.year; clampMonth(); years.hidden = true; months.hidden = false; render();
    months.querySelector('[aria-pressed="true"]')?.focus();
  });
  monthToggle.addEventListener('click', () => { months.hidden = !months.hidden; years.hidden = true; render(); });
  months.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    month = +button.dataset.month; months.hidden = true; render(); grid.querySelector('[tabindex="0"]')?.focus();
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled || !target) return;
    const input = target; input.value = button.dataset.value; close();
    input.dispatchEvent(new Event('change',{ bubbles:true })); triggers[inputs.indexOf(input)].focus({ preventScroll:true });
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(); triggers[inputs.indexOf(target)]?.focus({ preventScroll:true }); return;
    }
    if (!event.target.closest('.day-grid')) return;
    const current = new Date(event.target.dataset.value+'T12:00:00');
    const delta = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7, Home:-current.getDay(), End:6-current.getDay() }[event.key];
    if (delta === undefined) return;
    event.preventDefault(); current.setDate(current.getDate()+delta);
    const value = isoDate(current.getFullYear(),current.getMonth(),current.getDate());
    if (value < min || value > max) return;
    year = current.getFullYear(); month = current.getMonth(); render();
    grid.querySelectorAll('button').forEach(button => { button.tabIndex = button.dataset.value === value ? 0 : -1; });
    grid.querySelector('[tabindex="0"]')?.focus();
  });
  els.dateClear.addEventListener('click', close);
  document.getElementById('filter-reset').addEventListener('click', close);
  document.getElementById('filter-dialog-reset').addEventListener('click', close);
  refresh = render; render();
}
