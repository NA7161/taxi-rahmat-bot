// Срез learn: колоды и карточки с интервальным повторением (SM-2, см. ../srs.js).
// learn: { cards:[{id,deck,front,back,ease,interval,due,reps,lapses}], decks:[{id,name}],
//          newPerDay?:number, log?:{'YYYY-MM-DD':{reviews,correct,newCount,xp}} }
import { schedule, previewInterval, START_EASE } from '../srs.js';
import { h, today, uid, toast } from '../util.js';

const DEFAULT_NEW_PER_DAY = 10;
const XP_DAILY_CAP = 30;

function L(s) {
  const l = s.learn;
  if (!l.cards) l.cards = [];
  if (!l.decks) l.decks = [];
  if (!l.log) l.log = {};
  return l;
}
const newLimit = s => (s.learn && Number.isFinite(s.learn.newPerDay) ? s.learn.newPerDay : DEFAULT_NEW_PER_DAY);
const isNew = c => c.due == null;

function dayLog(s, key = today()) {
  const log = (s.learn && s.learn.log) || {};
  return log[key] || { reviews: 0, correct: 0, newCount: 0, xp: 0 };
}

/** Для главного экрана: сколько карточек к повторению сегодня и сколько уже повторено. */
export function learnStats(state) {
  const cards = (state.learn && state.learn.cards) || [];
  const t = today();
  const dueOld = cards.filter(c => !isNew(c) && c.due <= t).length;
  const newAvail = cards.filter(isNew).length;
  const newLeft = Math.max(0, newLimit(state) - dayLog(state).newCount);
  return { due: dueOld + Math.min(newAvail, newLeft), reviewedToday: dayLog(state).reviews };
}

function retention(state, days = 30) {
  const log = (state.learn && state.learn.log) || {};
  const from = new Date(); from.setDate(from.getDate() - days);
  let r = 0, ok = 0;
  for (const [k, v] of Object.entries(log)) {
    const [y, m, d] = k.split('-').map(Number);
    if (new Date(y, m - 1, d) >= from) { r += v.reviews || 0; ok += v.correct || 0; }
  }
  return r ? Math.round((ok / r) * 100) : null;
}

function fmtInterval(d) {
  if (d < 30) return d + ' д';
  if (d < 365) return Math.round(d / 30) + ' мес';
  return (Math.round(d / 36.5) / 10) + ' г';
}

const CSS = `
.learn-big{font-size:2rem;font-weight:700}
.learn-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
.learn-stats b{display:block;font-size:1.3rem}
.learn-face{min-height:180px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:1.3rem;white-space:pre-wrap;word-break:break-word;padding:16px}
.learn-back{border-top:1px dashed currentColor;margin-top:12px;padding-top:12px;opacity:.9}
.learn-grades{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}
.learn-grades .btn{display:flex;flex-direction:column;align-items:center;gap:2px}
.learn-grades small{opacity:.7}
.learn-bar{height:6px;border-radius:3px;background:rgba(128,128,128,.25);overflow:hidden}
.learn-bar>i{display:block;height:100%;background:currentColor;opacity:.6}
.learn-wrap{display:flex;flex-direction:column;gap:12px}
.learn-actions{display:flex;gap:8px;flex-wrap:wrap}
.learn textarea.input{min-height:110px;font-family:inherit;resize:vertical;width:100%}
.learn .input{width:100%;box-sizing:border-box}
`;

