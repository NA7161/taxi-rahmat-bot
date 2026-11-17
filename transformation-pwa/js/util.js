// Общие хелперы. Никакого innerHTML с пользовательскими данными: только h() и textContent.

/** Локальная дата YYYY-MM-DD (не UTC!). */
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const today = () => dateKey();
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/**
 * Создание DOM: h('div', {class:'card', onclick: fn}, 'текст', childNode, ...)
 * Строки становятся текстовыми узлами (безопасно). null/false пропускаются.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Всплывающее уведомление внизу экрана. */
export function toast(msg, ms = 2200) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg);
  box.append(t);
  while (box.children.length > 2) box.firstChild.remove(); // стопка уведомлений закрывает контент
  setTimeout(() => t.remove(), ms);
}

/** Серия подряд идущих дней до сегодня (сегодня можно ещё не выполнить). has(key)->bool */
export function streak(has) {
  let k = today(), n = 0;
  if (!has(k)) k = addDays(k, -1);
  while (has(k)) { n++; k = addDays(k, -1); }
  return n;
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
