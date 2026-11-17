// Вью «Привычки». Владелец среза state.habits.
// items: [{id,name,icon,days:[0..6] (0=вс, как Date.getDay()),createdAt,archived, cue?}]
// log: {'YYYY-MM-DD':[habitId]}
// awarded: {'YYYY-MM-DD|habitId': 1}  (доп. поле: защита от накрутки XP)
import { dateKey, today, addDays, uid, h, toast } from '../util.js';

const XP_TODAY = 10;
const XP_YESTERDAY = 5;
const ICONS = ['✅', '💧', '📖', '🏃', '🧘', '🥗', '😴', '✍️', '🦷', '🚶', '🎧', '💊'];
const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // индекс = getDay()
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // отображение с понедельника
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ---------- чистые функции статистики (работают по переданному state) ----------
function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function dow(key) { return parseKey(key).getDay(); }
const slice = state => state.habits || { items: [], log: {} };
function isScheduled(item, key) { return (item.days || ALL_DAYS).includes(dow(key)); }
function isDone(hs, item, key) { const a = hs.log && hs.log[key]; return !!a && a.includes(item.id); }
function startKey(item) { return item.createdAt ? dateKey(new Date(item.createdAt)) : '0000-00-00'; }

/** Текущая серия: подряд выполненные запланированные дни (не запланированные пропускаются). */
function currentStreak(hs, item) {
  if (!(item.days || ALL_DAYS).length) return 0;
  let k = today(), n = 0;
  if (isScheduled(item, k) && !isDone(hs, item, k)) k = addDays(k, -1);
  for (let i = 0; i < 4000; i++) {
    if (isScheduled(item, k)) { if (isDone(hs, item, k)) n++; else break; }
    else if (isDone(hs, item, k)) n++;
    k = addDays(k, -1);
  }
  return n;
}

function bestStreak(hs, item) {
  const keys = Object.keys(hs.log || {}).filter(k => isDone(hs, item, k)).sort();
  if (!keys.length) return 0;
  let k = keys[0], best = 0, run = 0;
  const end = today();
  for (let i = 0; i < 5000 && k <= end; i++) {
    if (isScheduled(item, k)) { if (isDone(hs, item, k)) { run++; best = Math.max(best, run); } else run = 0; }
    else if (isDone(hs, item, k)) { run++; best = Math.max(best, run); }
    k = addDays(k, 1);
  }
  return best;
}

/** Процент выполнения за N последних дней (только запланированные дни, не раньше создания). */
function percent(hs, item, days) {
  let sched = 0, done = 0, k = today();
  const start = startKey(item);
  for (let i = 0; i < days; i++, k = addDays(k, -1)) {
    if (k < start) break;
    const d = isDone(hs, item, k);
    if (isScheduled(item, k)) { sched++; if (d) done++; }
    else if (d) { sched++; done++; }
  }
  return sched ? Math.round(done / sched * 100) : null;
}

/** Для главного экрана. */
export function habitStats(state) {
  const hs = slice(state);
  const t = today();
  const active = (hs.items || []).filter(i => !i.archived);
  const todays = active.filter(i => isScheduled(i, t));
  const doneToday = todays.filter(i => isDone(hs, i, t)).length;
  let best = 0;
  for (const i of active) best = Math.max(best, bestStreak(hs, i));
  return { doneToday, totalToday: todays.length, bestStreak: best };
}

