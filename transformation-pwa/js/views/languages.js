// Языки. Владелец среза: state.lang = { target, progress:{lessonId:{done,score,date,attempts}} }
import { LANGUAGES, DEFAULT_LANG, PASS_SCORE, XP_FIRST } from '../data/languages.js';

/** Статистика для главной: сколько уроков пройдено из доступных на текущем целевом языке. */
export function langStats(state) {
  const lang = LANGUAGES[(state.lang && state.lang.target) || DEFAULT_LANG] || LANGUAGES[DEFAULT_LANG];
  const prog = (state.lang && state.lang.progress) || {};
  return { done: lang.lessons.filter(l => prog[l.id] && prog[l.id].done).length, total: lang.lessons.length };
}

const CSS = `
.lang-chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.lang-chips .chip[disabled]{opacity:.5}
.lang-bar{height:8px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden;margin:6px 0 12px}
.lang-bar>i{display:block;height:100%;background:#4caf50}
.lang-lesson{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer}
.lang-lesson .grow{flex:1;min-width:0}
.lang-sub{opacity:.7;font-size:.85em}
.lang-word{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.2)}
.lang-word .grow{flex:1}
.lang-word b{display:block}
.lang-q{font-size:1.15em;margin:8px 0 12px}
.lang-opts{display:grid;gap:8px}
.lang-opt{text-align:left;padding:12px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;cursor:pointer}
.lang-opt.ok{background:rgba(76,175,80,.3);border-color:#4caf50}
.lang-opt.bad{background:rgba(244,67,54,.3);border-color:#f44336}
.lang-answer,.lang-pool{display:flex;flex-wrap:wrap;gap:8px;min-height:48px;padding:8px;border-radius:10px;border:1px dashed rgba(128,128,128,.5);margin:8px 0}
.lang-tok{padding:8px 12px;border-radius:10px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;font:inherit;cursor:pointer}
.lang-fb{margin:12px 0;padding:10px;border-radius:10px}
.lang-fb.ok{background:rgba(76,175,80,.2)}
.lang-fb.bad{background:rgba(244,67,54,.2)}
.lang-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.lang-big{font-size:2.4em;text-align:center;margin:12px 0}
`;

const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const norm = s => String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"«»]/g, ' ').replace(/\s+/g, ' ').trim();
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

