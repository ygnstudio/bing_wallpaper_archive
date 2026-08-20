/**
 * 自定义月份选择器弹窗
 * 日期范围筛选的交互组件。
 */

import { dateMinYm, dateMaxYm, fmtYm } from './filter.js';

/** @type {'from'|'to'|null} */
let pickerTarget = null;
let pickerYear = new Date().getFullYear();

/**
 * 初始化月份选择器事件
 * @param {Object} els
 * @param {HTMLElement} els.monthPicker
 * @param {HTMLElement} els.mpPrev
 * @param {HTMLElement} els.mpNext
 * @param {HTMLElement} els.mpYear
 * @param {HTMLElement} els.mpGrid
 * @param {HTMLElement} els.mpClear
 * @param {HTMLElement} els.mpThis
 * @param {HTMLElement} els.dateFromTrigger
 * @param {HTMLElement} els.dateToTrigger
 * @param {HTMLInputElement} els.dateFrom
 * @param {HTMLInputElement} els.dateTo
 * @param {Function} els.updateDateTriggerText
 * @param {Function} els.applyFilter
 */
export function initMonthPicker(els) {
  const { monthPicker, mpPrev, mpNext, mpClear, mpThis } = els;

  els.dateFromTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    openMonthPicker('from', els);
  });
  els.dateToTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    openMonthPicker('to', els);
  });
  mpPrev.addEventListener('click', () => { pickerYear--; renderMonthPicker(els); });
  mpNext.addEventListener('click', () => { pickerYear++; renderMonthPicker(els); });
  mpClear.addEventListener('click', () => clearActiveMonth(els));
  mpThis.addEventListener('click', () => setMonthToThisMonth(els));

  document.addEventListener('click', (e) => {
    if (!monthPicker.hidden && !monthPicker.contains(e.target) &&
        e.target !== els.dateFromTrigger && !els.dateFromTrigger.contains(e.target) &&
        e.target !== els.dateToTrigger && !els.dateToTrigger.contains(e.target)) {
      closeMonthPicker(monthPicker);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMonthPicker(monthPicker);
  });
}

/**
 * 设置日期输入框的 min/max
 * @param {Object} els
 */
export function setupDateInputs(els) {
  const min = fmtYm(dateMinYm);
  const max = fmtYm(dateMaxYm);
  els.dateFrom.min = els.dateTo.min = min;
  els.dateFrom.max = els.dateTo.max = max;
}

/**
 * 打开月份选择器
 * @param {'from'|'to'} target
 * @param {Object} els
 */
function openMonthPicker(target, els) {
  pickerTarget = target;
  const currentValue = target === 'from' ? els.dateFrom.value : els.dateTo.value;
  pickerYear = currentValue ? +currentValue.split('-')[0] : new Date().getFullYear();
  renderMonthPicker(els);
  els.monthPicker.hidden = false;
  positionMonthPicker(els);
}

/**
 * 关闭月份选择器
 * @param {HTMLElement} monthPicker
 */
export function closeMonthPicker(monthPicker) {
  monthPicker.hidden = true;
  pickerTarget = null;
}

/**
 * 定位弹窗到触发按钮下方
 * @param {Object} els
 */
function positionMonthPicker(els) {
  const trigger = pickerTarget === 'from' ? els.dateFromTrigger : els.dateToTrigger;
  const rect = trigger.getBoundingClientRect();
  const pickerRect = els.monthPicker.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 6;
  let left = rect.left + window.scrollX;
  if (left + pickerRect.width > window.innerWidth - 12) {
    left = window.innerWidth - pickerRect.width - 12;
  }
  els.monthPicker.style.top = `${top}px`;
  els.monthPicker.style.left = `${left}px`;
}

/**
 * 渲染月份网格
 * @param {Object} els
 */
function renderMonthPicker(els) {
  const { monthPicker, mpYear, mpGrid, dateFrom, dateTo } = els;
  mpYear.textContent = String(pickerYear);
  mpGrid.innerHTML = '';
  const selectedValue = pickerTarget === 'from' ? dateFrom.value : dateTo.value;
  const selectedYear = selectedValue ? +selectedValue.split('-')[0] : null;
  const selectedMonth = selectedValue && selectedYear === pickerYear ? selectedValue.split('-')[1] : null;
  const minYear = +dateMinYm.slice(0, 4);
  const minMonth = +dateMinYm.slice(4, 6);
  const maxYear = +dateMaxYm.slice(0, 4);
  const maxMonth = +dateMaxYm.slice(4, 6);

  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${m}月`;
    const tooEarly = pickerYear < minYear || (pickerYear === minYear && m < minMonth);
    const tooLate = pickerYear > maxYear || (pickerYear === maxYear && m > maxMonth);
    if (tooEarly || tooLate) {
      btn.classList.add('out-of-range');
      btn.disabled = true;
    }
    if (selectedMonth === monthStr) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => {
      const input = pickerTarget === 'from' ? dateFrom : dateTo;
      setDate(input, `${pickerYear}-${monthStr}`, els);
    });
    mpGrid.appendChild(btn);
  }
}

/**
 * 设置日期并自动防反
 * @param {HTMLInputElement} input
 * @param {string} value
 * @param {Object} els
 */
function setDate(input, value, els) {
  input.value = value;
  normalizeDateRange(els);
  els.updateDateTriggerText();
  els.applyFilter();
  closeMonthPicker(els.monthPicker);
}

/**
 * 若起始晚于结束则自动互换
 * @param {Object} els
 */
function normalizeDateRange(els) {
  if (els.dateFrom.value && els.dateTo.value && els.dateFrom.value > els.dateTo.value) {
    const tmp = els.dateFrom.value;
    els.dateFrom.value = els.dateTo.value;
    els.dateTo.value = tmp;
  }
}

/**
 * 设为当前月份
 * @param {Object} els
 */
function setMonthToThisMonth(els) {
  const now = new Date();
  const input = pickerTarget === 'from' ? els.dateFrom : els.dateTo;
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  setDate(input, ym, els);
}

/**
 * 清除当前月份
 * @param {Object} els
 */
function clearActiveMonth(els) {
  const input = pickerTarget === 'from' ? els.dateFrom : els.dateTo;
  input.value = '';
  els.updateDateTriggerText();
  els.applyFilter();
  closeMonthPicker(els.monthPicker);
}

/**
 * 公开：互换起始与结束日期
 * @param {Object} els
 */
export function swapDateRange(els) {
  const tmp = els.dateFrom.value;
  els.dateFrom.value = els.dateTo.value;
  els.dateTo.value = tmp;
  els.updateDateTriggerText();
  els.applyFilter();
}
