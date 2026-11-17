// Раздел «Здоровье». Владелец среза: state.health = {log:{date:{sleep,water,weight,mood}}, goals:{water,sleep}, height?}
// Не медицинский инструмент: только учёт привычек и справочные цифры.
import { store } from '../store.js';
import { h, today, addDays, dateKey } from '../util.js';

const SVG = 'http://www.w3.org/2000/svg';
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_NAMES = ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
const RANGES = {
  sleep: [0, 24], weight: [20, 300], water: [0, 30], height: [100, 250],
  goalWater: [1, 30], goalSleep: [1, 24],
};

const CSS = `
.hl-days{display:flex;gap:6px;overflow-x:auto;padding:4px 0 8px;scrollbar-width:thin}
.hl-days .chip{flex:0 0 auto;min-width:54px;text-align:center;line-height:1.25;cursor:pointer}
.hl-days .chip.on{background:var(--primary,#1d4ed8);color:var(--primary-ink,#fff);border-color:transparent}
.hl-days .chip small{display:block;opacity:.75;font-size:11px}
.hl-days .chip .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.6;margin-left:3px}
.hl-grid{display:grid;gap:12px}
.hl-line{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.hl-line label{font-weight:600}
.hl-stepper{display:flex;align-items:center;gap:10px}
.hl-stepper .btn{min-width:44px;min-height:44px;font-size:22px;line-height:1}
.hl-big{font-size:26px;font-weight:700;min-width:70px;text-align:center}
.hl-glasses{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.hl-glass{width:14px;height:20px;border-radius:2px 2px 5px 5px;border:1.5px solid var(--primary,#4aa3e8);background:transparent}
.hl-glass.on{background:var(--primary,#4aa3e8)}
.hl-num{width:110px;text-align:right}
.hl-moods{display:flex;gap:6px}
.hl-moods button{font-size:26px;min-width:46px;min-height:46px;border-radius:12px;border:2px solid transparent;background:transparent;cursor:pointer;opacity:.55}
.hl-moods button.on{opacity:1;border-color:var(--accent,#4f7cff)}
.hl-err{color:#d33;font-size:13px;min-height:1em}
.hl-note{font-size:12.5px;opacity:.75;line-height:1.4}
.hl-seg{display:flex;gap:6px}
.hl-chart{width:100%;height:auto;display:block}
.hl-chart text{fill:currentColor;font-size:10px;opacity:.65}
.hl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.hl-stat{padding:8px;border-radius:10px;background:rgba(127,127,127,.12);text-align:center}
.hl-stat b{display:block;font-size:18px}
.hl-stat span{font-size:12px;opacity:.75}
.hl-goal{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hl-goal .input{width:80px}
`;

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function shortLabel(k) { const d = parseKey(k); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; }
function fmt(n, d = 1) { return Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',') : '—'; }
function hours(n) {
  if (!Number.isFinite(n)) return '—';
  const m = Math.round(n * 60);
  return `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, '0')} мин`;
}

