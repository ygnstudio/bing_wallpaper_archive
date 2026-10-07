/** Calendar dates are local civil dates, independent of UTC and daylight saving. */
export function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0, 12).getDate();
}
/** Older month-only links expand to the inclusive first/last day. */
export function normalizeDate(value, end = false) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return '';
  const year = +match[1], month = +match[2] - 1;
  if (year < 1000 || month < 0 || month > 11) return '';
  const day = match[3] ? +match[3] : end ? daysInMonth(year, month) : 1;
  return day >= 1 && day <= daysInMonth(year, month) ? isoDate(year, month, day) : '';
}
