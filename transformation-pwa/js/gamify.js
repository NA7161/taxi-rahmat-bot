// Геймификация: XP, уровни, достижения. Владелец: этот файл.
import { store } from './store.js';
import { dateKey, addDays, toast } from './util.js';

export const LEVEL_TITLES = ['Новичок', 'Ученик', 'Практик', 'Стойкий', 'Мастер привычек', 'Воин дисциплины', 'Наставник', 'Эксперт', 'Мудрец', 'Легенда'];

/** Начислить XP. Все модули вызывают ТОЛЬКО эту функцию. */
export function awardXP(amount, reason) {
  const before = levelInfo().level;
  store.update(s => {
    s.gamify.xp += amount;
    s.gamify.events.push({ t: Date.now(), xp: amount, reason });
    if (s.gamify.events.length > 500) s.gamify.events.splice(0, s.gamify.events.length - 500);
  });
  checkAchievements();
  const after = levelInfo().level;
  if (after > before) toast(`🎉 Новый уровень: ${after} — ${levelTitle(after)}`, 3000);
}

export function levelTitle(level) { return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]; }

/** @returns {{level:number, xpInLevel:number, xpForNext:number, total:number, title:string}} */
export function levelInfo() {
  const total = store.get().gamify.xp;
  const level = Math.floor(Math.sqrt(total / 50)) + 1;
  const base = 50 * (level - 1) ** 2, next = 50 * level ** 2;
  return { level, xpInLevel: total - base, xpForNext: next - base, total, title: levelTitle(level) };
}

// ---------- вспомогательные подсчёты ----------
function habitDays(s) {
  const log = s.habits.log || {};
  return Object.keys(log).filter(k => Array.isArray(log[k]) && log[k].length).sort();
}
function longestStreak(keys) {
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    cur = prev && addDays(prev, 1) === k ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = k;
  }
  return best;
}
function habitStreak(s) { return longestStreak(habitDays(s)); }
const activeHabits = s => (s.habits.items || []).filter(i => !i.archived).length;
const sumReps = s => (s.workouts.log || []).reduce((a, w) => a + (w.exercises || []).reduce((b, e) => b + (e.sets || []).length, 0), 0);
const lessonsDone = s => Object.values(s.lang.progress || {}).filter(p => p && p.done).length;
const healthDays = s => Object.keys(s.health.log || {}).length;
const goalsDone = s => (s.plan.goals || []).filter(g => g.done).length;