/** Строгий разбор числа: пустая строка -> null (очистка), мусор -> undefined. */
function parseNum(str) {
  const s = String(str).trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function ensure(s) {
  if (!s.health || typeof s.health !== 'object') s.health = {};
  if (!s.health.log || typeof s.health.log !== 'object') s.health.log = {};
  if (!s.health.goals || typeof s.health.goals !== 'object') s.health.goals = {};
  const g = s.health.goals;
  if (!(g.water > 0)) g.water = 8;
  if (!(g.sleep > 0)) g.sleep = 8;
  return s.health;
}
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Для главного экрана: значения за сегодня. */
export function healthStats(state) {
  const hl = (state && state.health) || {};
  const e = (hl.log && hl.log[today()]) || {};
  const g = hl.goals || {};
  return {
    water: num(e.water) ?? 0,
    waterGoal: g.water > 0 ? g.water : 8,
    sleep: num(e.sleep),
    mood: num(e.mood),
  };
}

/** Скользящее среднее по весу за окно в `win` дней (по датам, пропуски допустимы). */
function weightMA(log, keys, win = 7) {
  return keys.map(k => {
    const vals = [];
    for (let i = 0; i < win; i++) {
      const v = num((log[addDays(k, -i)] || {}).weight);
      if (v != null) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

function el(tag, attrs, ...kids) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const c of kids) if (c) e.append(c);
  return e;
}
function txt(x, y, s, anchor = 'middle') {
  const t = el('text', { x, y, 'text-anchor': anchor });
  t.textContent = s;
  return t;
}

/**
 * Универсальный график. series: [{vals:[number|null], kind:'bar'|'line', color, dots}], keys: даты.
 */
function chart({ keys, series, min, max, goal, label, fmtY = v => fmt(v, 1) }) {
  const W = 320, H = 150, L = 30, R = 8, T = 10, B = 22;
  const iw = W - L - R, ih = H - T - B, n = keys.length;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hl-chart', role: 'img', 'aria-label': label });
  const X = i => L + (n === 1 ? iw / 2 : (iw * (i + 0.5)) / n);
  const Y = v => T + ih - ((v - min) / (max - min)) * ih;
  for (let i = 0; i <= 2; i++) {
    const v = min + ((max - min) * i) / 2, y = Y(v);
    svg.append(el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': '.15' }), txt(L - 4, y + 3, fmtY(v), 'end'));
  }
  if (goal != null && goal >= min && goal <= max) {
    svg.append(el('line', { x1: L, x2: W - R, y1: Y(goal), y2: Y(goal), stroke: '#2eae6b', 'stroke-dasharray': '4 3', 'stroke-width': '1.5' }));
  }
  const step = Math.max(1, Math.ceil(n / 6));
  keys.forEach((k, i) => { if (i % step === 0 || i === n - 1) svg.append(txt(X(i), H - 6, shortLabel(k))); });
  for (const s of series) {
    if (s.kind === 'bar') {
      const bw = Math.max(2, Math.min(18, (iw / n) * 0.65));
      s.vals.forEach((v, i) => {
        if (v == null) return;
        const y = Y(Math.min(max, Math.max(min, v)));
        svg.append(el('rect', { x: X(i) - bw / 2, y, width: bw, height: Math.max(1, T + ih - y), rx: 2, fill: s.color }));
      });
    } else {
      let d = '', pen = false;
      s.vals.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; pen = true;
      });
      if (d) svg.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-opacity': s.opacity || 1 }));
      if (s.dots) s.vals.forEach((v, i) => { if (v != null) svg.append(el('circle', { cx: X(i), cy: Y(v), r: 2.5, fill: s.color })); });
    }
  }
  return svg;
}

function avg(arr) {
  const v = arr.filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function render(root, ctx) {
  const { gamify, util } = ctx;
  const T = util && util.toast ? util.toast : () => {};
  let sel = today();
  let range = 7;
  const errs = {};

  const getEntry = k => ((store.get().health || {}).log || {})[k] || {};

  function setField(field, value) {
    const k = sel;
    let firstToday = false;
    store.update(s => {
      const hl = ensure(s);
      const e = hl.log[k] || (hl.log[k] = {});
      if (value == null) delete e[field]; else e[field] = value;
      const has = ['sleep', 'water', 'weight', 'mood'].some(f => e[f] != null);
      if (!has) { delete hl.log[k]; return; }
      if (k === today() && !e.xp) { e.xp = true; firstToday = true; }
    });
    if (firstToday) gamify.awardXP(5, 'Здоровье: запись за день');
    redraw();
  }

  function numInput(field, [lo, hi], unit, current, ph) {
    const inp = h('input', {
      class: 'input hl-num', type: 'text', inputmode: 'decimal', placeholder: ph,
      value: current != null ? String(current).replace('.', ',') : '', 'aria-label': unit,
    });
    const commit = () => {
      const n = parseNum(inp.value);
      if (n === undefined || (n != null && (n < lo || n > hi))) {
        errs[field] = `Введите число от ${lo} до ${hi}`;
        redraw(); return;
      }
      delete errs[field];
      if (n === (current ?? null)) { redraw(); return; }
      setField(field, n == null ? null : Math.round(n * 10) / 10);
    };
    inp.addEventListener('change', commit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    return inp;
  }

  function dayStrip(log) {
    const chips = [];
    for (let i = 13; i >= 0; i--) {
      const k = addDays(today(), -i), d = parseKey(k);
      const filled = log[k] && Object.keys(log[k]).some(f => f !== 'xp');
      chips.push(h('button', {
        class: 'chip' + (k === sel ? ' on' : ''), type: 'button', 'aria-pressed': k === sel ? 'true' : 'false',
        onclick: () => { sel = k; redraw(); },
      }, h('small', null, i === 0 ? 'Сегодня' : WD[d.getDay()]), String(d.getDate()), filled ? h('span', { class: 'dot' }) : null));
    }
    const box = h('div', { class: 'hl-days' }, chips);
    setTimeout(() => { const on = box.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
    return box;
  }

  function inputCard(hl) {
    const e = getEntry(sel), g = hl.goals;
    const water = num(e.water) ?? 0;
    const title = sel === today() ? 'Сегодня' : `${shortLabel(sel)} (${WD[parseKey(sel).getDay()]})`;
    const glasses = [];
    for (let i = 0; i < Math.max(g.water, water); i++) glasses.push(h('span', { class: 'hl-glass' + (i < water ? ' on' : '') }));
    const err = f => h('div', { class: 'hl-err', role: 'alert' }, errs[f] || '');
    return h('div', { class: 'card hl-grid' },
      h('h2', null, title),
      h('div', null,
        h('div', { class: 'hl-line' }, h('label', null, '💧 Вода, стаканов'),
          h('div', { class: 'hl-stepper' },
            h('button', { class: 'btn', type: 'button', 'aria-label': 'Минус стакан', disabled: water <= 0 ? true : null, onclick: () => setField('water', water - 1 || (e.water != null ? 0 : null)) }, '−'),
            h('span', { class: 'hl-big' }, `${water}/${g.water}`),
            h('button', { class: 'btn btn-primary', type: 'button', 'aria-label': 'Плюс стакан', disabled: water >= RANGES.water[1] ? true : null, onclick: () => setField('water', water + 1) }, '+'))),
        h('div', { class: 'hl-glasses' }, glasses)),
      h('div', null, h('div', { class: 'hl-line' }, h('label', null, '😴 Сон, часов'), numInput('sleep', RANGES.sleep, 'часов сна', e.sleep, 'напр. 7,5')),
        e.sleep != null ? h('div', { class: 'hl-note' }, hours(e.sleep)) : null, err('sleep')),
      h('div', null, h('div', { class: 'hl-line' }, h('label', null, '⚖️ Вес, кг'), numInput('weight', RANGES.weight, 'вес в кг', e.weight, 'напр. 72,4')), err('weight')),
      h('div', { class: 'hl-line' }, h('label', null, 'Настроение'),
        h('div', { class: 'hl-moods', role: 'group', 'aria-label': 'Настроение' }, MOODS.map((m, i) => h('button', {
          type: 'button', class: i + 1 === e.mood ? 'on' : '', title: MOOD_NAMES[i], 'aria-label': MOOD_NAMES[i], 'aria-pressed': i + 1 === e.mood ? 'true' : 'false',
          onclick: () => setField('mood', i + 1 === e.mood ? null : i + 1),
        }, m)))));
  }

  function chartsCard(hl) {
    const log = hl.log, keys = [];
    for (let i = range - 1; i >= 0; i--) keys.push(addDays(today(), -i));
    const val = f => keys.map(k => num((log[k] || {})[f]));
    const sleep = val('sleep'), mood = val('mood'), weight = val('weight');
    const ma = weightMA(log, keys);
    const wv = [...weight, ...ma].filter(x => x != null);
    const empty = a => !a.some(x => x != null);
    const noData = h('div', { class: 'hl-note' }, 'Пока нет данных за этот период.');

    const sMax = Math.max(10, Math.ceil(Math.max(0, ...sleep.filter(x => x != null), hl.goals.sleep)));
    const wMin = wv.length ? Math.floor(Math.min(...wv) - 1) : 0, wMax = wv.length ? Math.ceil(Math.max(...wv) + 1) : 1;

    const trend = (() => {
      const cur = ma[ma.length - 1];
      let prevIdx = ma.length - 1 - 7; // MA семь дней назад (или самая ранняя доступная)
      let prev = prevIdx >= 0 ? ma[prevIdx] : null;
      if (prev == null) prev = ma.find(x => x != null);
      if (cur == null || prev == null || cur === prev && ma.filter(x => x != null).length < 2) return null;
      return { cur, delta: cur - prev };
    })();
    const trendText = !trend ? 'Недостаточно данных для тренда (нужны записи веса в разные дни).'
      : Math.abs(trend.delta) < 0.3 ? `Тренд (среднее за 7 дней): ${fmt(trend.cur)} кг, без заметных изменений.`
        : `Тренд (среднее за 7 дней): ${fmt(trend.cur)} кг, ${trend.delta > 0 ? '+' : '−'}${fmt(Math.abs(trend.delta))} кг к неделе ранее.`;

    return h('div', { class: 'card hl-grid' },
      h('div', { class: 'hl-line' }, h('h2', null, 'Графики'),
        h('div', { class: 'hl-seg' }, [7, 30].map(r => h('button', {
          type: 'button', class: 'chip' + (r === range ? ' on' : ''), 'aria-pressed': r === range ? 'true' : 'false',
          onclick: () => { range = r; redraw(); },
        }, `${r} дн.`)))),
      h('div', null, h('h3', null, 'Сон, часы'), empty(sleep) ? noData
        : chart({ keys, series: [{ vals: sleep, kind: 'bar', color: 'var(--primary)' }], min: 0, max: sMax, goal: hl.goals.sleep, label: 'График сна', fmtY: v => fmt(v, 0) }),
        empty(sleep) ? null : h('div', { class: 'hl-note' }, `Зелёная линия: цель ${fmt(hl.goals.sleep)} ч.`)),
      h('div', null, h('h3', null, 'Вес, кг'), empty(weight) ? noData
        : chart({ keys, series: [{ vals: weight, kind: 'line', color: 'var(--muted)', width: 1, dots: true, opacity: .8 }, { vals: ma, kind: 'line', color: 'var(--highlight)', width: 2.5 }], min: wMin, max: wMax, label: 'График веса' }),
        empty(weight) ? null : h('div', { class: 'hl-note' }, 'Серые точки: ежедневные замеры (они шумят из-за воды, еды и времени суток). Оранжевая линия: скользящее среднее за 7 дней.'),
        h('div', null, trendText)),
      h('div', null, h('h3', null, 'Настроение'), empty(mood) ? noData
        : chart({ keys, series: [{ vals: mood, kind: 'bar', color: 'var(--highlight)' }], min: 0, max: 5, label: 'График настроения', fmtY: v => fmt(v, 0) })));
  }

  function statsCard(hl) {
    const log = hl.log, keys = [];
    for (let i = range - 1; i >= 0; i--) keys.push(addDays(today(), -i));
    const f = k => keys.map(d => num((log[d] || {})[k]));
    const w = avg(f('water')), s = avg(f('sleep')), m = avg(f('mood')), wt = avg(f('weight'));
    const days = keys.filter(d => log[d] && Object.keys(log[d]).some(x => x !== 'xp')).length;
    const st = (v, l) => h('div', { class: 'hl-stat' }, h('b', null, v), h('span', null, l));
    return h('div', { class: 'card hl-grid' },
      h('h2', null, `Средние за ${range} дн.`),
      h('div', { class: 'hl-stats' },
        st(w != null ? fmt(w) : '—', 'стаканов воды'), st(s != null ? fmt(s) + ' ч' : '—', 'сон'),
        st(m != null ? fmt(m) : '—', 'настроение (1-5)'), st(wt != null ? fmt(wt) + ' кг' : '—', 'вес'),
        st(`${days}/${range}`, 'дней с записью')),
      h('div', { class: 'hl-note' }, 'Средние считаются только по дням, где есть запись.'));
  }

  function goalsCard(hl) {
    const mk = (field, label, [lo, hi], unit) => {
      const inp = h('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(hl.goals[field]).replace('.', ','), 'aria-label': label });
      const err = h('div', { class: 'hl-err', role: 'alert' }, errs['g' + field] || '');
      inp.addEventListener('change', () => {
        const n = parseNum(inp.value);
        if (n == null || n === undefined || n < lo || n > hi) { errs['g' + field] = `Введите число от ${lo} до ${hi}`; redraw(); return; }
        delete errs['g' + field];
        store.update(s => { ensure(s).goals[field] = field === 'water' ? Math.round(n) : Math.round(n * 10) / 10; });
        T('Цель сохранена'); redraw();
      });
      return h('div', null, h('div', { class: 'hl-goal' }, h('label', null, label), inp, h('span', null, unit)), err);
    };
    return h('div', { class: 'card hl-grid' },
      h('h2', null, 'Цели'),
      mk('water', '💧 Вода', RANGES.goalWater, 'стаканов в день'),
      mk('sleep', '😴 Сон', RANGES.goalSleep, 'часов в сутки'),
      h('div', { class: 'hl-note' }, 'Потребность в воде и сне индивидуальна. Часто в качестве общего ориентира для взрослых называют около 7-9 часов сна, но это не норма для каждого. Приложение не заменяет врача: при проблемах со сном или самочувствием обратитесь к специалисту.'));
  }

  function bmiCard(hl) {
    const hgt = num(hl.height);
    const lw = (() => { for (let i = 0; i < 60; i++) { const v = num((hl.log[addDays(today(), -i)] || {}).weight); if (v != null) return v; } return null; })();
    const inp = h('input', { class: 'input', type: 'text', inputmode: 'decimal', value: hgt != null ? String(hgt).replace('.', ',') : '', placeholder: 'напр. 175', 'aria-label': 'Рост в сантиметрах' });
    const err = h('div', { class: 'hl-err', role: 'alert' }, errs.height || '');
    inp.addEventListener('change', () => {
      const n = parseNum(inp.value);
      if (n === undefined || (n != null && (n < RANGES.height[0] || n > RANGES.height[1]))) { errs.height = `Введите рост от ${RANGES.height[0]} до ${RANGES.height[1]} см`; redraw(); return; }
      delete errs.height;
      store.update(s => { const x = ensure(s); if (n == null) delete x.height; else x.height = Math.round(n); });
      redraw();
    });
    const bmi = hgt != null && lw != null ? lw / ((hgt / 100) ** 2) : null;
    return h('div', { class: 'card hl-grid' },
      h('h2', null, 'ИМТ (справочно)'),
      h('div', { class: 'hl-goal' }, h('label', null, 'Рост'), inp, h('span', null, 'см')), err,
      h('div', { class: 'hl-line' }, h('span', null, bmi != null ? `По последнему весу (${fmt(lw)} кг):` : 'Укажите рост и хотя бы один замер веса.'), bmi != null ? h('b', { class: 'hl-big' }, fmt(bmi)) : null),
      h('div', { class: 'hl-note' }, 'ИМТ — грубая оценка по росту и весу. Он не учитывает мышечную массу, телосложение, возраст, пол и распределение жира, поэтому для спортсменов и во многих других случаях может вводить в заблуждение. Это не диагноз и не оценка здоровья; вопросы о весе лучше обсуждать с врачом.'));
  }

  function redraw() {
    const y = window.scrollY;
    const hl = (() => { const s = store.get(); if (!s.health || !s.health.log || !s.health.goals || !(s.health.goals.water > 0) || !(s.health.goals.sleep > 0)) store.update(ensure); return store.get().health; })();
    root.replaceChildren(
      h('style', { id: 'health-css' }, CSS),
      h('h1', null, 'Здоровье'),
      dayStrip(hl.log), inputCard(hl), chartsCard(hl), statsCard(hl), goalsCard(hl), bmiCard(hl),
      h('p', { class: 'hl-note' }, 'Раздел носит информационный характер и не заменяет консультацию врача.'));
    window.scrollTo(0, y);
  }

  redraw();
}
