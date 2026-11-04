export const matchesTextFilter = (values, filter = '') => !filter.trim() || (Array.isArray(values) ? values : [values])
  .some(value => String(value ?? '').toLowerCase().includes(filter.trim().toLowerCase()));

export function matchesNumberFilter(value, filter = '') {
  const text = filter.trim();
  if (!text) return true;
  if (value === null || value === undefined || value === '') return ['unknown', 'none', 'n/a', 'not assessed'].includes(text.toLowerCase());
  const match = text.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)\s*%?$/);
  if (!match || !Number.isFinite(Number(value))) return false;
  const target = Number(match[2]), number = Number(value);
  return match[1] === '>=' ? number >= target : match[1] === '<=' ? number <= target
    : match[1] === '>' ? number > target : match[1] === '<' ? number < target : number === target;
}

export function manilaDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export const filterOptions = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== '').map(String))]
  .sort().map(value => ({ value, label: value }));
