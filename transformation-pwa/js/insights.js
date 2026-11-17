// Подсказки по вашим данным. Это правила, а не искусственный интеллект:
// каждое правило считает число из данных и формулирует факт. Чистая функция без DOM и хранилища,
// поэтому её можно проверить тестом (tests/insights.test.mjs).
import { dateKey, addDays } from './util.js';

const toUTC = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
const WEEKDAY_IN = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const SPHERE = { health: 'Здоровье', sport: 'Спорт', knowledge: 'Знания', lang: 'Языки', discipline: 'Дисциплина', finance: 'Финансы' };
const GAP_DAYS = 5;

const keys = o => Object.keys(o || {});
const last = arr => arr.reduce((m, k) => (m == null || k > m ? k : m), null);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const round1 = x => Math.round(x * 10) / 10;

function xpByDay(events) {
  const m = {};
  for (const e of events || []) { const k = dateKey(new Date(e.t)); m[k] = (m[k] || 0) + (e.xp || 0); }
  return m;
}
const sumRange = (m, from, n) => { let s = 0; for (let i = 0; i < n; i++) s += m[addDays(from, i)] || 0; return s; };

/** Серия подряд выполненных запланированных дней до вчера (незапланированные дни серию не рвут). */
function habitStreakBeforeToday(item, log, today) {
  let n = 0, k = addDays(today, -1);
  for (let i = 0; i < 400; i++, k = addDays(k, -1)) {
    const [y, m, d] = k.split('-').map(Number);
    if (!item.days.includes(new Date(y, m - 1, d).getDay())) continue;
    if ((log[k] || []).includes(item.id)) n++; else break;
  }
  return n;
}

/**
 * @param {object} state  состояние хранилища
 * @param {Date} now      текущее время (для тестов)
 * @returns {{id:string,icon:string,tone:'good'|'warn'|'info',title:string,text:string,href?:string,prio:number}[]}
 */