// ---------- достижения ----------
// check(s) -> boolean. xp — бонус за получение.
export const ACHIEVEMENTS = [
  { id: 'profile', icon: '👤', title: 'Знакомство', desc: 'Заполнить профиль', xp: 10, check: s => !!(s.profile.name && s.profile.onboarded) },
  { id: 'wheel', icon: '🎡', title: 'Колесо баланса', desc: 'Оценить сферы жизни', xp: 20, check: s => Object.keys(s.plan.wheel || {}).length >= 4 },
  { id: 'goal1', icon: '🎯', title: 'Цель поставлена', desc: 'Создать первую цель', xp: 15, check: s => (s.plan.goals || []).length >= 1 },
  { id: 'goal_done', icon: '🏁', title: 'Цель достигнута', desc: 'Завершить цель', xp: 50, check: s => goalsDone(s) >= 1 },
  { id: 'habit1', icon: '🌱', title: 'Первая привычка', desc: 'Создать привычку', xp: 15, check: s => activeHabits(s) >= 1 },
  { id: 'habit5', icon: '🌿', title: 'Система', desc: 'Вести 5 привычек одновременно', xp: 30, check: s => activeHabits(s) >= 5 },
  { id: 'streak3', icon: '🔥', title: 'Разгон', desc: 'Серия 3 дня подряд', xp: 15, check: s => habitStreak(s) >= 3 },
  { id: 'streak7', icon: '🔥', title: 'Неделя силы', desc: 'Серия 7 дней подряд', xp: 40, check: s => habitStreak(s) >= 7 },
  { id: 'streak30', icon: '🏆', title: 'Железная воля', desc: 'Серия 30 дней подряд', xp: 150, check: s => habitStreak(s) >= 30 },
  { id: 'workout1', icon: '💪', title: 'Первый пот', desc: 'Первая тренировка', xp: 15, check: s => (s.workouts.log || []).length >= 1 },
  { id: 'workout10', icon: '🏋️', title: 'В ритме', desc: '10 тренировок', xp: 50, check: s => (s.workouts.log || []).length >= 10 },
  { id: 'workout50', icon: '🦾', title: 'Атлет', desc: '50 тренировок', xp: 150, check: s => (s.workouts.log || []).length >= 50 },
  { id: 'sets100', icon: '⚙️', title: 'Сотня подходов', desc: '100 подходов в тренировках', xp: 60, check: s => sumReps(s) >= 100 },
  { id: 'cards10', icon: '🃏', title: 'Первые карточки', desc: 'Создать 10 карточек', xp: 15, check: s => (s.learn.cards || []).length >= 10 },
  { id: 'cards100', icon: '🧠', title: 'Сто знаний', desc: '100 карточек', xp: 80, check: s => (s.learn.cards || []).length >= 100 },
  { id: 'lesson1', icon: '📖', title: 'Первый урок', desc: 'Пройти урок языка', xp: 15, check: s => lessonsDone(s) >= 1 },
  { id: 'lesson10', icon: '🌍', title: 'Полиглот в пути', desc: 'Пройти 10 уроков', xp: 60, check: s => lessonsDone(s) >= 10 },
  { id: 'health1', icon: '❤️', title: 'Забота о себе', desc: 'Первая запись здоровья', xp: 10, check: s => healthDays(s) >= 1 },
  { id: 'health7', icon: '🩺', title: 'Неделя заботы', desc: 'Записи здоровья за 7 дней', xp: 40, check: s => healthDays(s) >= 7 },
  { id: 'water', icon: '💧', title: 'Водный баланс', desc: 'Выполнить норму воды за день', xp: 20, check: s => { const g = s.health.goals?.water || 8; return Object.values(s.health.log || {}).some(d => d && d.water >= g); } },
  { id: 'xp500', icon: '⭐', title: '500 XP', desc: 'Набрать 500 XP', xp: 0, check: s => s.gamify.xp >= 500 },
  { id: 'xp2000', icon: '🌟', title: '2000 XP', desc: 'Набрать 2000 XP', xp: 0, check: s => s.gamify.xp >= 2000 },
  { id: 'level5', icon: '🚀', title: 'Пятый уровень', desc: 'Достичь 5 уровня', xp: 0, check: s => Math.floor(Math.sqrt(s.gamify.xp / 50)) + 1 >= 5 },
];

const idOf = a => (typeof a === 'string' ? a : a && a.id);
export function earnedIds(s = store.get()) { return new Set((s.gamify.achievements || []).map(idOf)); }

/** Проверить условия, выдать новые достижения (без дублей). @returns {object[]} новые достижения */
export function checkAchievements() {
  const fresh = [];
  for (let pass = 0; pass < 3; pass++) { // бонусный XP может открыть ещё одно
    const have = earnedIds();
    const s = store.get();
    const now = ACHIEVEMENTS.filter(a => !have.has(a.id) && safe(a, s));
    if (!now.length) break;
    store.update(st => {
      const has = earnedIds(st);
      for (const a of now) {
        if (has.has(a.id)) continue; // защита от дублей
        st.gamify.achievements.push({ id: a.id, t: Date.now() });
        if (a.xp) { st.gamify.xp += a.xp; st.gamify.events.push({ t: Date.now(), xp: a.xp, reason: 'Достижение: ' + a.title }); }
        fresh.push(a);
      }
      if (st.gamify.events.length > 500) st.gamify.events.splice(0, st.gamify.events.length - 500);
    });
  }
  fresh.forEach((a, i) => setTimeout(() => toast(`${a.icon} Достижение: ${a.title}` + (a.xp ? ` +${a.xp} XP` : ''), 3000), i * 600));
  return fresh;
}
function safe(a, s) { try { return !!a.check(s); } catch (e) { return false; } }
export { dateKey };
