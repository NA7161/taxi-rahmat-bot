// Единое хранилище состояния. Всё в localStorage под одним ключом.
// Каждый модуль владеет ТОЛЬКО своим срезом (см. DEFAULTS).
const KEY = 'transformation.v1';

export const DEFAULTS = {
  v: 1,
  profile: { name: '', onboarded: false, createdAt: null },
  // владелец: views/plan.js
  plan: { wheel: {}, goals: [] }, // wheel: {sphere: 1..10}; goals: [{id,title,sphere,due,done,steps:[{id,text,done}]}]
  // владелец: views/habits.js
  habits: { items: [], log: {} }, // items: [{id,name,icon,days:[0..6],createdAt,archived}]; log: {'YYYY-MM-DD':[habitId]}
  // владелец: views/workout.js
  workouts: { log: [], plans: [] }, // log: [{id,date,name,minutes,exercises:[{name,sets:[{reps,kg}]}]}]
  // владелец: views/health.js
  health: { log: {}, goals: { water: 8, sleep: 8 } }, // log: {'YYYY-MM-DD':{sleep,water,weight,mood(1-5)}}
  // владелец: views/learn.js
  learn: { cards: [], decks: [] }, // cards: [{id,deck,front,back,ease,interval,due,reps,lapses}]
  // владелец: views/languages.js
  lang: { target: 'en', progress: {} }, // progress: {lessonId:{done:true,score:0..1,date}}
  // владелец: gamify.js
  gamify: { xp: 0, events: [], achievements: [] }, // events: [{t,xp,reason}]
  // владелец: views/challenge.js
  challenge: { start: null, weeklyGoal: 100 }, // start: 'YYYY-MM-DD' | null; weeklyGoal: XP в неделю
  // владелец: views/settings.js
  settings: { theme: 'auto', reminders: { enabled: false, time: '09:00' } },
};

let state = load();
const subs = new Set();

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(clone(DEFAULTS), JSON.parse(raw));
  } catch (e) { /* повреждённые данные: начинаем с нуля */ }
  return clone(DEFAULTS);
}

function merge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      merge(base[k], over[k]);
    } else base[k] = over[k];
  }
  return base;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('storage failed', e); }
}

export const store = {
  /** Весь стейт (только чтение, не мутировать напрямую). */
  get() { return state; },
  /** Мутировать стейт: store.update(s => { s.habits.items.push(x); }). Сохраняет и уведомляет. */
  update(fn) { fn(state); persist(); subs.forEach(f => { try { f(state); } catch (e) { console.error(e); } }); },
  /** Подписка на любые изменения. Возвращает функцию отписки. */
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  /** Экспорт/импорт для settings. */
  exportJSON() { return JSON.stringify(state, null, 2); },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) throw new Error('Неверный формат файла');
    state = merge(clone(DEFAULTS), parsed); persist(); subs.forEach(f => f(state));
  },
  reset() { state = clone(DEFAULTS); persist(); subs.forEach(f => f(state)); },
};
