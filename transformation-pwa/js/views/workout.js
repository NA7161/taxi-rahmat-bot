// Раздел «Спорт»: программы, запуск тренировки, таймер отдыха, история, рекорды, график объёма.
import { EXERCISES, EQUIP, byId } from '../data/exercises.js';
import { h, toast, today, addDays, dateKey, uid, clamp } from '../util.js';

const XP_WORKOUT = 30;

// Три программы для новичка: full-body, 3 дня в неделю.
// Прогрессия по повторениям: каждую «неделю» (3 завершённые тренировки программы) цель растёт на step до max.
const PROGRAMS = [
  {
    id: 'start', name: 'Старт', note: 'Самые простые варианты. Для тех, кто начинает с нуля или возвращается после перерыва.',
    days: [
      { name: 'День A', items: [
        { ex: 'chair-stand', sets: 3, reps: 8, step: 1, max: 15 }, { ex: 'pushup-knee', sets: 3, reps: 5, step: 1, max: 12 },
        { ex: 'glute-bridge', sets: 3, reps: 10, step: 1, max: 20 }, { ex: 'plank', sets: 3, reps: 15, step: 5, max: 45 }] },
      { name: 'День B', items: [
        { ex: 'squat', sets: 3, reps: 8, step: 1, max: 15 }, { ex: 'superman', sets: 3, reps: 8, step: 1, max: 15 },
        { ex: 'calf-raise', sets: 3, reps: 12, step: 2, max: 25 }, { ex: 'crunch', sets: 3, reps: 8, step: 1, max: 20 }] },
      { name: 'День C', items: [
        { ex: 'sumo-squat', sets: 3, reps: 8, step: 1, max: 15 }, { ex: 'pushup-knee', sets: 3, reps: 6, step: 1, max: 12 },
        { ex: 'bird-dog', sets: 3, reps: 8, step: 1, max: 14 }, { ex: 'leg-raise', sets: 3, reps: 6, step: 1, max: 15 }] },
    ],
  },
  {
    id: 'base', name: 'Основа', note: 'Классические базовые движения. Следующий шаг после «Старта».',
    days: [
      { name: 'День A', items: [
        { ex: 'squat', sets: 3, reps: 10, step: 1, max: 20 }, { ex: 'pushup', sets: 3, reps: 5, step: 1, max: 15 },
        { ex: 'glute-bridge', sets: 3, reps: 12, step: 2, max: 25 }, { ex: 'plank', sets: 3, reps: 20, step: 5, max: 60 }] },
      { name: 'День B', items: [
        { ex: 'lunge-back', sets: 3, reps: 6, step: 1, max: 14 }, { ex: 'pushup-knee', sets: 3, reps: 10, step: 1, max: 20 },
        { ex: 'superman', sets: 3, reps: 10, step: 1, max: 18 }, { ex: 'bicycle', sets: 3, reps: 12, step: 2, max: 30 }] },
      { name: 'День C', items: [
        { ex: 'sumo-squat', sets: 3, reps: 10, step: 1, max: 20 }, { ex: 'dips-chair', sets: 3, reps: 5, step: 1, max: 12 },
        { ex: 'bird-dog', sets: 3, reps: 10, step: 1, max: 16 }, { ex: 'side-plank', sets: 2, reps: 15, step: 5, max: 40 }] },
    ],
  },
  {
    id: 'cardio', name: 'Дом: с кардио', note: 'Full-body с динамичными упражнениями. Отдыхай столько, сколько нужно, и не спеши.',
    days: [
      { name: 'День A', items: [
        { ex: 'jumping-jack', sets: 3, reps: 20, step: 2, max: 40 }, { ex: 'squat', sets: 3, reps: 10, step: 1, max: 20 },
        { ex: 'pushup-knee', sets: 3, reps: 8, step: 1, max: 16 }, { ex: 'mountain-climber', sets: 3, reps: 10, step: 2, max: 30 }] },
      { name: 'День B', items: [
        { ex: 'lunge-back', sets: 3, reps: 8, step: 1, max: 14 }, { ex: 'glute-bridge', sets: 3, reps: 12, step: 2, max: 25 },
        { ex: 'crunch', sets: 3, reps: 10, step: 2, max: 25 }, { ex: 'jumping-jack', sets: 3, reps: 20, step: 2, max: 40 }] },
      { name: 'День C', items: [
        { ex: 'burpee', sets: 3, reps: 3, step: 1, max: 10 }, { ex: 'squat', sets: 3, reps: 12, step: 1, max: 22 },
        { ex: 'pushup', sets: 3, reps: 4, step: 1, max: 12 }, { ex: 'plank', sets: 3, reps: 20, step: 5, max: 60 }] },
    ],
  },
];