// ---------- стили ----------
const CSS = `
.hb-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hb-sum{color:var(--muted,#94a3b8);font-size:.9rem;margin:2px 0 10px}
.hb-item{display:flex;flex-direction:column;gap:8px;padding:12px}
.hb-main{display:flex;align-items:center;gap:12px}
.hb-check{flex:none;width:48px;height:48px;border-radius:50%;border:2px solid currentColor;background:transparent;color:inherit;font-size:1.4rem;line-height:1;cursor:pointer;display:grid;place-items:center;opacity:.9}
.hb-check[aria-pressed=true]{background:#22c55e;border-color:#22c55e;color:#fff;opacity:1}
.hb-check[disabled]{opacity:.35;cursor:default}
.hb-title{flex:1;min-width:0}
.hb-name{font-weight:600;overflow-wrap:anywhere}
.hb-sub{font-size:.8rem;opacity:.7;overflow-wrap:anywhere}
.hb-stats{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.82rem;opacity:.85}
.hb-actions{display:flex;flex-wrap:wrap;gap:8px}
.hb-actions .btn{padding:6px 10px;min-height:36px}
.hb-form{display:flex;flex-direction:column;gap:10px}
.hb-form label{font-size:.85rem;opacity:.8}
.hb-chips{display:flex;flex-wrap:wrap;gap:6px}
.hb-chips .chip{cursor:pointer;min-height:36px}
.hb-chips .chip.on{background:#6366f1;color:#fff;border-color:#6366f1}
.hb-tip{font-size:.82rem;padding:8px 10px;border-radius:10px;background:rgba(99,102,241,.14)}
.hb-heat{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:320px}
.hb-heat .hd{font-size:.7rem;text-align:center;opacity:.6}
.hb-cell{aspect-ratio:1;border-radius:6px;background:rgba(148,163,184,.18)}
.hb-cell.l1{background:rgba(34,197,94,.35)}
.hb-cell.l2{background:rgba(34,197,94,.6)}
.hb-cell.l3{background:rgba(34,197,94,.85)}
.hb-cell.l4{background:#16a34a}
.hb-cell.fut{background:transparent;border:1px dashed rgba(148,163,184,.3)}
.hb-cell.now{outline:2px solid #6366f1}
.hb-cell.off{opacity:.45}
.hb-empty{text-align:center;padding:20px 12px}
`;
function ensureCss() {
  if (document.getElementById('habits-css')) return;
  const s = document.createElement('style');
  s.id = 'habits-css';
  s.textContent = CSS;
  document.head.append(s);
}

