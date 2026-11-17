// Персональный план трансформации: онбординг, колесо баланса, цели на 90 дней, недельный обзор.
// Владелец среза: store.plan = { wheel, goals, reviews }.
import { addDays, dateKey } from '../util.js';

const SPHERES = [
  { id: 'health', name: 'Здоровье', icon: '❤️' },
  { id: 'sport', name: 'Спорт', icon: '💪' },
  { id: 'knowledge', name: 'Знания', icon: '🧠' },
  { id: 'languages', name: 'Языки', icon: '🌍' },
  { id: 'discipline', name: 'Дисциплина', icon: '✅' },
  { id: 'finance', name: 'Финансы', icon: '💰' },
];
const SPHERE = Object.fromEntries(SPHERES.map(s => [s.id, s]));
const QUESTIONS = [
  'Что получилось на этой неделе и чем я горжусь?',
  'Что мешало и чему это меня научило?',
  'Какие 1-3 шага сделаю на следующей неделе?',
];
const NS = 'http://www.w3.org/2000/svg';

const CSS = `
.plan-wrap{display:flex;flex-direction:column;gap:12px}
.plan-radar{display:block;width:100%;max-width:340px;margin:0 auto}
.plan-radar text{font-size:11px;fill:currentColor}
.plan-grid{fill:none;stroke:currentColor;stroke-opacity:.18}
.plan-area{fill:var(--accent, #1f6b64);fill-opacity:.3;stroke:var(--accent, #1f6b64);stroke-width:2}
.plan-dot{fill:var(--accent, #1f6b64)}
.plan-bar{height:8px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden}
.plan-bar>i{display:block;height:100%;background:var(--accent, #1f6b64);border-radius:4px}
.plan-sph{display:grid;grid-template-columns:110px 1fr 24px;align-items:center;gap:8px;margin:6px 0}
.plan-sph input{width:100%}
.plan-chips{display:flex;flex-wrap:wrap;gap:6px}
.plan-chips .chip{cursor:pointer}
.plan-chips .chip.on{outline:2px solid var(--accent, #1f6b64)}
.plan-step{display:flex;align-items:center;gap:8px;padding:4px 0}
.plan-step span{flex:1}
.plan-done{text-decoration:line-through;opacity:.6}
.plan-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.plan-form{display:flex;flex-direction:column;gap:8px}
.plan-form .input{width:100%;box-sizing:border-box}
.plan-muted{opacity:.7;font-size:13px}
`;

function ensureCss() {
  if (document.getElementById('plan-css')) return;
  const st = document.createElement('style');
  st.id = 'plan-css';
  st.textContent = CSS;
  document.head.append(st);
}

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const c of kids) if (c != null) el.append(c);
  return el;
}

/** Радар-диаграмма колеса баланса. */
function radar(wheel) {
  const size = 300, c = size / 2, R = 100, n = SPHERES.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'plan-radar', role: 'img', 'aria-label': 'Колесо баланса' });
  for (let lvl = 2; lvl <= 10; lvl += 2) {
    root.append(svg('polygon', { class: 'plan-grid', points: SPHERES.map((_, i) => pt(i, (R * lvl) / 10).join(',')).join(' ') }));
  }
  SPHERES.forEach((s, i) => {
    const [x, y] = pt(i, R);
    root.append(svg('line', { class: 'plan-grid', x1: c, y1: c, x2: x, y2: y }));
    const [lx, ly] = pt(i, R + 22);
    const t = svg('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    t.textContent = s.name;
    root.append(t);
  });
  const val = s => Math.min(10, Math.max(0, Number(wheel[s.id]) || 0));
  root.append(svg('polygon', { class: 'plan-area', points: SPHERES.map((s, i) => pt(i, (R * val(s)) / 10).join(',')).join(' ') }));
  SPHERES.forEach((s, i) => {
    const [x, y] = pt(i, (R * val(s)) / 10);
    root.append(svg('circle', { class: 'plan-dot', cx: x, cy: y, r: 3.5 }));
  });
  return root;
}