// ---------- чистая логика ----------
function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // понедельник = 0
  return addDays(key, -dow);
}
const logOf = s => (s && s.workouts && Array.isArray(s.workouts.log)) ? s.workouts.log : [];

/** Для главного экрана: тренировок на этой неделе и серия недель подряд (с понедельника). */
export function workoutStats(state) {
  const weeks = new Set(logOf(state).map(w => weekStart(w.date)));
  const cur = weekStart(today());
  let thisWeek = 0;
  for (const w of logOf(state)) if (weekStart(w.date) === cur) thisWeek++;
  let k = cur, streakWeeks = 0;
  if (!weeks.has(k)) k = addDays(k, -7);
  while (weeks.has(k)) { streakWeeks++; k = addDays(k, -7); }
  return { thisWeek, streakWeeks };
}

const setLoad = s => (Number(s.reps) || 0) * (Number(s.kg) > 0 ? Number(s.kg) : 1);
const workoutLoad = w => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + setLoad(s), 0), 0);
const setCount = w => w.exercises.reduce((a, e) => a + e.sets.length, 0);

function records(log) {
  const rec = {};
  for (const w of log) for (const e of w.exercises) {
    const r = rec[e.name] || (rec[e.name] = { name: e.name, reps: 0, kg: 0, kgReps: 0, count: 0, date: w.date });
    for (const s of e.sets) {
      const reps = Number(s.reps) || 0, kg = Number(s.kg) || 0;
      r.count++;
      if (reps > r.reps) r.reps = reps;
      if (kg > r.kg || (kg === r.kg && reps > r.kgReps)) { r.kg = kg; r.kgReps = reps; }
    }
  }
  return rec;
}

function weeklyVolume(log) {
  const cur = weekStart(today());
  const out = [];
  for (let i = 3; i >= 0; i--) {
    const start = addDays(cur, -7 * i);
    const end = addDays(start, 6);
    let v = 0;
    for (const w of log) if (w.date >= start && w.date <= end) v += workoutLoad(w);
    out.push({ start, value: Math.round(v) });
  }
  return out;
}

function programProgress(log, p) {
  const n = log.filter(w => w.program === p.id).length;
  return { done: n, week: Math.floor(n / 3) + 1, dayIdx: n % 3 };
}
const targetReps = (it, week) => Math.min(it.max, it.reps + (week - 1) * it.step);
const fmtDate = k => { const [y, m, d] = k.split('-'); return `${d}.${m}.${y}`; };
const fmtTime = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const unit = ex => (ex && ex.timed ? 'сек' : 'повт.');

// ---------- стили ----------
const CSS = `
.wk-warn{font-size:.85rem;opacity:.85;border-left:4px solid #f59e0b}
.wk-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.wk-tabs .chip{cursor:pointer;min-height:40px}
.wk-tabs .chip.on,.wk-pick .chip.on{background:var(--accent,#4f8cff);color:#fff}
.wk-stats{display:flex;gap:10px;margin:12px 0}
.wk-stats .card{flex:1;text-align:center}
.wk-big{font-size:1.8rem;font-weight:700;line-height:1.1}
.wk-small{font-size:.85rem;opacity:.75}
.wk-ex{margin:2px 0;font-size:.92rem}
.wk-pick{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.wk-pick .chip{cursor:pointer;min-height:36px}
.wk-run{display:flex;flex-direction:column;gap:14px;min-height:calc(100dvh - 110px)}
.wk-run .wk-name{font-size:1.7rem;font-weight:700;line-height:1.15;margin:0}
.wk-timer{font-size:5rem;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;margin:10px 0}
.wk-timer.done{color:#16a34a}
.wk-stepper{display:flex;align-items:center;gap:10px}
.wk-stepper .lbl{width:64px;font-size:.9rem;opacity:.75}
.wk-stepper button{width:64px;height:64px;font-size:2rem;flex:none}
.wk-stepper input{flex:1;min-width:0;height:64px;font-size:2rem;text-align:center}
.wk-act{margin-top:auto;display:flex;flex-direction:column;gap:10px;position:sticky;bottom:calc(70px + env(safe-area-inset-bottom,0px))}
.wk-act .btn{min-height:68px;font-size:1.3rem;width:100%}
.wk-act .row-2{display:flex;gap:10px}
.wk-act .row-2 .btn{min-height:52px;font-size:1rem;flex:1}
.wk-bars text{font-size:10px;fill:currentColor;opacity:.75}
.wk-bar{fill:var(--accent,#4f8cff)}
.wk-set{display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:10px;background:rgba(128,128,128,.18);font-size:.85rem}
`;
function ensureCss() {
  if (!document.getElementById('workout-css')) document.head.append(h('style', { id: 'workout-css' }, CSS));
}

