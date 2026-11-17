// Экран «Сегодня». Свои стили в #home-css.
import { h, today, addDays, dateKey } from '../util.js';
import { ACHIEVEMENTS, earnedIds, checkAchievements } from '../gamify.js';

const QUOTES = [
  'Дисциплина — это обещание, которое ты выполняешь, когда никто не смотрит.',
  'Маленький шаг сегодня весит больше, чем великий план на завтра.',
  'Мотивация приходит и уходит, привычка остаётся.',
  'Не жди настроения: начни, и настроение догонит.',
  'Каждый повтор — голос за того, кем ты становишься.',
  'Сложно только первые пять минут.',
  'Побеждает не самый сильный, а тот, кто вернулся после пропуска.',
  'Один пропуск — случайность, два — начало привычки. Вернись сегодня.',
  'Результат — это сумма скучных дней, прожитых честно.',
  'Делай меньше, но каждый день.',
  'Твоё будущее «я» уже благодарит за сегодняшнее усилие.',
  'Порядок в мелочах рождает порядок в жизни.',
  'Не сравнивай свой день первый с чужим днём тысячным.',
  'Лучшее время начать было вчера, второе лучшее — сейчас.',
  'Усталость — повод снизить темп, а не остановиться.',
  'Сила воли растёт, как мышца: от нагрузки и отдыха.',
  'Планируй вечером, действуй утром.',
  'Сделанное на тройку лучше идеального, оставшегося в мыслях.',
  'Сначала дело, потом отдых, но отдых обязателен.',
  'Выбирай трудное сейчас, чтобы лёгкое пришло потом.',
  'Растёшь не тогда, когда комфортно, а когда чуть тяжелее вчерашнего.',
  'Скажи «нет» лишнему, чтобы сказать «да» главному.',
  'Ритм важнее рывка.',
  'Следи за действиями, а не за настроением.',
  'Прогресс не всегда виден, но он всегда копится.',
  'Если не получается идеально, получается хотя бы начатое.',
  'Береги сон и воду: тело — основа дисциплины.',
  'Победа над ленью начинается с одного движения.',
  'Знание без повторения испаряется, повторяй каждый день.',
  'Ты не обязан быть лучшим, только лучше вчерашнего себя.',
];

const PKEY = 'transformation.priorities.v1';
function loadPri() {
  try {
    const p = JSON.parse(localStorage.getItem(PKEY));
    if (p && p.date === today() && Array.isArray(p.items)) return p;
  } catch (e) { /* нет данных */ }
  return { date: today(), items: [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }] };
}
function savePri(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) { /* ок */ } }

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const c of kids) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function greeting(name) {
  const hr = new Date().getHours();
  const g = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  return name ? `${g}, ${name}!` : g + '!';
}

const MODULES = [
  { file: './habits.js', fn: 'habitStats', tiles: (r, n) => [
    n(r.doneToday) && n(r.totalToday) ? { icon: '✅', val: `${r.doneToday}/${r.totalToday}`, label: 'привычек сегодня', pct: r.totalToday ? r.doneToday / r.totalToday : 0 } : null,
    n(r.bestStreak) ? { icon: '🔥', val: r.bestStreak, label: 'лучшая серия, дн.' } : null].filter(Boolean) },
  { file: './workout.js', fn: 'workoutStats', tiles: (r, n) => [
    n(r.thisWeek) ? { icon: '💪', val: r.thisWeek, label: 'тренировок за неделю' } : null].filter(Boolean) },
  { file: './health.js', fn: 'healthStats', tiles: (r, n) => [
    n(r.water) ? { icon: '💧', val: n(r.waterGoal) ? `${r.water}/${r.waterGoal}` : r.water, label: 'стаканов воды', pct: n(r.waterGoal) && r.waterGoal ? r.water / r.waterGoal : null } : null,
    n(r.sleep) ? { icon: '😴', val: `${r.sleep} ч`, label: 'сон сегодня' } : null].filter(Boolean) },
  { file: './learn.js', fn: 'learnStats', tiles: (r, n) => [
    n(r.due) ? { icon: '🧠', val: r.due, label: 'карточек к повторению' } : null].filter(Boolean) },
  { file: './languages.js', fn: 'langStats', tiles: (r, n) => [
    n(r.done) && n(r.total) ? { icon: '🌍', val: `${r.done}/${r.total}`, label: 'уроков пройдено', pct: r.total ? r.done / r.total : 0 } : null].filter(Boolean) },
];