function weekKey(d = new Date()) {
  const k = dateKey(d);
  const dow = (d.getDay() + 6) % 7; // понедельник = 0
  return addDays(k, -dow);
}

function goalProgress(g) {
  if (g.done) return 100;
  const st = g.steps || [];
  if (!st.length) return 0;
  return Math.round((st.filter(s => s.done).length / st.length) * 100);
}

export function render(root, ctx) {
  const { store, util, gamify, navigate } = ctx;
  const { h, uid, today, toast } = util;
  ensureCss();

  const ui = {
    step: 0,                 // шаг онбординга
    name: store.get().profile.name || '',
    wheel: {},               // черновик колеса при онбординге
    drafts: [{ title: '', sphere: 'discipline' }],
    editWheel: false,
    editing: null,           // id цели в режиме редактирования / 'new'
    reviewOpen: false,
  };
  SPHERES.forEach(s => { ui.wheel[s.id] = Number(store.get().plan.wheel[s.id]) || 5; });

  const dead = { v: false };
  const redraw = () => {
    if (dead.v) return;
    root.replaceChildren(store.get().profile.onboarded ? mainView() : onboarding());
  };

  // ---------- общие кусочки ----------
  function wheelSliders(wheel, onChange) {
    return h('div', null, SPHERES.map(s => {
      const out = h('b', null, String(wheel[s.id]));
      const inp = h('input', {
        type: 'range', min: 1, max: 10, step: 1, value: wheel[s.id], 'aria-label': s.name,
        oninput: e => { wheel[s.id] = Number(e.target.value); out.textContent = String(wheel[s.id]); onChange && onChange(); },
      });
      return h('div', { class: 'plan-sph' }, h('span', null, s.icon + ' ' + s.name), inp, out);
    }));
  }

  function sphereChips(current, onPick) {
    return h('div', { class: 'plan-chips' }, SPHERES.map(s =>
      h('button', {
        type: 'button', class: 'chip' + (current === s.id ? ' on' : ''),
        'aria-pressed': current === s.id ? 'true' : 'false',
        onclick: () => onPick(s.id),
      }, s.icon + ' ' + s.name)));
  }

  // ---------- онбординг ----------
  function onboarding() {
    const total = 3;
    const head = h('div', null,
      h('h1', null, 'Персональный план трансформации'),
      h('p', { class: 'plan-muted' }, `Шаг ${ui.step + 1} из ${total}`),
      h('div', { class: 'plan-bar' }, h('i', { style: `width:${((ui.step + 1) / total) * 100}%` })));

    let body;
    if (ui.step === 0) {
      const inp = h('input', { class: 'input', type: 'text', placeholder: 'Как вас зовут?', maxlength: 40, value: ui.name, autocomplete: 'given-name' });
      inp.addEventListener('input', () => { ui.name = inp.value; });
      body = h('div', { class: 'card plan-form' },
        h('h2', null, 'Давайте знакомиться'),
        h('p', null, 'Мы построим ваш план на 90 дней: оценим баланс жизни и поставим 1-3 главные цели.'),
        inp,
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: () => {
            if (!ui.name.trim()) { toast('Введите имя'); return; }
            ui.name = ui.name.trim(); ui.step = 1; redraw();
          },
        }, 'Далее'));
    } else if (ui.step === 1) {
      const holder = h('div', null, radar(ui.wheel));
      body = h('div', { class: 'card plan-form' },
        h('h2', null, 'Колесо баланса'),
        h('p', null, 'Оцените каждую сферу от 1 (плохо) до 10 (отлично). Будьте честны: это точка отсчёта.'),
        holder,
        wheelSliders(ui.wheel, () => holder.replaceChildren(radar(ui.wheel))),
        h('div', { class: 'plan-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { ui.step = 0; redraw(); } }, 'Назад'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { ui.step = 2; redraw(); } }, 'Далее')));
    } else {
      const lowest = SPHERES.slice().sort((a, b) => ui.wheel[a.id] - ui.wheel[b.id])[0];
      body = h('div', { class: 'card plan-form' },
        h('h2', null, 'Цели на 90 дней'),
        h('p', null, `Самая слабая сфера сейчас: ${lowest.icon} ${lowest.name}. Поставьте от 1 до 3 целей.`),
        ui.drafts.map((d, i) => {
          const inp = h('input', { class: 'input', type: 'text', maxlength: 120, placeholder: `Цель ${i + 1}, например: пробежать 5 км`, value: d.title });
          inp.addEventListener('input', () => { d.title = inp.value; });
          const chips = h('div');
          const drawChips = () => chips.replaceChildren(sphereChips(d.sphere, id => { d.sphere = id; drawChips(); }));
          drawChips();
          return h('div', { class: 'plan-form' }, inp, chips);
        }),
        ui.drafts.length < 3 ? h('button', {
          class: 'btn', type: 'button',
          onclick: () => { ui.drafts.push({ title: '', sphere: lowest.id }); redraw(); },
        }, '+ Ещё цель') : null,
        h('div', { class: 'plan-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { ui.step = 1; redraw(); } }, 'Назад'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: finishOnboarding }, 'Начать трансформацию')));
    }
    return h('div', { class: 'plan-wrap' }, head, body);
  }

  function finishOnboarding() {
    const goals = ui.drafts.filter(d => d.title.trim()).slice(0, 3);
    if (!goals.length) { toast('Добавьте хотя бы одну цель'); return; }
    const due = addDays(today(), 90);
    store.update(s => {
      s.profile.name = ui.name.trim();
      s.profile.onboarded = true;
      s.profile.createdAt = s.profile.createdAt || Date.now();
      s.plan.wheel = { ...ui.wheel };
      s.plan.goals = s.plan.goals.concat(goals.map(d => ({
        id: uid(), title: d.title.trim(), sphere: d.sphere, due, done: false, steps: [],
      })));
    });
    gamify.awardXP(20, 'План трансформации создан');
    navigate('home');
  }

  // ---------- обычный режим ----------
  function mainView() {
    const plan = store.get().plan;
    const wheel = plan.wheel;
    const goals = plan.goals;
    const parts = [h('h1', null, 'Мой план')];

    // колесо
    if (ui.editWheel) {
      const draft = {};
      SPHERES.forEach(s => { draft[s.id] = Number(wheel[s.id]) || 5; });
      const holder = h('div', null, radar(draft));
      parts.push(h('div', { class: 'card plan-form' },
        h('h2', null, 'Колесо баланса'),
        holder,
        wheelSliders(draft, () => holder.replaceChildren(radar(draft))),
        h('div', { class: 'plan-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { ui.editWheel = false; redraw(); } }, 'Отмена'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onclick: () => {
              store.update(s => { s.plan.wheel = { ...draft }; });
              ui.editWheel = false; toast('Колесо обновлено'); redraw();
            },
          }, 'Сохранить'))));
    } else {
      const avg = SPHERES.reduce((a, s) => a + (Number(wheel[s.id]) || 0), 0) / SPHERES.length;
      parts.push(h('div', { class: 'card' },
        h('h2', null, 'Колесо баланса'),
        radar(wheel),
        h('p', { class: 'plan-muted' }, `Средний балл: ${avg.toFixed(1)} из 10`),
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.editWheel = true; redraw(); } }, 'Переоценить')));
    }

    // цели
    parts.push(h('h2', null, 'Цели на 90 дней'));
    if (!goals.length && ui.editing !== 'new') parts.push(h('div', { class: 'card plan-muted' }, 'Пока нет целей. Добавьте первую.'));
    goals.forEach(g => parts.push(ui.editing === g.id ? goalForm(g) : goalCard(g)));
    parts.push(ui.editing === 'new'
      ? goalForm(null)
      : h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { ui.editing = 'new'; redraw(); } }, '+ Новая цель'));

    // обзор недели
    parts.push(reviewCard(plan));
    return h('div', { class: 'plan-wrap' }, parts);
  }

  function goalCard(g) {
    const pct = goalProgress(g);
    const steps = g.steps || [];
    const stepInp = h('input', { class: 'input', type: 'text', maxlength: 120, placeholder: 'Новый шаг' });
    const addStep = () => {
      const t = stepInp.value.trim();
      if (!t) return;
      store.update(s => { const x = s.plan.goals.find(q => q.id === g.id); if (x) x.steps.push({ id: uid(), text: t, done: false }); });
      redraw();
    };
    stepInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
    const sp = SPHERE[g.sphere];
    return h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('div', { style: 'flex:1;min-width:0' },
          h('b', { class: g.done ? 'plan-done' : null }, g.title),
          h('div', { class: 'plan-muted' }, `${sp ? sp.icon + ' ' + sp.name : ''}${g.due ? ' · до ' + g.due : ''}`)),
        h('b', null, pct + '%')),
      h('div', { class: 'plan-bar', style: 'margin:8px 0' }, h('i', { style: `width:${pct}%` })),
      steps.map(st => h('label', { class: 'plan-step' },
        h('input', { type: 'checkbox', checked: st.done ? true : null, onchange: e => toggleStep(g.id, st.id, e.target.checked) }),
        h('span', { class: st.done ? 'plan-done' : null }, st.text),
        h('button', {
          class: 'btn', type: 'button', 'aria-label': 'Удалить шаг',
          onclick: ev => {
            ev.preventDefault();
            store.update(s => { const x = s.plan.goals.find(q => q.id === g.id); if (x) x.steps = x.steps.filter(q => q.id !== st.id); });
            redraw();
          },
        }, '✕'))),
      h('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, stepInp, h('button', { class: 'btn', type: 'button', onclick: addStep }, 'Добавить')),
      h('div', { class: 'plan-actions' },
        h('button', { class: 'btn' + (g.done ? '' : ' btn-primary'), type: 'button', onclick: () => toggleGoal(g.id) }, g.done ? 'Вернуть в работу' : 'Цель достигнута'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.editing = g.id; redraw(); } }, 'Изменить')));
  }

  function toggleStep(gid, sid, val) {
    let award = false;
    store.update(s => {
      const g = s.plan.goals.find(q => q.id === gid);
      const st = g && g.steps.find(q => q.id === sid);
      if (!st) return;
      st.done = val;
      if (val && !st.awarded) { st.awarded = true; award = true; }
    });
    if (award) gamify.awardXP(5, 'Шаг цели выполнен');
    redraw();
  }

  function toggleGoal(gid) {
    let award = false;
    store.update(s => {
      const g = s.plan.goals.find(q => q.id === gid);
      if (!g) return;
      g.done = !g.done;
      if (g.done && !g.awarded) { g.awarded = true; award = true; }
    });
    if (award) { gamify.awardXP(50, 'Цель достигнута'); toast('Цель достигнута! +50 XP'); }
    redraw();
  }

  function goalForm(g) {
    const d = g ? { title: g.title, sphere: g.sphere, due: g.due } : { title: '', sphere: 'discipline', due: addDays(today(), 90) };
    const title = h('input', { class: 'input', type: 'text', maxlength: 120, placeholder: 'Название цели', value: d.title });
    title.addEventListener('input', () => { d.title = title.value; });
    const due = h('input', { class: 'input', type: 'date', value: d.due || '' });
    due.addEventListener('input', () => { d.due = due.value; });
    const chips = h('div');
    const drawChips = () => chips.replaceChildren(sphereChips(d.sphere, id => { d.sphere = id; drawChips(); }));
    drawChips();
    return h('div', { class: 'card plan-form' },
      h('h2', null, g ? 'Редактирование цели' : 'Новая цель'),
      title, chips, h('label', { class: 'plan-muted' }, 'Срок', due),
      h('div', { class: 'plan-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.editing = null; redraw(); } }, 'Отмена'),
        g ? h('button', {
          class: 'btn', type: 'button',
          onclick: () => {
            if (!confirm('Удалить цель?')) return;
            store.update(s => { s.plan.goals = s.plan.goals.filter(q => q.id !== g.id); });
            ui.editing = null; redraw();
          },
        }, 'Удалить') : null,
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: () => {
            const t = d.title.trim();
            if (!t) { toast('Введите название'); return; }
            store.update(s => {
              if (g) { const x = s.plan.goals.find(q => q.id === g.id); if (x) { x.title = t; x.sphere = d.sphere; x.due = d.due; } }
              else s.plan.goals.push({ id: uid(), title: t, sphere: d.sphere, due: d.due, done: false, steps: [] });
            });
            ui.editing = null; redraw();
          },
        }, 'Сохранить')));
  }

  // ---------- недельный обзор ----------
  function reviewCard(plan) {
    const reviews = plan.reviews || [];
    const wk = weekKey();
    const cur = reviews.find(r => r.week === wk);
    const isSunday = new Date().getDay() === 0;
    const children = [h('h2', null, 'Недельный обзор')];

    if (ui.reviewOpen) {
      const answers = (cur ? cur.answers : ['', '', '']).slice();
      children.push(h('div', { class: 'plan-form' },
        QUESTIONS.map((q, i) => {
          const ta = h('textarea', { class: 'input', rows: 3, maxlength: 600, 'aria-label': q }, answers[i]);
          ta.addEventListener('input', () => { answers[i] = ta.value; });
          return h('label', null, h('b', null, `${i + 1}. ${q}`), ta);
        }),
        h('div', { class: 'plan-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { ui.reviewOpen = false; redraw(); } }, 'Отмена'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onclick: () => {
              if (!answers.some(a => a.trim())) { toast('Ответьте хотя бы на один вопрос'); return; }
              const isNew = !cur;
              store.update(s => {
                const list = s.plan.reviews || (s.plan.reviews = []);
                const ex = list.find(r => r.week === wk);
                if (ex) { ex.answers = answers.slice(); ex.date = today(); }
                else list.push({ id: uid(), week: wk, date: today(), answers: answers.slice() });
              });
              if (isNew) gamify.awardXP(15, 'Недельный обзор');
              ui.reviewOpen = false; toast(isNew ? 'Обзор сохранён! +15 XP' : 'Обзор обновлён'); redraw();
            },
          }, 'Сохранить'))));
    } else {
      children.push(h('p', { class: 'plan-muted' }, cur
        ? 'Обзор этой недели готов. Можно дополнить.'
        : (isSunday ? 'Сегодня воскресенье: время подвести итоги недели (3 вопроса).' : 'Раз в неделю, лучше по воскресеньям: 3 вопроса для рефлексии.')),
      h('button', { class: 'btn' + (!cur && isSunday ? ' btn-primary' : ''), type: 'button', onclick: () => { ui.reviewOpen = true; redraw(); } },
        cur ? 'Изменить обзор' : 'Заполнить обзор'));
    }

    const past = reviews.slice().sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, 4);
    if (past.length && !ui.reviewOpen) {
      children.push(h('h2', { style: 'margin-top:12px' }, 'Прошлые обзоры'),
        h('div', { class: 'list' }, past.map(r => h('details', { class: 'plan-muted', style: 'margin:6px 0' },
          h('summary', null, `Неделя с ${r.week}`),
          QUESTIONS.map((q, i) => r.answers[i] ? h('p', null, h('b', null, q), h('br'), r.answers[i]) : null)))));
    }
    return h('div', { class: 'card' }, children);
  }

  redraw();
  return () => { dead.v = true; };
}