export function computeInsights(state, now = new Date()) {
  const out = [];
  const today = dateKey(now), hour = now.getHours();
  const events = (state.gamify && state.gamify.events) || [];
  const byDay = xpByDay(events);
  const add = (o) => out.push(o);

  // 0. совсем нет данных
  if (!events.length) {
    add({ id: 'start', icon: '🌱', tone: 'info', title: 'Начните с одного действия',
      text: 'Отметьте привычку, пройдите урок или запишите воду: после этого здесь появятся подсказки по вашим данным.', href: '#/habits', prio: 50 });
  }

  // 1. серия под угрозой
  const habits = (state.habits && state.habits.items) || [], hlog = (state.habits && state.habits.log) || {};
  const todayDow = now.getDay();
  for (const it of habits) {
    if (it.archived || !Array.isArray(it.days) || !it.days.includes(todayDow)) continue;
    if ((hlog[today] || []).includes(it.id)) continue;
    const n = habitStreakBeforeToday(it, hlog, today);
    if (n >= 3) add({ id: 'streak-' + it.id, icon: '🔥', tone: hour >= 18 ? 'warn' : 'info',
      title: `Серия ${n} дн. под угрозой`, text: `«${it.name}»: сегодня ещё не отмечено.`, href: '#/habits', prio: hour >= 18 ? 100 : 75 });
  }

  // 2. давно не было активности в разделе (только если раздел уже использовался)
  const areas = [
    ['habits', '✅', 'Привычки', last(keys(hlog).filter(k => (hlog[k] || []).length)), '#/habits'],
    ['workout', '💪', 'Тренировки', last(((state.workouts && state.workouts.log) || []).map(w => w.date)), '#/workout'],
    ['health', '❤️', 'Записи здоровья', last(keys(state.health && state.health.log)), '#/health'],
    ['learn', '🧠', 'Повторение карточек', last(keys(state.learn && state.learn.log)), '#/learn'],
    ['lang', '🌍', 'Языки', last(Object.values((state.lang && state.lang.progress) || {}).map(p => p && p.date).filter(Boolean)), '#/languages'],
  ];
  for (const [id, icon, name, lastKey, href] of areas) {
    if (!lastKey) continue;
    const gap = dayDiff(lastKey, today);
    if (gap >= GAP_DAYS) add({ id: 'gap-' + id, icon, tone: 'warn', title: `${name}: ${gap} дн. без активности`, text: 'Вернуться проще всего с самого маленького шага.', href, prio: 70 + Math.min(gap, 20) / 2 });
  }

  // 3. цель челленджа на неделю
  const ch = state.challenge;
  if (ch && ch.start && ch.weeklyGoal > 0) {
    const elapsed = dayDiff(ch.start, today);
    if (elapsed >= 0 && elapsed < 84) {
      const wStart = addDays(ch.start, Math.floor(elapsed / 7) * 7);
      const got = sumRange(byDay, wStart, 7), left = ch.weeklyGoal - got, daysLeft = 7 - (elapsed % 7);
      if (left <= 0) add({ id: 'ch-done', icon: '🏆', tone: 'good', title: 'Цель недели выполнена', text: `${got} из ${ch.weeklyGoal} XP.`, href: '#/challenge', prio: 60 });
      else add({ id: 'ch-pace', icon: '🏆', tone: daysLeft <= 2 ? 'warn' : 'info', title: `До цели недели ${left} XP`,
        text: `Дней осталось: ${daysLeft}. Нужно в среднем ${Math.ceil(left / daysLeft)} XP в день.`, href: '#/challenge', prio: daysLeft <= 2 ? 90 : 65 });
    }
  }

  // 4. динамика XP за 7 дней против предыдущих 7
  if (events.length) {
    const thisW = sumRange(byDay, addDays(today, -6), 7), prevW = sumRange(byDay, addDays(today, -13), 7);
    if (prevW > 0 && thisW > 0) {
      const ch2 = Math.round(((thisW - prevW) / prevW) * 100);
      if (ch2 >= 10) add({ id: 'xp-up', icon: '📈', tone: 'good', title: `Активность выросла на ${ch2}%`, text: `${thisW} XP за 7 дней против ${prevW} за предыдущие 7.`, href: '#/activity', prio: 55 });
      else if (ch2 <= -20) add({ id: 'xp-down', icon: '📉', tone: 'warn', title: `Активность упала на ${-ch2}%`, text: `${thisW} XP за 7 дней против ${prevW} за предыдущие 7.`, href: '#/activity', prio: 70 });
      else add({ id: 'xp-flat', icon: '➖', tone: 'info', title: 'Активность держится на уровне', text: `${thisW} XP за 7 дней, ${prevW} за предыдущие 7.`, href: '#/activity', prio: 30 });
    } else if (thisW === 0 && prevW === 0) {
      add({ id: 'xp-zero', icon: '💤', tone: 'warn', title: 'Две недели без действий', text: 'Выберите одно действие на сегодня и начните с него.', href: '#/habits', prio: 85 });
    }
  }

  // 5. вода и сон за последние 7 дней (факты, без медицинских выводов)
  const hl = state.health || {}, hgoal = hl.goals || {};
  const recent = [];
  for (let i = 0; i < 7; i++) { const e = hl.log && hl.log[addDays(today, -i)]; if (e) recent.push(e); }
  const waters = recent.map(e => e.water).filter(v => typeof v === 'number');
  if (waters.length >= 3 && hgoal.water > 0) {
    const a = avg(waters);
    if (a < hgoal.water * 0.7) add({ id: 'water-low', icon: '💧', tone: 'info', title: 'Воды меньше цели', text: `В среднем ${round1(a)} из ${hgoal.water} стаканов за ${waters.length} дн. с записью.`, href: '#/health', prio: 45 });
    else if (a >= hgoal.water) add({ id: 'water-ok', icon: '💧', tone: 'good', title: 'Норма воды выполняется', text: `В среднем ${round1(a)} стаканов при цели ${hgoal.water}.`, href: '#/health', prio: 25 });
  }
  const sleeps = recent.map(e => e.sleep).filter(v => typeof v === 'number');
  if (sleeps.length >= 3 && hgoal.sleep > 0) {
    const a = avg(sleeps);
    if (a < hgoal.sleep - 1) add({ id: 'sleep-low', icon: '😴', tone: 'info', title: 'Сон короче вашей цели', text: `В среднем ${round1(a)} ч при цели ${hgoal.sleep} ч за ${sleeps.length} дн. с записью.`, href: '#/health', prio: 44 });
  }

  // 6. колесо баланса против целей
  const wheel = (state.plan && state.plan.wheel) || {}, goals = (state.plan && state.plan.goals) || [];
  const scored = Object.entries(wheel).filter(([k, v]) => SPHERE[k] && typeof v === 'number');
  if (scored.length >= 4) {
    const [wk, wv] = scored.reduce((m, c) => (c[1] < m[1] ? c : m));
    if (wv <= 5 && !goals.some(g => g.sphere === wk && !g.done)) add({ id: 'wheel-gap', icon: '🎯', tone: 'info', title: `Слабая сфера без цели: ${SPHERE[wk]}`,
      text: `Оценка ${wv} из 10, и нет активной цели в этой сфере. Поставьте одну небольшую.`, href: '#/plan', prio: 40 });
  }

  // 7. самый активный день недели (нужно достаточно данных)
  const wd = Array(7).fill(0); let total = 0, daysWith = 0;
  for (let i = 0; i < 56; i++) {
    const k = addDays(today, -i), v = byDay[k] || 0;
    if (v > 0) { const [y, m, d] = k.split('-').map(Number); wd[new Date(y, m - 1, d).getDay()] += v; total += v; daysWith++; }
  }
  if (daysWith >= 10 && total > 0) {
    const best = wd.indexOf(Math.max(...wd)), share = Math.round((wd[best] / total) * 100);
    if (share >= 20) add({ id: 'best-day', icon: '⭐', tone: 'info', title: `Чаще всего вы активны ${WEEKDAY_IN[best]}`, text: `${share}% XP за последние 8 недель.`, href: '#/activity', prio: 20 });
  }

  return out.sort((a, b) => b.prio - a.prio);
}