function weekChart(events) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const sums = Object.fromEntries(days.map(d => [d, 0]));
  for (const e of events || []) { const k = dateKey(new Date(e.t)); if (k in sums) sums[k] += e.xp || 0; }
  const vals = days.map(d => sums[d]);
  const max = Math.max(10, ...vals);
  const W = 280, H = 110, bw = 28, gap = (W - bw * 7) / 6;
  const names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const s = svg('svg', { viewBox: `0 0 ${W} ${H + 24}`, class: 'hm-chart', role: 'img', 'aria-label': 'XP за 7 дней' });
  days.forEach((d, i) => {
    const x = i * (bw + gap), bh = Math.round((vals[i] / max) * (H - 16)), y = H - bh;
    s.append(svg('rect', { x, y, width: bw, height: Math.max(bh, 2), rx: 5, class: i === 6 ? 'hm-bar today' : 'hm-bar' }));
    s.append(svg('text', { x: x + bw / 2, y: Math.max(y - 4, 10), 'text-anchor': 'middle', class: 'hm-val' }, vals[i] || ''));
    const [yy, mm, dd] = d.split('-').map(Number);
    s.append(svg('text', { x: x + bw / 2, y: H + 15, 'text-anchor': 'middle', class: 'hm-day' }, names[new Date(yy, mm - 1, dd).getDay()]));
  });
  return { el: s, total: vals.reduce((a, b) => a + b, 0) };
}