// ---------- график (SVG) ----------
function chart(data) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a, txt) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (txt != null) n.textContent = txt; return n; };
  const W = 300, H = 150, pad = 24, bw = 44;
  const max = Math.max(1, ...data.map(d => d.value));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', class: 'wk-bars', 'aria-label': 'Объём тренировок за 4 недели' });
  const step = (W - 2 * pad) / data.length;
  data.forEach((d, i) => {
    const bh = d.value ? Math.max(3, (d.value / max) * (H - 2 * pad - 6)) : 0;
    const x = pad + i * step + (step - bw) / 2;
    svg.append(el('rect', { class: 'wk-bar', x, y: H - pad - bh, width: bw, height: bh, rx: 4 }));
    svg.append(el('text', { x: x + bw / 2, y: H - pad - bh - 4, 'text-anchor': 'middle' }, String(d.value)));
    const [, m, dd] = d.start.split('-');
    svg.append(el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, `${dd}.${m}`));
  });
  svg.append(el('line', { x1: pad - 6, x2: W - pad + 6, y1: H - pad, y2: H - pad, stroke: 'currentColor', 'stroke-opacity': '.3' }));
  return svg;
}

// ---------- вью ----------
export function render(root, ctx) {
  const { store, gamify } = ctx;
  ensureCss();
  let tab = 'programs';
  let timerId = null;
  let draft = null; // {key, reps, kg}
  let pick = new Set();
  let equipFilter = 'all';
  let confirmReset = false;

  const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
  const S = () => store.get();
  const active = () => S().workouts.active || null;
  const lastKg = name => {
    const log = logOf(S());
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i].exercises.find(x => x.name === name);
      if (e && e.sets.length) return e.sets[e.sets.length - 1].kg || 0;
    }
    return 0;
  };

  function startWorkout(name, items, program, dayIdx) {
    store.update(s => {
      s.workouts.active = {
        id: uid(), name, program: program || null, day: dayIdx ?? null, startedAt: Date.now(), restSec: 60, restUntil: null,
        items: items.map(it => ({ ex: it.ex, name: byId[it.ex].name, sets: it.sets, target: it.reps, done: [], skipped: false })),
      };
    });
    draft = null;
    draw();
  }

  function finish() {
    const a = active();
    if (!a) return;
    const exercises = a.items.filter(it => it.done.length).map(it => ({ name: it.name, sets: it.done.map(x => ({ reps: x.reps, kg: x.kg })) }));
    if (!exercises.length) { cancel(); return; }
    const before = records(logOf(S()));
    const entry = { id: a.id, date: today(), name: a.name, minutes: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)), exercises };
    if (a.program) { entry.program = a.program; entry.day = a.day; }
    let added = false;
    store.update(s => {
      if (!s.workouts.log.some(w => w.id === a.id)) { s.workouts.log.push(entry); added = true; }
      s.workouts.active = null;
    });
    stopTimer();
    if (added) {
      gamify.awardXP(XP_WORKOUT, 'Тренировка: ' + a.name); // один раз: запись с этим id уже есть в логе
      const newRec = exercises.filter(e => {
        const b = before[e.name];
        if (!b) return false;
        return e.sets.some(x => x.reps > b.reps || (Number(x.kg) > b.kg));
      }).map(e => e.name);
      toast(newRec.length ? `Тренировка сохранена. Новый рекорд: ${newRec[0]}` : `Тренировка сохранена. +${XP_WORKOUT} XP`, 3200);
    }
    tab = 'history';
    draw();
  }

  function cancel() {
    stopTimer();
    store.update(s => { s.workouts.active = null; });
    draft = null;
    draw();
  }

  // --- экран выполнения ---
  function currentIdx(a) { return a.items.findIndex(it => !it.skipped && it.done.length < it.sets); }

  function stepper(label, get, set, stepBy, min, max) {
    const inp = h('input', { class: 'input', type: 'number', inputmode: 'decimal', value: String(get()), 'aria-label': label });
    inp.addEventListener('input', () => set(clamp(parseFloat(inp.value) || 0, min, max)));
    const bump = d => () => { const v = Math.round((clamp(get() + d, min, max)) * 100) / 100; set(v); inp.value = String(v); };
    return h('div', { class: 'wk-stepper' }, h('span', { class: 'lbl' }, label),
      h('button', { class: 'btn', type: 'button', 'aria-label': label + ' меньше', onclick: bump(-stepBy) }, '−'), inp,
      h('button', { class: 'btn', type: 'button', 'aria-label': label + ' больше', onclick: bump(stepBy) }, '+'));
  }

  function header(a, idx) {
    const done = a.items.filter(it => it.skipped || it.done.length >= it.sets).length;
    return h('div', null,
      h('div', { class: 'wk-small' }, `${a.name} · упражнение ${Math.min(done + 1, a.items.length)} из ${a.items.length}`));
  }

  function drawRun(a) {
    stopTimer();
    const idx = currentIdx(a);
    root.replaceChildren();
    if (idx < 0) return drawSummary(a);
    const it = a.items[idx], ex = byId[it.ex];
    const resting = a.restUntil && a.restUntil > Date.now();
    if (resting) return drawRest(a, it, ex);

    const key = a.id + ':' + idx + ':' + it.done.length;
    if (!draft || draft.key !== key) {
      const prev = it.done[it.done.length - 1];
      draft = { key, reps: prev ? prev.reps : it.target, kg: prev ? prev.kg : lastKg(it.name) };
    }
    const kgNeeded = ex.equip !== 'none';
    root.append(h('div', { class: 'wk-run' },
      header(a, idx),
      h('h1', { class: 'wk-name' }, it.name),
      h('div', { class: 'card' }, h('div', null, ex.tip),
        h('div', { class: 'wk-small' }, `Подход ${it.done.length + 1} из ${it.sets} · цель: ${it.target} ${unit(ex)}`)),
      stepper(ex.timed ? 'Секунды' : 'Повторы', () => draft.reps, v => { draft.reps = v; }, 1, 0, 999),
      kgNeeded || draft.kg > 0 ? stepper('Вес, кг', () => draft.kg, v => { draft.kg = v; }, 2.5, 0, 500) : null,
      it.done.length ? h('div', null, it.done.map(x => h('span', { class: 'wk-set' }, x.kg ? `${x.reps}×${x.kg}` : String(x.reps)))) : null,
      h('div', { class: 'wk-act' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => logSet(idx) }, 'Подход выполнен'),
        h('div', { class: 'row-2' },
          h('button', { class: 'btn', type: 'button', onclick: () => { store.update(s => { s.workouts.active.items[idx].skipped = true; }); draft = null; draw(); } }, 'Пропустить'),
          h('button', { class: 'btn', type: 'button', onclick: () => { store.update(s => { s.workouts.active.items[idx].sets++; }); draw(); } }, '+ подход'),
          h('button', { class: 'btn', type: 'button', onclick: finish }, 'Завершить')))));
  }

  function logSet(idx) {
    const reps = Math.round(draft.reps), kg = draft.kg;
    if (!(reps > 0)) { toast('Укажи число повторов'); return; }
    store.update(s => {
      const ac = s.workouts.active;
      ac.items[idx].done.push({ reps, kg });
      ac.restUntil = Date.now() + ac.restSec * 1000;
    });
    draft = null;
    // если всё выполнено, отдых не нужен
    const a = active();
    if (currentIdx(a) < 0) store.update(s => { s.workouts.active.restUntil = null; });
    draw();
  }

  function drawRest(a, it, ex) {
    const left = () => Math.max(0, Math.ceil((a.restUntil - Date.now()) / 1000));
    const timerEl = h('div', { class: 'wk-timer', role: 'timer', 'aria-live': 'off' }, fmtTime(left()));
    const nextIdx = currentIdx(a), ni = a.items[nextIdx];
    root.append(h('div', { class: 'wk-run' },
      header(a, nextIdx),
      h('h1', { class: 'wk-name' }, 'Отдых'),
      timerEl,
      h('div', { class: 'card' }, `Дальше: ${ni.name}, подход ${ni.done.length + 1} из ${ni.sets}`),
      h('div', { class: 'wk-pick' }, [45, 60, 90, 120].map(sec =>
        h('button', { class: 'chip' + (a.restSec === sec ? ' on' : ''), type: 'button', onclick: () => { store.update(s => { s.workouts.active.restSec = sec; }); draw(); } }, sec + ' с'))),
      h('div', { class: 'wk-act' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { store.update(s => { s.workouts.active.restUntil = null; }); draw(); } }, 'Начать подход'),
        h('div', { class: 'row-2' },
          h('button', { class: 'btn', type: 'button', onclick: () => { store.update(s => { s.workouts.active.restUntil += 15000; }); draw(); } }, '+15 с'),
          h('button', { class: 'btn', type: 'button', onclick: finish }, 'Завершить')))));
    timerId = setInterval(() => {
      const l = left();
      timerEl.textContent = fmtTime(l);
      if (l <= 0) {
        stopTimer();
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* нет вибрации */ }
        toast('Отдых закончен');
        store.update(s => { s.workouts.active.restUntil = null; });
        draw();
      }
    }, 250);
  }

  function drawSummary(a) {
    const total = a.items.reduce((n, it) => n + it.done.length, 0);
    root.append(h('div', { class: 'wk-run' },
      h('h1', { class: 'wk-name' }, 'Всё выполнено'),
      h('div', { class: 'card' }, `Подходов: ${total}. Время: ${Math.max(1, Math.round((Date.now() - a.startedAt) / 60000))} мин.`),
      h('div', { class: 'wk-act' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: finish }, `Сохранить (+${XP_WORKOUT} XP)`),
        h('div', { class: 'row-2' }, h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Не сохранять')))));
  }

  // --- главный экран ---
  function disclaimer() {
    return h('div', { class: 'card wk-warn' }, 'Приложение не заменяет врача. Если есть проблемы со здоровьем, травмы или сомнения, проконсультируйся с врачом перед тренировками. При боли, головокружении или одышке остановись.');
  }

  function programsTab() {
    const log = logOf(S());
    const a = active();
    const out = [];
    if (a) {
      out.push(h('div', { class: 'card' }, h('strong', null, 'Тренировка идёт: ' + a.name),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: draw }, 'Продолжить'),
          h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Отменить'))));
    }
    out.push(h('h2', null, 'Программы'), h('div', { class: 'wk-small' }, 'Full-body, 3 дня в неделю, без оборудования. Через каждые 3 тренировки цель по повторам растёт.'));
    out.push(h('div', { class: 'list' }, PROGRAMS.map(p => {
      const pr = programProgress(log, p);
      const day = p.days[pr.dayIdx];
      return h('div', { class: 'card' },
        h('strong', null, p.name), h('div', { class: 'wk-small' }, p.note),
        h('div', { class: 'wk-small' }, `Неделя ${pr.week}, следующая: ${day.name}`),
        day.items.map(it => h('div', { class: 'wk-ex' }, `${byId[it.ex].name}: ${it.sets} × ${targetReps(it, pr.week)} ${unit(byId[it.ex])}`)),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: a ? true : null,
          onclick: () => startWorkout(`${p.name}, ${day.name}`, day.items.map(it => ({ ex: it.ex, sets: it.sets, reps: targetReps(it, pr.week) })), p.id, pr.dayIdx) }, 'Начать')));
    })));
    // своя тренировка
    const list = EXERCISES.filter(e => equipFilter === 'all' || e.equip === equipFilter);
    out.push(h('h2', null, 'Своя тренировка'),
      h('div', { class: 'wk-pick' }, [['all', 'Все'], ...Object.entries(EQUIP)].map(([k, v]) =>
        h('button', { class: 'chip' + (equipFilter === k ? ' on' : ''), type: 'button', onclick: () => { equipFilter = k; draw(); } }, v))),
      h('div', { class: 'wk-pick' }, list.map(e =>
        h('button', { class: 'chip' + (pick.has(e.id) ? ' on' : ''), type: 'button', 'aria-pressed': pick.has(e.id) ? 'true' : 'false',
          title: e.group, onclick: () => { pick.has(e.id) ? pick.delete(e.id) : pick.add(e.id); draw(); } }, e.name))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: (!pick.size || a) ? true : null,
        onclick: () => { const items = [...pick].map(id => ({ ex: id, sets: 3, reps: byId[id].timed ? 30 : 10 })); pick = new Set(); startWorkout('Своя тренировка', items); } },
      pick.size ? `Начать (${pick.size})` : 'Выбери упражнения')));
    return out;
  }

  function historyTab() {
    const log = logOf(S());
    const out = [h('h2', null, 'Объём за 4 недели'), h('div', { class: 'card' }, chart(weeklyVolume(log)),
      h('div', { class: 'wk-small' }, 'Объём = повторы × вес. Упражнения без веса считаются как повторы.'))];
    out.push(h('h2', null, 'История'));
    if (!log.length) { out.push(h('div', { class: 'card' }, 'Пока нет тренировок.')); return out; }
    out.push(h('div', { class: 'list' }, [...log].reverse().slice(0, 60).map(w =>
      h('div', { class: 'card' },
        h('strong', null, w.name), h('div', { class: 'wk-small' }, `${fmtDate(w.date)} · ${w.minutes} мин · подходов: ${setCount(w)} · объём: ${Math.round(workoutLoad(w))}`),
        w.exercises.map(e => h('div', { class: 'wk-ex' }, e.name + ': ', e.sets.map(s => h('span', { class: 'wk-set' }, s.kg ? `${s.reps}×${s.kg}` : String(s.reps))))),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { if (confirm('Удалить тренировку из истории?')) { store.update(s => { s.workouts.log = s.workouts.log.filter(x => x.id !== w.id); }); draw(); } } }, 'Удалить'))))));
    return out;
  }

  function recordsTab() {
    const rec = Object.values(records(logOf(S()))).sort((a, b) => b.count - a.count);
    if (!rec.length) return [h('h2', null, 'Личные рекорды'), h('div', { class: 'card' }, 'Рекорды появятся после первой тренировки.')];
    return [h('h2', null, 'Личные рекорды'), h('div', { class: 'list' }, rec.map(r => {
      const ex = EXERCISES.find(e => e.name === r.name);
      return h('div', { class: 'card' }, h('strong', null, r.name),
        h('div', { class: 'wk-small' }, `Максимум за подход: ${r.reps} ${unit(ex)}` + (r.kg > 0 ? ` · Максимальный вес: ${r.kg} кг × ${r.kgReps}` : '')));
    }))];
  }

  function drawMain() {
    const st = workoutStats(S());
    const tabs = [['programs', 'Программы'], ['history', 'История'], ['records', 'Рекорды']];
    root.append(h('h1', null, 'Спорт'), disclaimer(),
      h('div', { class: 'wk-stats' },
        h('div', { class: 'card' }, h('div', { class: 'wk-big' }, String(st.thisWeek)), h('div', { class: 'wk-small' }, 'на этой неделе')),
        h('div', { class: 'card' }, h('div', { class: 'wk-big' }, String(st.streakWeeks)), h('div', { class: 'wk-small' }, 'недель подряд'))),
      h('div', { class: 'wk-tabs', role: 'tablist' }, tabs.map(([k, v]) =>
        h('button', { class: 'chip' + (tab === k ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', onclick: () => { tab = k; draw(); } }, v))),
      tab === 'programs' ? programsTab() : tab === 'history' ? historyTab() : recordsTab());
  }

  function draw() {
    stopTimer();
    root.replaceChildren();
    const a = active();
    if (a && tab === 'run') return drawRun(a);
    if (a && a.startedAt && tab !== 'programs' && tab !== 'history' && tab !== 'records') return drawRun(a);
    drawMain();
  }

  // Вход: если тренировка уже идёт, сразу к ней (восстановление после перезагрузки).
  tab = active() ? 'run' : 'programs';
  const origDraw = draw;
  draw = function () { // eslint-disable-line no-func-assign
    if (active()) { if (tab !== 'programs' && tab !== 'history' && tab !== 'records') tab = 'run'; }
    else if (tab === 'run') tab = 'programs';
    origDraw();
  };
  draw();
  return stopTimer;
}