export function render(root, ctx) {
  const { store, gamify } = ctx;
  if (!document.getElementById('learn-css')) {
    document.head.append(h('style', { id: 'learn-css' }, CSS));
  }
  const box = h('div', { class: 'learn learn-wrap' });
  root.append(box);
  let view = { mode: 'home', deckId: null, editId: null };
  let session = null;

  const go = (v) => { view = { mode: 'home', deckId: null, editId: null, ...v }; draw(); };
  const S = () => store.get();

  function draw() {
    box.replaceChildren();
    if (view.mode === 'session') return drawSession();
    if (view.mode === 'deck') return drawDeck();
    drawHome();
  }

  // ---------- Главная ----------
  function drawHome() {
    const s = S();
    const st = learnStats(s);
    const ret = retention(s);
    const total = s.learn.cards.length;
    const nameInput = h('input', { class: 'input', placeholder: 'Название новой колоды', maxlength: '60' });
    const limitInput = h('input', { class: 'input', type: 'number', min: '0', max: '200', value: String(newLimit(s)), inputmode: 'numeric' });

    box.append(
      h('h1', null, 'Знания'),
      h('div', { class: 'card' },
        h('div', null, 'К повторению сегодня'),
        h('div', { class: 'learn-big' }, String(st.due)),
        h('div', { class: 'learn-stats' },
          h('div', null, h('b', null, String(st.reviewedToday)), 'повторено'),
          h('div', null, h('b', null, String(total)), 'карточек'),
          h('div', null, h('b', null, ret == null ? '—' : ret + '%'), 'удержание 30 д')),
        h('div', { class: 'learn-actions', style: 'margin-top:12px' },
          h('button', { class: 'btn btn-primary', disabled: st.due === 0, onclick: () => startSession(null) },
            st.due ? 'Начать повторение' : 'На сегодня всё'))),
      h('h2', null, 'Колоды'),
      h('div', { class: 'list' }, s.learn.decks.length
        ? s.learn.decks.map(d => {
            const cs = s.learn.cards.filter(c => c.deck === d.id);
            const due = cs.filter(c => !isNew(c) && c.due <= today()).length;
            const nw = cs.filter(isNew).length;
            return h('div', { class: 'card row', style: 'cursor:pointer', onclick: () => go({ mode: 'deck', deckId: d.id }) },
              h('div', { style: 'flex:1' }, h('div', null, d.name),
                h('small', null, `${cs.length} карт · к повторению ${due} · новых ${nw}`)),
              h('span', { 'aria-hidden': 'true' }, '›'));
          })
        : h('div', { class: 'card' }, 'Колод пока нет. Создайте первую ниже.')),
      h('div', { class: 'card learn-wrap' },
        nameInput,
        h('button', { class: 'btn btn-primary', onclick: () => {
          const name = nameInput.value.trim();
          if (!name) return toast('Введите название');
          const id = uid();
          store.update(x => { L(x).decks.push({ id, name }); });
          go({ mode: 'deck', deckId: id });
        } }, 'Создать колоду')),
      h('div', { class: 'card learn-wrap' },
        h('label', null, 'Новых карточек в день'),
        limitInput,
        h('button', { class: 'btn', onclick: () => {
          const n = Math.max(0, Math.min(200, parseInt(limitInput.value, 10) || 0));
          store.update(x => { L(x).newPerDay = n; });
          toast('Лимит сохранён'); draw();
        } }, 'Сохранить лимит')));
  }

  // ---------- Колода ----------
  function drawDeck() {
    const s = S();
    const deck = s.learn.decks.find(d => d.id === view.deckId);
    if (!deck) return go({});
    const cards = s.learn.cards.filter(c => c.deck === deck.id);
    const due = cards.filter(c => !isNew(c) && c.due <= today()).length;
    const front = h('textarea', { class: 'input', placeholder: 'Вопрос', rows: '2' });
    const back = h('textarea', { class: 'input', placeholder: 'Ответ', rows: '2' });
    const bulk = h('textarea', { class: 'input', placeholder: 'вопрос;ответ\nвопрос;ответ', rows: '5' });

    box.append(
      h('div', { class: 'learn-actions' },
        h('button', { class: 'btn', onclick: () => go({}) }, '‹ Колоды')),
      h('h1', null, deck.name),
      h('div', { class: 'learn-actions' },
        h('button', { class: 'btn btn-primary', disabled: !cards.length, onclick: () => startSession(deck.id) },
          due ? `Повторить (${due})` : 'Повторить'),
        h('button', { class: 'btn', onclick: () => {
          const name = prompt('Название колоды', deck.name);
          if (name && name.trim()) { store.update(x => { L(x).decks.find(d => d.id === deck.id).name = name.trim(); }); draw(); }
        } }, 'Переименовать'),
        h('button', { class: 'btn', onclick: () => {
          if (!confirm(`Удалить колоду «${deck.name}» и все её карточки (${cards.length})?`)) return;
          store.update(x => { const l = L(x); l.decks = l.decks.filter(d => d.id !== deck.id); l.cards = l.cards.filter(c => c.deck !== deck.id); });
          go({});
        } }, 'Удалить')),
      h('div', { class: 'card learn-wrap' },
        h('b', null, 'Новая карточка'), front, back,
        h('button', { class: 'btn btn-primary', onclick: () => {
          const f = front.value.trim(), b = back.value.trim();
          if (!f || !b) return toast('Заполните вопрос и ответ');
          store.update(x => { L(x).cards.push(newCard(deck.id, f, b)); });
          draw();
        } }, 'Добавить')),
      h('div', { class: 'card learn-wrap' },
        h('b', null, 'Импорт из текста'),
        h('small', null, 'Одна карточка на строку: вопрос;ответ'),
        bulk,
        h('button', { class: 'btn', onclick: () => {
          const items = parseBulk(bulk.value);
          if (!items.length) return toast('Не найдено строк вида вопрос;ответ');
          store.update(x => { items.forEach(([f, b]) => L(x).cards.push(newCard(deck.id, f, b))); });
          toast(`Импортировано: ${items.length}`); draw();
        } }, 'Импортировать')),
      h('h2', null, `Карточки (${cards.length})`),
      h('div', { class: 'list' }, cards.map(c => view.editId === c.id ? editRow(c) : cardRow(c))));
  }

  function cardRow(c) {
    const status = isNew(c) ? 'новая' : (c.due <= today() ? 'пора повторить' : 'след.: ' + c.due);
    return h('div', { class: 'card' },
      h('div', { style: 'white-space:pre-wrap;word-break:break-word' }, c.front),
      h('div', { style: 'white-space:pre-wrap;word-break:break-word;opacity:.75' }, c.back),
      h('small', null, status),
      h('div', { class: 'learn-actions', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: () => { view.editId = c.id; draw(); } }, 'Изменить'),
        h('button', { class: 'btn', onclick: () => {
          if (!confirm('Удалить карточку?')) return;
          store.update(x => { const l = L(x); l.cards = l.cards.filter(k => k.id !== c.id); });
          draw();
        } }, 'Удалить')));
  }

  function editRow(c) {
    const f = h('textarea', { class: 'input', rows: '2' }); f.value = c.front;
    const b = h('textarea', { class: 'input', rows: '2' }); b.value = c.back;
    return h('div', { class: 'card learn-wrap' }, f, b,
      h('div', { class: 'learn-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => {
          const fv = f.value.trim(), bv = b.value.trim();
          if (!fv || !bv) return toast('Поля не должны быть пустыми');
          store.update(x => { const k = L(x).cards.find(k => k.id === c.id); if (k) { k.front = fv; k.back = bv; } });
          view.editId = null; draw();
        } }, 'Сохранить'),
        h('button', { class: 'btn', onclick: () => { view.editId = null; draw(); } }, 'Отмена')));
  }

  // ---------- Сессия ----------
  function startSession(deckId) {
    const s = S(), t = today();
    const pool = s.learn.cards.filter(c => !deckId || c.deck === deckId);
    const old = pool.filter(c => !isNew(c) && c.due <= t).sort((a, b) => a.due < b.due ? -1 : 1);
    const newLeft = Math.max(0, newLimit(s) - dayLog(s).newCount);
    const fresh = pool.filter(isNew).slice(0, newLeft);
    const queue = [...old, ...fresh].map(c => c.id);
    if (!queue.length) return toast('Сегодня повторять нечего');
    session = { queue, i: 0, flipped: false, firstSeen: new Set(), done: 0, correct: 0, deckId, finished: false };
    view = { mode: 'session' };
    draw();
  }

  function drawSession() {
    const s = S();
    if (!session) return go({});
    // пропускаем удалённые карточки
    while (session.i < session.queue.length && !s.learn.cards.find(c => c.id === session.queue[session.i])) session.i++;
    if (session.i >= session.queue.length) return finishSession();
    const card = s.learn.cards.find(c => c.id === session.queue[session.i]);
    const pct = Math.round((session.i / session.queue.length) * 100);

    const grades = [['Снова', 1], ['Трудно', 3], ['Хорошо', 4], ['Легко', 5]];
    box.append(
      h('div', { class: 'learn-actions' },
        h('button', { class: 'btn', onclick: () => finishSession() }, 'Завершить'),
        h('span', { style: 'margin-left:auto;align-self:center' }, `${session.i + 1} / ${session.queue.length}`)),
      h('div', { class: 'learn-bar' }, h('i', { style: `width:${pct}%` })),
      h('div', { class: 'card' },
        h('div', { class: 'learn-face' }, card.front),
        session.flipped ? h('div', { class: 'learn-face learn-back' }, card.back) : null),
      session.flipped
        ? h('div', { class: 'learn-grades' }, grades.map(([label, g]) =>
            h('button', { class: g === 4 ? 'btn btn-primary' : 'btn', onclick: () => answer(card, g) },
              h('span', null, label), h('small', null, fmtInterval(previewInterval(card, g))))))
        : h('button', { class: 'btn btn-primary', onclick: () => { session.flipped = true; draw(); } }, 'Показать ответ'));
  }

  function answer(card, grade) {
    const t = today();
    const first = !session.firstSeen.has(card.id);
    session.firstSeen.add(card.id);
    const wasNew = isNew(card);
    store.update(x => {
      const l = L(x);
      const k = l.cards.find(c => c.id === card.id);
      if (k) Object.assign(k, schedule(k, grade, t));
      if (first) {
        const e = l.log[t] || (l.log[t] = { reviews: 0, correct: 0, newCount: 0, xp: 0 });
        e.reviews++; if (grade >= 3) e.correct++; if (wasNew) e.newCount++;
        const keys = Object.keys(l.log).sort();
        while (keys.length > 120) delete l.log[keys.shift()];
      }
    });
    if (first) { session.done++; if (grade >= 3) session.correct++; }
    // «Снова»: показать ещё раз в конце этой сессии (без повторного учёта и XP)
    if (grade < 3) session.queue.push(card.id);
    session.i++; session.flipped = false;
    draw();
  }

  function finishSession() {
    const sess = session;
    if (sess && !sess.finished) {
      sess.finished = true;
      let xp = 0;
      if (sess.done > 0) {
        const want = Math.ceil(sess.done / 2) + (sess.done >= 10 ? 5 : 0);
        const used = dayLog(S()).xp || 0;
        xp = Math.max(0, Math.min(want, XP_DAILY_CAP - used));
        if (xp > 0) {
          store.update(x => { const l = L(x); (l.log[today()] || (l.log[today()] = { reviews: 0, correct: 0, newCount: 0, xp: 0 })).xp = used + xp; });
          gamify.awardXP(xp, 'Повторение карточек');
        }
      }
      sess.xp = xp;
    }
    session = null;
    box.replaceChildren();
    const r = sess || { done: 0, correct: 0, xp: 0 };
    box.append(
      h('h1', null, 'Сессия завершена'),
      h('div', { class: 'card' },
        h('div', null, `Карточек: ${r.done}`),
        h('div', null, `Вспомнено: ${r.correct}${r.done ? ' (' + Math.round(r.correct / r.done * 100) + '%)' : ''}`),
        h('div', null, r.xp ? `+${r.xp} XP` : 'XP за сегодня уже набраны или карточек не было')),
      h('button', { class: 'btn btn-primary', onclick: () => go({}) }, 'К колодам'));
    view = { mode: 'home' };
  }

  draw();
  return () => { session = null; };
}

function newCard(deck, front, back) {
  return { id: uid(), deck, front, back, ease: START_EASE, interval: 0, due: null, reps: 0, lapses: 0 };
}

function parseBulk(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const i = line.indexOf(';');
    if (i < 0) continue;
    const f = line.slice(0, i).trim(), b = line.slice(i + 1).trim();
    if (f && b) out.push([f, b]);
  }
  return out;
}
