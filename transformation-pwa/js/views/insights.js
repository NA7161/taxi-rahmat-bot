// Подсказки и недельный обзор. Источник: js/insights.js (правила по вашим данным, не ИИ).
import { computeInsights } from '../insights.js';

export function render(root, ctx) {
  const { store, util: { h, today, addDays, dateKey } } = ctx;
  const s = store.get();
  const events = s.gamify.events || [];
  const by = {};
  for (const e of events) { const k = dateKey(new Date(e.t)); by[k] = (by[k] || 0) + (e.xp || 0); }
  const sum = (from, n) => { let t = 0, d = 0; for (let i = 0; i < n; i++) { const v = by[addDays(from, i)] || 0; t += v; if (v > 0) d++; } return { t, d }; };
  const cur = sum(addDays(today(), -6), 7), prev = sum(addDays(today(), -13), 7);
  const list = computeInsights(s, new Date());

  root.append(
    h('h1', null, '💡 Подсказки'),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'ch-sub' }, 'XP за 7 дней'), h('div', { class: 'ch-big' }, String(cur.t)),
        h('div', { class: 'ch-sub' }, `прошлые 7: ${prev.t}`)),
      h('div', { class: 'card' }, h('div', { class: 'ch-sub' }, 'Активных дней'), h('div', { class: 'ch-big' }, `${cur.d} из 7`),
        h('div', { class: 'ch-sub' }, `прошлые 7: ${prev.d}`))),
    h('h2', null, list.length ? `Что заметно сейчас (${list.length})` : 'Пока без подсказок'),
    list.length
      ? h('div', { class: 'list' }, list.map(i => h('a', { class: `card tip ${i.tone}`, href: i.href || '#/home' },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, i.icon),
        h('span', null, h('strong', null, i.title), h('br'), h('span', { class: 'ch-sub' }, i.text)))))
      : h('div', { class: 'card' }, h('p', null, 'Подсказки появятся, когда накопится немного данных.')),
    h('p', { class: 'ch-sub' }, 'Как это работает: подсказки считаются простыми правилами по вашим записям (серии, пропуски, вода и сон за 7 дней, цель челленджа). Это не искусственный интеллект и не медицинские советы. Данные не покидают телефон.'));
}