export function render(root, ctx) {
  const { store, gamify } = ctx;
  let dead = false;
  if (!document.getElementById('home-css')) {
    const st = h('style', { id: 'home-css' });
    st.textContent = `
.hm-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:16px;
 background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 28%,var(--surface)),var(--surface) 72%)}
.hm-hello{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;line-height:1.2}
.hm-sub{color:var(--muted);font-size:.9rem}
.hm-badge{display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-weight:700;font-size:.8rem}
.hm-ring{flex:none;width:96px;height:96px}
.hm-ring .trk{stroke:var(--surface-2)}
.hm-ring .val{stroke:var(--highlight)}
.hm-ring .lv{fill:var(--text);font-size:26px;font-weight:800}
.hm-ring .xp{fill:var(--muted);font-size:9.5px}
.hm-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.hm-head h2{margin:0}
.hm-count{color:var(--muted);font-weight:700;font-variant-numeric:tabular-nums}
.hm-pri{display:flex;align-items:center;gap:12px;margin:0}
.hm-pri input[type=text]{flex:1;min-width:0;margin:0;background:transparent;border:0;border-bottom:1px solid var(--input-border);border-radius:0;padding-left:2px}
.hm-pri.done input[type=text]{text-decoration:line-through;opacity:.6}
.hm-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hm-tile{margin:0;padding:12px 14px;display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;min-width:0}
.hm-tile .ti{font-size:1.3rem;line-height:1;grid-row:1/3;align-self:center}
.hm-tile b{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}
.hm-tile .l{color:var(--muted);font-size:.78rem;line-height:1.25}
.hm-tile .mini{grid-column:1/3;height:5px;border-radius:6px;background:var(--surface-2);overflow:hidden;margin-top:8px}
.hm-tile .mini i{display:block;height:100%;background:var(--highlight);border-radius:6px}
.hm-quote{margin:0;font-style:italic;line-height:1.5;padding-left:14px;border-left:3px solid var(--highlight)}
.hm-chart{width:100%;height:auto;display:block}
.hm-bar{fill:var(--primary);opacity:.55}.hm-bar.today{fill:var(--highlight);opacity:1}
.hm-val,.hm-day{font-size:10px;fill:currentColor;opacity:.8}
.hm-lvl{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;margin-bottom:8px}
.hm-ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.hm-a{display:flex;gap:10px;align-items:center;padding:12px;margin:0}
.hm-a.locked{opacity:.4;filter:grayscale(1)}
.hm-a .ai{font-size:1.5rem}.hm-a b{display:block;font-size:.85rem}.hm-a small{color:var(--muted);font-size:.72rem}
`;
    document.head.append(st);
  }

  const heroBox = h('div', { class: 'card hm-hero' });
  const priBox = h('div', { class: 'card' });
  const modBox = h('div', { class: 'hm-tiles' });
  const chartBox = h('div', { class: 'card' });
  const achBox = h('div', { class: 'hm-ach' });
  const achTitle = h('h2', null, 'Достижения');

  function ring(pct, level, xpText) {
    const R = 38, C = 2 * Math.PI * R;
    return svg('svg', { class: 'hm-ring', viewBox: '0 0 96 96', role: 'img', 'aria-label': `Уровень ${level}, ${xpText}` },
      svg('circle', { class: 'trk', cx: 48, cy: 48, r: R, fill: 'none', 'stroke-width': 8 }),
      svg('circle', { class: 'val', cx: 48, cy: 48, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round',
        'stroke-dasharray': C.toFixed(1), 'stroke-dashoffset': (C * (1 - pct / 100)).toFixed(1), transform: 'rotate(-90 48 48)' }),
      svg('text', { class: 'lv', x: 48, y: 52, 'text-anchor': 'middle' }, level),
      svg('text', { class: 'xp', x: 48, y: 66, 'text-anchor': 'middle' }, xpText));
  }

  function drawHero() {
    const s = store.get(), li = gamify.levelInfo();
    const pct = Math.min(100, Math.round((li.xpInLevel / li.xpForNext) * 100));
    heroBox.replaceChildren(
      h('div', null,
        h('h1', { class: 'hm-hello' }, greeting(s.profile.name)),
        h('div', { class: 'hm-sub' }, new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })),
        h('span', { class: 'hm-badge' }, li.title || `Уровень ${li.level}`)),
      ring(pct, li.level, `${li.xpInLevel}/${li.xpForNext} XP`));
  }

  function drawPri() {
    const p = loadPri();
    const count = h('span', { class: 'hm-count' }, `${p.items.filter(x => x.done).length}/${p.items.length}`);
    priBox.replaceChildren(h('div', { class: 'hm-head' }, h('h2', null, 'Приоритеты дня'), count),
      ...p.items.map((it, i) => {
        const row = h('div', { class: 'hm-pri' + (it.done ? ' done' : '') });
        const cb = h('input', { type: 'checkbox', 'aria-label': 'Выполнено ' + (i + 1) });
        cb.checked = !!it.done;
        const inp = h('input', { type: 'text', class: 'input', placeholder: `Приоритет ${i + 1}`, maxlength: 120 });
        inp.value = it.text;
        inp.addEventListener('input', () => { it.text = inp.value; savePri(p); });
        cb.addEventListener('change', () => {
          if (cb.checked && !it.text.trim()) { cb.checked = false; inp.focus(); return; }
          const was = it.done; it.done = cb.checked; savePri(p);
          row.classList.toggle('done', it.done);
          count.textContent = `${p.items.filter(x => x.done).length}/${p.items.length}`;
          if (it.done && !was && !it.rewarded) { it.rewarded = true; savePri(p); gamify.awardXP(5, 'Приоритет дня'); drawHero(); drawChart(); }
        });
        row.append(cb, inp);
        return row;
      }));
  }

  function drawMods() {
    modBox.replaceChildren();
    const num = v => typeof v === 'number' && isFinite(v);
    Promise.all(MODULES.map(m => import(m.file).then(mod => {
      if (typeof mod[m.fn] !== 'function') return [];
      const r = mod[m.fn](store.get());
      return r && typeof r === 'object' ? m.tiles(r, num) : [];
    }).catch(() => []))).then(groups => {
      if (dead) return;
      for (const t of groups.flat()) {
        modBox.append(h('div', { class: 'card hm-tile' },
          h('span', { class: 'ti', 'aria-hidden': 'true' }, t.icon), h('b', null, String(t.val)), h('span', { class: 'l' }, t.label),
          t.pct != null ? h('div', { class: 'mini', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(t.pct * 100) },
            h('i', { style: `width:${Math.min(100, Math.round(t.pct * 100))}%` })) : null));
      }
    });
  }

  function drawChart() {
    const c = weekChart(store.get().gamify.events);
    chartBox.replaceChildren(h('div', { class: 'hm-lvl', style: 'margin-bottom:8px' }, h('span', null, 'XP за 7 дней'), h('span', null, `${c.total} XP`)), c.el);
  }

  function drawAch() {
    const have = earnedIds();
    achTitle.textContent = `Достижения · ${have.size}/${ACHIEVEMENTS.length}`;
    const sorted = [...ACHIEVEMENTS].sort((a, b) => (have.has(b.id) ? 1 : 0) - (have.has(a.id) ? 1 : 0));
    achBox.replaceChildren(...sorted.map(a => h('div', { class: 'card hm-a' + (have.has(a.id) ? '' : ' locked'), title: a.desc },
      h('span', { class: 'ai' }, a.icon), h('div', null, h('b', null, a.title), h('small', null, a.desc)))));
  }

  const q = QUOTES[Math.floor(new Date().setHours(0, 0, 0, 0) / 864e5) % QUOTES.length];
  root.append(heroBox, h('h2', null, 'Сегодня'), modBox, h('div', { style: 'height:12px' }), priBox,
    h('div', { class: 'card' }, h('p', { class: 'hm-quote' }, '«' + q + '»')),
    h('h2', null, 'Неделя'), chartBox, achTitle, achBox);

  checkAchievements();
  drawHero(); drawPri(); drawMods(); drawChart(); drawAch();
  return () => { dead = true; };
}