// ---------- вью ----------
export function render(root, ctx) {
  ensureCss();
  const { store, gamify } = ctx;
  const ui = { editing: null, showArchived: false, heatId: 'all' }; // editing: null | 'new' | id

  const hsOf = () => slice(store.get());

  function toggle(item, key, xp) {
    const was = isDone(hsOf(), item, key);
    let award = false;
    store.update(s => {
      const hs = s.habits;
      hs.log = hs.log || {};
      hs.awarded = hs.awarded || {};
      const arr = hs.log[key] || (hs.log[key] = []);
      const i = arr.indexOf(item.id);
      if (i >= 0) { arr.splice(i, 1); if (!arr.length) delete hs.log[key]; }
      else {
        arr.push(item.id);
        const ak = key + '|' + item.id;
        if (!hs.awarded[ak]) { hs.awarded[ak] = 1; award = true; } // XP один раз на (день, привычка)
      }
    });
    if (award) { gamify.awardXP(xp, 'Привычка: ' + item.name); toast('+' + xp + ' XP'); }
    else if (!was) toast('Отмечено (XP за этот день уже был)');
    draw();
  }

  function saveForm(data, existing) {
    store.update(s => {
      const hs = s.habits;
      if (existing) {
        const it = hs.items.find(x => x.id === existing.id);
        if (it) Object.assign(it, data);
      } else hs.items.push({ id: uid(), createdAt: Date.now(), archived: false, ...data });
    });
    ui.editing = null;
    draw();
  }

  function form(existing) {
    const st = {
      icon: existing ? existing.icon : ICONS[0],
      days: new Set(existing ? existing.days : ALL_DAYS),
    };
    const name = h('input', { class: 'input', type: 'text', maxlength: 60, placeholder: 'Например: 2 минуты зарядки', value: existing ? existing.name : '' });
    const cue = h('input', { class: 'input', type: 'text', maxlength: 80, placeholder: 'после чистки зубов', value: existing ? (existing.cue || '') : '' });
    const iconInput = h('input', { class: 'input', type: 'text', maxlength: 4, 'aria-label': 'Свой эмодзи', placeholder: 'Свой', value: ICONS.includes(st.icon) ? '' : st.icon, style: 'width:80px' });
    const iconBox = h('div', { class: 'hb-chips' });
    const dayBox = h('div', { class: 'hb-chips' });
    const err = h('div', { class: 'hb-sub', style: 'color:#ef4444' });

    function paint() {
      iconBox.replaceChildren(...ICONS.map(ic => h('button', {
        type: 'button', class: 'chip' + (st.icon === ic ? ' on' : ''), 'aria-pressed': st.icon === ic,
        onclick: () => { st.icon = ic; iconInput.value = ''; paint(); },
      }, ic)));
      dayBox.replaceChildren(...DAY_ORDER.map(d => h('button', {
        type: 'button', class: 'chip' + (st.days.has(d) ? ' on' : ''), 'aria-pressed': st.days.has(d),
        onclick: () => { st.days.has(d) ? st.days.delete(d) : st.days.add(d); paint(); },
      }, DAY_NAMES[d])));
    }
    iconInput.addEventListener('input', () => { const v = iconInput.value.trim(); if (v) { st.icon = v; paint(); } });
    paint();

    return h('div', { class: 'card hb-form' },
      h('h2', null, existing ? 'Редактировать привычку' : 'Новая привычка'),
      h('div', { class: 'hb-tip' }, '💡 Начните с малого: версия привычки на 2 минуты (одна страница, один подход, один стакан воды). Важна регулярность, а не объём.'),
      h('label', null, 'Название', name),
      h('label', null, 'Значок', iconBox, iconInput),
      h('label', null, 'Дни недели', dayBox),
      h('label', null, 'Привязка к существующей привычке: «После [это], я [новая привычка]»', cue),
      h('div', { class: 'hb-sub' }, 'Пример: после утреннего кофе я делаю 2 минуты зарядки. Чёткий триггер резко повышает шанс, что привычка приживётся.'),
      err,
      h('div', { class: 'hb-actions' },
        h('button', {
          type: 'button', class: 'btn btn-primary', onclick: () => {
            const n = name.value.trim();
            if (!n) { err.textContent = 'Введите название'; name.focus(); return; }
            if (!st.days.size) { err.textContent = 'Выберите хотя бы один день'; return; }
            saveForm({ name: n, icon: st.icon || ICONS[0], days: [...st.days].sort(), cue: cue.value.trim() }, existing);
          },
        }, 'Сохранить'),
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.editing = null; draw(); } }, 'Отмена')));
  }

  function setArchived(item, v) {
    store.update(s => { const it = s.habits.items.find(x => x.id === item.id); if (it) it.archived = v; });
    if (ui.editing === item.id) ui.editing = null;
    draw();
  }

  function itemCard(item) {
    const hs = hsOf();
    const t = today(), y = addDays(t, -1);
    const doneT = isDone(hs, item, t), doneY = isDone(hs, item, y);
    const schedT = isScheduled(item, t);
    const cur = currentStreak(hs, item), best = bestStreak(hs, item);
    const p7 = percent(hs, item, 7), p30 = percent(hs, item, 30);
    const fmt = p => p == null ? '—' : p + '%';
    const daysTxt = (item.days || ALL_DAYS).length === 7 ? 'каждый день' : DAY_ORDER.filter(d => item.days.includes(d)).map(d => DAY_NAMES[d]).join(', ');
    return h('div', { class: 'card hb-item' },
      h('div', { class: 'hb-main' },
        h('button', {
          type: 'button', class: 'hb-check', 'aria-pressed': doneT, 'aria-label': (doneT ? 'Снять отметку: ' : 'Выполнено сегодня: ') + item.name,
          onclick: () => toggle(item, t, XP_TODAY),
        }, doneT ? '✓' : item.icon),
        h('div', { class: 'hb-title' },
          h('div', { class: 'hb-name' }, item.icon + ' ' + item.name),
          h('div', { class: 'hb-sub' }, daysTxt + (schedT ? '' : ' · сегодня выходной')),
          item.cue ? h('div', { class: 'hb-sub' }, 'После ' + item.cue.replace(/^после\s+/i, '') + ' → ' + item.name) : null)),
      h('div', { class: 'hb-stats' },
        h('span', null, '🔥 Серия: ' + cur),
        h('span', null, '🏆 Лучшая: ' + best),
        h('span', null, '7 дн: ' + fmt(p7)),
        h('span', null, '30 дн: ' + fmt(p30))),
      h('div', { class: 'hb-actions' },
        h('button', {
          type: 'button', class: 'btn', 'aria-pressed': doneY, onclick: () => toggle(item, y, XP_YESTERDAY),
        }, doneY ? '✓ Вчера выполнено' : 'Отметить вчера'),
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.editing = item.id; draw(); } }, 'Изменить'),
        h('button', { type: 'button', class: 'btn', onclick: () => setArchived(item, true) }, 'В архив')));
  }

  function heatmap(items) {
    const hs = hsOf();
    const sel = ui.heatId === 'all' ? items : items.filter(i => i.id === ui.heatId);
    const t = today();
    // 5 недель, колонки Пн..Вс, последняя неделя содержит сегодня
    const off = (dow(t) + 6) % 7; // дней с понедельника
    const first = addDays(t, -(off + 28));
    const cells = [];
    for (const d of DAY_ORDER) cells.push(h('div', { class: 'hd' }, DAY_NAMES[d]));
    for (let i = 0; i < 35; i++) {
      const k = addDays(first, i);
      if (k > t) { cells.push(h('div', { class: 'hb-cell fut', title: k })); continue; }
      let sched = 0, done = 0;
      for (const it of sel) {
        if (k < startKey(it)) continue;
        const d = isDone(hs, it, k);
        if (isScheduled(it, k) || d) { sched++; if (d) done++; }
      }
      const r = sched ? done / sched : 0;
      const lvl = !sched || !done ? '' : r >= 1 ? ' l4' : r >= .67 ? ' l3' : r >= .34 ? ' l2' : ' l1';
      cells.push(h('div', { class: 'hb-cell' + lvl + (k === t ? ' now' : '') + (sched ? '' : ' off'), title: k + (sched ? `: ${done}/${sched}` : ': нет привычек') }));
    }
    return h('div', { class: 'card' },
      h('h2', null, 'Последние 5 недель'),
      items.length > 1 ? h('div', { class: 'hb-chips', style: 'margin-bottom:8px' },
        h('button', { type: 'button', class: 'chip' + (ui.heatId === 'all' ? ' on' : ''), onclick: () => { ui.heatId = 'all'; draw(); } }, 'Все'),
        items.map(i => h('button', { type: 'button', class: 'chip' + (ui.heatId === i.id ? ' on' : ''), onclick: () => { ui.heatId = i.id; draw(); } }, i.icon + ' ' + i.name))) : null,
      h('div', { class: 'hb-heat' }, cells));
  }

  function draw() {
    const hs = hsOf();
    const all = hs.items || [];
    const active = all.filter(i => !i.archived);
    const archived = all.filter(i => i.archived);
    if (ui.heatId !== 'all' && !active.some(i => i.id === ui.heatId)) ui.heatId = 'all';
    const stats = habitStats(store.get());
    const editingItem = ui.editing && ui.editing !== 'new' ? all.find(i => i.id === ui.editing) : null;

    const nodes = [
      h('div', { class: 'hb-head' },
        h('h1', null, 'Привычки'),
        ui.editing ? null : h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { ui.editing = 'new'; draw(); } }, '+ Добавить')),
      h('div', { class: 'hb-sum' }, stats.totalToday
        ? `Сегодня: ${stats.doneToday} из ${stats.totalToday} · лучшая серия: ${stats.bestStreak}`
        : 'На сегодня привычек не запланировано'),
    ];
    if (ui.editing === 'new') nodes.push(form(null));
    else if (editingItem) nodes.push(form(editingItem));

    if (!active.length && ui.editing !== 'new') {
      nodes.push(h('div', { class: 'card hb-empty' },
        h('p', null, 'Пока нет привычек. Начните с одной маленькой: на 2 минуты в день.'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { ui.editing = 'new'; draw(); } }, 'Создать первую')));
    } else {
      nodes.push(h('div', { class: 'list' }, active.map(itemCard)));
    }
    if (active.length) nodes.push(heatmap(active));

    if (archived.length) {
      nodes.push(h('button', { type: 'button', class: 'btn', onclick: () => { ui.showArchived = !ui.showArchived; draw(); } },
        (ui.showArchived ? 'Скрыть архив' : 'Архив') + ' (' + archived.length + ')'));
      if (ui.showArchived) nodes.push(h('div', { class: 'list' }, archived.map(it =>
        h('div', { class: 'card row' },
          h('span', { class: 'hb-name', style: 'flex:1' }, it.icon + ' ' + it.name),
          h('button', { type: 'button', class: 'btn', onclick: () => setArchived(it, false) }, 'Вернуть')))));
    }
    root.replaceChildren(...nodes);
  }

  draw();
}
