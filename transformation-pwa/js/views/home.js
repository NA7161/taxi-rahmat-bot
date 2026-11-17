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
  { file: './habits.js', fn: 'habitStats', title: '✅ Привычки' },
  { file: './workout.js', fn: 'workoutStats', title: '💪 Спорт' },
  { file: './health.js', fn: 'healthStats', title: '❤️ Здоровье' },
  { file: './learn.js', fn: 'learnStats', title: '🧠 Знания' },
  { file: './languages.js', fn: 'langStats', title: '🌍 Языки' },
];

function statBody(r) {
  if (r == null) return null;
  if (typeof r === 'string' || typeof r === 'number') return h('div', { class: 'hm-line' }, String(r));
  if (typeof r !== 'object') return null;
  const parts = Object.entries(r).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v));
  if (!parts.length) return null;
  return h('div', { class: 'hm-stat' }, parts.slice(0, 6).map(([k, v]) =>
    h('div', { class: 'hm-kv' }, h('b', null, typeof v === 'boolean' ? (v ? 'да' : 'нет') : String(v)), h('span', null, k))));
}

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
.hm-hero{display:flex;flex-direction:column;gap:10px}
.hm-hello{font-size:1.4rem;font-weight:700;margin:0}
.hm-sub{opacity:.7;font-size:.9rem}
.hm-lvl{display:flex;justify-content:space-between;align-items:baseline;font-weight:600}
.hm-track{height:10px;border-radius:6px;background:rgba(128,128,128,.25);overflow:hidden}
.hm-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#6c8cff,#a855f7);transition:width .4s}
.hm-sec{margin:18px 0 8px;font-size:1.05rem}
.hm-pri{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.hm-pri input[type=text]{flex:1;min-width:0}
.hm-pri input[type=checkbox]{width:24px;height:24px;flex:none}
.hm-pri.done input[type=text]{text-decoration:line-through;opacity:.6}
.hm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.hm-mod h3{margin:0 0 6px;font-size:.95rem}
.hm-stat{display:flex;flex-wrap:wrap;gap:6px 14px}
.hm-kv{display:flex;flex-direction:column}.hm-kv b{font-size:1.1rem}.hm-kv span{font-size:.72rem;opacity:.65}
.hm-quote{font-style:italic;line-height:1.45}
.hm-chart{width:100%;height:auto;display:block}
.hm-bar{fill:#8892b0;opacity:.6}.hm-bar.today{fill:#6c8cff;opacity:1}
.hm-val,.hm-day{font-size:10px;fill:currentColor;opacity:.75}
.hm-ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.hm-a{display:flex;gap:8px;align-items:center;padding:8px}
.hm-a.locked{opacity:.4;filter:grayscale(1)}
.hm-a .ai{font-size:1.5rem}.hm-a b{display:block;font-size:.85rem}.hm-a small{opacity:.7;font-size:.72rem}
`;
    document.head.append(st);
  }

  const heroBox = h('div', { class: 'card hm-hero' });
  const priBox = h('div', { class: 'card' });
  const modBox = h('div', { class: 'hm-grid' });
  const chartBox = h('div', { class: 'card' });
  const achBox = h('div', { class: 'hm-ach' });
  const achTitle = h('h2', { class: 'hm-sec' }, 'Достижения');

  function drawHero() {
    const s = store.get(), li = gamify.levelInfo();
    const pct = Math.min(100, Math.round((li.xpInLevel / li.xpForNext) * 100));
    heroBox.replaceChildren(
      h('h1', { class: 'hm-hello' }, greeting(s.profile.name)),
      h('div', { class: 'hm-sub' }, new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })),
      h('div', { class: 'hm-lvl' }, h('span', null, `Уровень ${li.level}${li.title ? ' · ' + li.title : ''}`), h('span', null, `${li.xpInLevel} / ${li.xpForNext} XP`)),
      h('div', { class: 'hm-track', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { class: 'hm-fill', style: `width:${pct}%` })));
  }

  function drawPri() {
    const p = loadPri();
    priBox.replaceChildren(h('h2', { style: 'margin:0 0 10px;font-size:1.05rem' }, '🎯 Три приоритета дня'),
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
          if (it.done && !was && !it.rewarded) { it.rewarded = true; savePri(p); gamify.awardXP(5, 'Приоритет дня'); drawHero(); drawChart(); }
        });
        row.append(cb, inp);
        return row;
      }));
  }

  function drawMods() {
    modBox.replaceChildren();
    for (const m of MODULES) {
      import(m.file).then(mod => {
        if (dead || typeof mod[m.fn] !== 'function') return;
        const body = statBody(mod[m.fn](store.get()));
        if (!body) return;
        modBox.append(h('div', { class: 'card hm-mod' }, h('h3', null, m.title), body));
      }).catch(() => { /* модуль недоступен: блок скрыт */ });
    }
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
  root.append(heroBox, priBox,
    h('div', { class: 'card' }, h('div', { class: 'hm-sub' }, 'Мысль дня'), h('div', { class: 'hm-quote' }, '«' + q + '»')),
    h('h2', { class: 'hm-sec' }, 'Сводка'), modBox,
    h('h2', { class: 'hm-sec' }, 'Неделя'), chartBox, achTitle, achBox);

  checkAchievements();
  drawHero(); drawPri(); drawMods(); drawChart(); drawAch();
  return () => { dead = true; };
}