export function render(root, ctx) {
  const { store, util, gamify } = ctx;
  const { h, toast, today, uid } = util;
  const st0 = store.get();
  if (!LANGUAGES[st0.lang.target]) store.update(s => { s.lang.target = DEFAULT_LANG; });
  let screen = { mode: 'list' };
  const lang = () => LANGUAGES[store.get().lang.target] || LANGUAGES[DEFAULT_LANG];

  function speak(text) {
    if (!canSpeak()) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang().speech || 'en-US';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* озвучка недоступна */ }
  }
  const speakBtn = text => canSpeak() ? h('button', { class: 'btn', type: 'button', 'aria-label': 'Прослушать', onclick: () => speak(text) }, '🔊') : null;

  function paint(...nodes) { root.replaceChildren(h('style', { id: 'lang-css' }, CSS), ...nodes); window.scrollTo(0, 0); }

  // ---------- список уроков ----------
  function showList() {
    screen = { mode: 'list' };
    const s = store.get(), L = lang(), prog = s.lang.progress || {};
    const stats = langStats(s);
    const chips = Object.values(LANGUAGES).map(l => h('button', {
      class: 'chip' + (l.id === L.id ? ' active' : ''), type: 'button', disabled: l.status !== 'ready',
      onclick: () => { store.update(x => { x.lang.target = l.id; }); showList(); },
    }, `${l.flag} ${l.name}${l.status === 'ready' ? '' : ' — скоро'}`));
    const pct = stats.total ? Math.round(100 * stats.done / stats.total) : 0;
    paint(
      h('h1', null, 'Языки'),
      h('div', { class: 'lang-chips' }, chips),
      h('div', { class: 'card' },
        h('div', null, `${L.name}, уровень ${L.level}: пройдено ${stats.done} из ${stats.total}`),
        h('div', { class: 'lang-bar' }, h('i', { style: `width:${pct}%` }))),
      L.lessons.length
        ? h('div', { class: 'list' }, L.lessons.map((les, i) => {
          const p = prog[les.id];
          return h('button', { class: 'card lang-lesson', type: 'button', onclick: () => showLesson(les) },
            h('span', { class: 'ico', 'aria-hidden': 'true' }, les.icon),
            h('span', { class: 'grow' }, h('div', null, `${i + 1}. ${les.title}`),
              h('div', { class: 'lang-sub' }, p ? `Лучший результат: ${Math.round(p.score * 100)}%` : `${les.words.length} слов и фраз`)),
            h('span', null, p && p.done ? '✅' : '›'));
        }))
        : h('div', { class: 'card' }, 'Этот язык скоро появится.'),
    );
  }

  // ---------- карточка урока ----------
  function addToCards(les) {
    let added = 0;
    store.update(s => {
      // learn.js ищет колоду по id в learn.decks, поэтому создаём запись колоды и ссылаемся на её id
      const deck = 'lang-' + les.id;
      if (!Array.isArray(s.learn.decks)) s.learn.decks = [];
      if (!s.learn.decks.some(d => d.id === deck)) s.learn.decks.push({ id: deck, name: `${lang().name}: ${les.title}` });
      const have = new Set(s.learn.cards.map(c => c.deck + '|' + String(c.front).toLowerCase()));
      for (const wd of les.words) {
        const key = deck + '|' + wd.en.toLowerCase();
        if (have.has(key)) continue;
        have.add(key);
        s.learn.cards.push({ id: uid(), deck, front: wd.en, back: wd.ru, ease: 2.5, interval: 0, due: today(), reps: 0, lapses: 0 });
        added++;
      }
    });
    toast(added ? `Добавлено карточек: ${added}` : 'Все слова уже в карточках');
  }

  function showLesson(les) {
    screen = { mode: 'lesson', id: les.id };
    paint(
      h('button', { class: 'btn', type: 'button', onclick: showList }, '‹ Уроки'),
      h('h1', null, `${les.icon} ${les.title}`),
      h('div', { class: 'card' }, les.words.map(wd => h('div', { class: 'lang-word' },
        h('div', { class: 'grow' }, h('b', null, wd.en), h('span', { class: 'lang-sub' }, wd.tr ? `[${wd.tr}] ` : ''), h('span', null, wd.ru)),
        speakBtn(wd.en)))),
      h('div', { class: 'lang-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => startQuiz(les) }, 'Начать упражнения'),
        h('button', { class: 'btn', type: 'button', onclick: () => addToCards(les) }, 'Добавить слова урока в карточки')),
    );
  }

  // ---------- упражнения ----------
  function buildItems(les) {
    const words = les.words;
    const items = [];
    for (const ex of les.exercises) {
      if (ex.t === 'choice') {
        const word = words.find(x => ex.en ? x.en === ex.en : x.ru === ex.ru);
        if (!word) continue;
        const toRu = !!ex.en, key = toRu ? 'ru' : 'en';
        const wrong = shuffle(words.filter(x => x !== word).map(x => x[key])).slice(0, 3);
        items.push({ t: 'choice', q: toRu ? `Как переводится «${word.en}»?` : `Как по-английски «${word.ru}»?`,
          options: shuffle([word[key], ...wrong]), answer: word[key], say: toRu ? word.en : null });
      } else if (ex.t === 'listen') {
        if (!canSpeak()) continue;
        const wrong = shuffle(words.map(x => x.en).filter(x => x !== ex.say)).slice(0, 3);
        items.push({ t: 'choice', q: 'Прослушайте и выберите, что услышали', options: shuffle([ex.say, ...wrong]), answer: ex.say, listen: ex.say });
      } else if (ex.t === 'type') items.push(ex);
      else if (ex.t === 'build') items.push(ex);
    }
    return items;
  }

  function startQuiz(les) {
    const items = buildItems(les);
    if (!items.length) { toast('Нет упражнений'); return; }
    showExercise({ les, items, i: 0, right: 0 });
  }

  function showExercise(q) {
    screen = { mode: 'quiz', id: q.les.id };
    const ex = q.items[q.i];
    let answered = false;
    const fb = h('div', { 'aria-live': 'polite' });
    const next = h('button', { class: 'btn btn-primary', type: 'button', hidden: true,
      onclick: () => { q.i++; q.i >= q.items.length ? finish(q) : showExercise(q); } }, q.i + 1 >= q.items.length ? 'Завершить' : 'Далее');
    const done = (ok, correctText) => {
      if (answered) return; answered = true;
      if (ok) q.right++;
      fb.replaceChildren(h('div', { class: 'lang-fb ' + (ok ? 'ok' : 'bad') }, ok ? 'Верно!' : `Неверно. Правильно: ${correctText}`));
      next.hidden = false; next.focus();
    };
    let body;
    if (ex.t === 'choice') {
      const btns = ex.options.map(o => h('button', { class: 'lang-opt', type: 'button', onclick: () => {
        if (answered) return;
        btns.forEach(b => { if (b.textContent === ex.answer) b.classList.add('ok'); });
        if (o !== ex.answer) btnOf(o).classList.add('bad');
        done(o === ex.answer, ex.answer);
      } }, o));
      const btnOf = o => btns.find(b => b.textContent === o);
      body = [h('div', { class: 'lang-q' }, ex.q), ex.listen ? h('div', { class: 'lang-big' }, speakBtn(ex.listen)) : null,
        h('div', { class: 'lang-opts' }, btns)];
    } else if (ex.t === 'type') {
      const inp = h('input', { class: 'input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Ответ' });
      const check = () => { if (answered) return; const v = norm(inp.value); if (!v) return;
        inp.disabled = true; done(ex.answers.some(a => norm(a) === v), ex.answers[0]); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      body = [h('div', { class: 'lang-q' }, ex.prompt), inp,
        h('div', { class: 'lang-actions' }, h('button', { class: 'btn', type: 'button', onclick: check }, 'Проверить'))];
      setTimeout(() => inp.focus(), 0);
    } else {
      const toks = shuffle([...ex.answer.split(/\s+/), ...ex.extra]).map((t, k) => ({ t, k, used: false }));
      const picked = [];
      const ansBox = h('div', { class: 'lang-answer' }), pool = h('div', { class: 'lang-pool' });
      const redraw = () => {
        ansBox.replaceChildren(...picked.map(tk => h('button', { class: 'lang-tok', type: 'button', onclick: () => {
          if (answered) return; tk.used = false; picked.splice(picked.indexOf(tk), 1); redraw(); } }, tk.t)));
        pool.replaceChildren(...toks.map(tk => h('button', { class: 'lang-tok', type: 'button', disabled: tk.used, onclick: () => {
          if (answered || tk.used) return; tk.used = true; picked.push(tk); redraw(); } }, tk.t)));
      };
      redraw();
      const check = () => { if (answered || !picked.length) return;
        done(norm(picked.map(x => x.t).join(' ')) === norm(ex.answer), ex.answer); };
      body = [h('div', { class: 'lang-q' }, `Составьте фразу: «${ex.prompt}»`), ansBox, pool,
        h('div', { class: 'lang-actions' }, h('button', { class: 'btn', type: 'button', onclick: check }, 'Проверить'))];
    }
    paint(
      h('button', { class: 'btn', type: 'button', onclick: () => showLesson(q.les) }, '✕ Выйти'),
      h('div', { class: 'lang-sub' }, `Задание ${q.i + 1} из ${q.items.length}`),
      ...body, fb, h('div', { class: 'lang-actions' }, next),
    );
  }

  function finish(q) {
    const { les } = q, score = q.right / q.items.length, passed = score >= PASS_SCORE;
    const prev = store.get().lang.progress[les.id];
    const first = passed && !(prev && prev.done);
    let xp = 0;
    if (passed) { xp = Math.round(5 * score); if (first) xp += XP_FIRST; }
    store.update(s => {
      const p = s.lang.progress[les.id] || {};
      s.lang.progress[les.id] = { done: !!p.done || passed, score: Math.max(p.score || 0, score), date: today(), attempts: (p.attempts || 0) + 1 };
    });
    if (xp > 0) gamify.awardXP(xp, 'Урок: ' + les.title);
    screen = { mode: 'result' };
    paint(
      h('h1', null, passed ? 'Урок пройден!' : 'Попробуйте ещё раз'),
      h('div', { class: 'card' },
        h('div', { class: 'lang-big' }, `${Math.round(score * 100)}%`),
        h('div', null, `Верных ответов: ${q.right} из ${q.items.length}`),
        h('div', null, passed ? `Получено XP: ${xp}${first ? ' (с бонусом за первое прохождение)' : ''}` : `Для прохождения нужно набрать ${Math.round(PASS_SCORE * 100)}%`)),
      h('div', { class: 'lang-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => startQuiz(les) }, 'Повторить'),
        h('button', { class: 'btn', type: 'button', onclick: showList }, 'К урокам')),
    );
  }

  showList();
  return () => { if (canSpeak()) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } };
}
