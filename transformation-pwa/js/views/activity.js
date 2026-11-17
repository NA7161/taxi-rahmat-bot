// Лента активности и график XP. Данные: gamify.events (каждое начисление XP с причиной).
const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function render(root, ctx) {
  const { store, util: { h, today, addDays, dateKey } } = ctx;
  let range = 14, limit = 40, query = '';

  const dayName = k => {
    if (k === today()) return 'Сегодня';
    if (k === addDays(today(), -1)) return 'Вчера';
    const [, m, d] = k.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  };
  const timeOf = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  function chart(days, values) {
    const W = 320, H = 130, pad = 8, n = days.length;
    const bw = Math.max(4, Math.min(18, (W - pad * 2) / n - 3)), gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    const max = Math.max(...values, 10);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 16}`);
    svg.setAttribute('class', 'ch-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `XP по дням за ${n} дн.`);
    const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
    values.forEach((v, i) => {
      const bh = Math.max(v > 0 ? 2 : 0, (v / max) * (H - 14));
      const x = pad + i * (bw + gap);
      svg.append(el('rect', { x, y: H - bh, width: bw, height: bh, rx: 2, class: 'b' + (i === n - 1 ? ' now' : '') }));
      if (n <= 14 || i % 5 === 0 || i === n - 1) svg.append(el('text', { x: x + bw / 2, y: H + 12 }, days[i].slice(8)));
    });
    return svg;
  }

  function draw() {
    root.replaceChildren();
    const all = (store.get().gamify.events || []).slice().sort((a, b) => b.t - a.t);
    const q = query.trim().toLowerCase();
    const events = q ? all.filter(e => (e.reason || '').toLowerCase().includes(q)) : all;
    const days = [];
    for (let i = range - 1; i >= 0; i--) days.push(addDays(today(), -i));
    const by = {};
    for (const e of all) { const k = dateKey(new Date(e.t)); by[k] = (by[k] || 0) + (e.xp || 0); }
    const values = days.map(d => by[d] || 0);
    const sum = values.reduce((a, b) => a + b, 0), active = values.filter(v => v > 0).length;

    root.append(h('h1', null, '📈 Активность'),
      h('div', { class: 'card' },
        h('div', { class: 'row' },
          [[7, '7 дней'], [14, '14 дней'], [30, '30 дней']].map(([r, l]) =>
            h('button', { class: 'chip' + (range === r ? ' active' : ''), type: 'button', 'aria-pressed': range === r, onclick: () => { range = r; draw(); } }, l))),
        chart(days, values),
        h('p', { class: 'ch-sub' }, `За ${range} дн.: ${sum} XP, активных дней: ${active} из ${range}.`)));

    if (!all.length) {
      root.append(h('div', { class: 'card empty' }, h('div', { class: 'empty-ico', 'aria-hidden': 'true' }, '🌱'),
        h('strong', null, 'Здесь пока пусто'), h('p', { class: 'ch-sub' }, 'Отметьте привычку, пройдите урок или тренировку, и действия появятся в ленте.'),
        h('a', { class: 'btn btn-primary', href: '#/habits' }, 'К привычкам')));
      return;
    }
    const search = h('input', { type: 'search', class: 'input', placeholder: 'Поиск по ленте (например, Тренировка)', 'aria-label': 'Поиск по ленте', value: query });
    search.addEventListener('input', () => { root.classList.add('no-anim'); query = search.value; limit = 40; const pos = search.selectionStart; draw(); const n = root.querySelector('input[type=search]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    root.append(search);
    if (!events.length) { root.append(h('p', { class: 'ch-sub' }, `Ничего не найдено по запросу «${query}».`)); return; }
    const feed = h('div');
    let lastDay = '';
    let ul = null;
    for (const e of events.slice(0, limit)) {
      const k = dateKey(new Date(e.t));
      if (k !== lastDay) {
        lastDay = k;
        feed.append(h('div', { class: 'feed-day' }, dayName(k)));
        ul = h('ul', { class: 'feed' }); feed.append(ul);
      }
      ul.append(h('li', null,
        h('span', null, h('span', { class: 'ch-sub' }, timeOf(e.t) + '  '), e.reason || 'Действие'),
        h('span', { class: 'xp' }, (e.xp >= 0 ? '+' : '') + e.xp + ' XP')));
    }
    root.append(h('h2', null, 'Лента'), feed);
    if (events.length > limit) root.append(h('button', { class: 'btn', type: 'button', onclick: () => { limit += 40; draw(); } }, `Показать ещё (${events.length - limit})`));
  }
  draw();
  return () => root.classList.remove('no-anim');
}
