// Проверка правил подсказок на заранее известных данных. Запуск: node tests/insights.test.mjs
import assert from 'node:assert/strict';
import { computeInsights } from '../js/insights.js';
import { dateKey, addDays } from '../js/util.js';

const now = new Date(2026, 10, 17, 19, 0, 0); // вторник 17.11.2026, 19:00
const today = dateKey(now);
const ev = (daysAgo, xp = 10, reason = 'x') => ({ t: new Date(2026, 10, 17 - daysAgo, 12).getTime(), xp, reason });
const ids = r => r.map(i => i.id);
const base = () => ({ gamify: { events: [], xp: 0 }, habits: { items: [], log: {} }, workouts: { log: [] }, health: { log: {}, goals: { water: 8, sleep: 8 } },
  learn: { cards: [], decks: [] }, lang: { progress: {} }, plan: { wheel: {}, goals: [] }, challenge: { start: null, weeklyGoal: 100 } });

// 0. нет данных
assert.deepEqual(ids(computeInsights(base(), now)), ['start']);

// 1. серия под угрозой: привычка на все дни, 4 дня подряд до вчера, сегодня не отмечено, вечер => warn
{
  const s = base(); s.gamify.events = [ev(0)];
  s.habits.items = [{ id: 'h1', name: 'Вода', days: [0, 1, 2, 3, 4, 5, 6] }];
  for (let i = 1; i <= 4; i++) s.habits.log[addDays(today, -i)] = ['h1'];
  const r = computeInsights(s, now).find(i => i.id === 'streak-h1');
  assert.ok(r, 'серия должна быть найдена'); assert.equal(r.tone, 'warn'); assert.match(r.title, /4 дн/);
  // отмечено сегодня => нет подсказки
  s.habits.log[today] = ['h1'];
  assert.ok(!computeInsights(s, now).some(i => i.id === 'streak-h1'));
  // серия 2 дня => нет подсказки
  s.habits.log = { [addDays(today, -1)]: ['h1'], [addDays(today, -2)]: ['h1'] };
  assert.ok(!computeInsights(s, now).some(i => i.id === 'streak-h1'));
}

// 2. пропуск раздела: последняя тренировка 7 дней назад
{
  const s = base(); s.gamify.events = [ev(0)]; s.workouts.log = [{ date: addDays(today, -7) }];
  const r = computeInsights(s, now).find(i => i.id === 'gap-workout');
  assert.ok(r); assert.match(r.title, /7 дн/);
  // раздел ни разу не использовался => не напоминаем
  assert.ok(!computeInsights(base(), now).some(i => i.id === 'gap-workout'));
}

// 3. челлендж: старт 3 дня назад (неделя 1), цель 100, набрано 40 => осталось 60, 4 дня, по 15 в день
{
  const s = base(); s.challenge = { start: addDays(today, -3), weeklyGoal: 100 };
  s.gamify.events = [ev(3, 20), ev(1, 20)];
  const r = computeInsights(s, now).find(i => i.id === 'ch-pace');
  assert.ok(r); assert.match(r.title, /60 XP/); assert.match(r.text, /Дней осталось: 4/); assert.match(r.text, /15 XP в день/);
  s.gamify.events.push(ev(0, 70));
  assert.ok(computeInsights(s, now).some(i => i.id === 'ch-done'));
}

// 4. динамика: 7 дней = 100, прошлые 7 = 50 => рост 100%; обратный случай => падение
{
  const s = base(); s.gamify.events = [ev(1, 100), ev(8, 50)];
  assert.match(computeInsights(s, now).find(i => i.id === 'xp-up').title, /100%/);
  s.gamify.events = [ev(1, 20), ev(8, 100)];
  assert.match(computeInsights(s, now).find(i => i.id === 'xp-down').title, /80%/);
}

// 5. вода: 3 записи 3,4,5 при цели 8 => среднее 4, ниже 70%
{
  const s = base(); s.gamify.events = [ev(0)];
  s.health.log = { [addDays(today, 0)]: { water: 3 }, [addDays(today, -1)]: { water: 4 }, [addDays(today, -2)]: { water: 5 } };
  const r = computeInsights(s, now).find(i => i.id === 'water-low');
  assert.ok(r); assert.match(r.text, /4 из 8/);
  // сон: 6,6,6 при цели 8
  s.health.log = { [today]: { sleep: 6 }, [addDays(today, -1)]: { sleep: 6 }, [addDays(today, -2)]: { sleep: 6 } };
  assert.ok(computeInsights(s, now).some(i => i.id === 'sleep-low'));
  // меньше 3 записей => молчим
  s.health.log = { [today]: { water: 1 } };
  assert.ok(!computeInsights(s, now).some(i => i.id === 'water-low'));
}

// 6. слабая сфера без цели
{
  const s = base(); s.gamify.events = [ev(0)];
  s.plan.wheel = { health: 3, sport: 6, knowledge: 7, languages: 6, discipline: 5, finance: 6 };
  assert.match(computeInsights(s, now).find(i => i.id === 'wheel-gap').title, /Здоровье/);
  s.plan.goals = [{ id: 'g', sphere: 'health', done: false }];
  assert.ok(!computeInsights(s, now).some(i => i.id === 'wheel-gap'));
  // «Языки» (id languages) участвуют в сравнении и называются по-русски
  s.plan.goals = [];
  s.plan.wheel = { health: 6, sport: 6, knowledge: 7, languages: 2, discipline: 5, finance: 6 };
  assert.match(computeInsights(s, now).find(i => i.id === 'wheel-gap').title, /Языки/);
  // колесо не заполняли (везде одинаково) => ложной подсказки нет
  s.plan.wheel = { health: 5, sport: 5, knowledge: 5, languages: 5, discipline: 5, finance: 5 };
  assert.ok(!computeInsights(s, now).some(i => i.id === 'wheel-gap'));
}

// 7. лучший день недели: 12 дней активности, во вторники (17.11 и ещё) больше всего
{
  const s = base(); s.gamify.events = [];
  for (let i = 0; i < 12; i++) s.gamify.events.push(ev(i, 10));
  s.gamify.events.push(ev(7, 200)); // 10.11, тоже вторник
  const r = computeInsights(s, now).find(i => i.id === 'best-day');
  assert.ok(r); assert.match(r.title, /во вторник/);
}

// порядок: подсказки отсортированы по важности
{
  const s = base(); s.gamify.events = [ev(1, 100), ev(8, 50)];
  s.habits.items = [{ id: 'h1', name: 'Вода', days: [0, 1, 2, 3, 4, 5, 6] }];
  for (let i = 1; i <= 4; i++) s.habits.log[addDays(today, -i)] = ['h1'];
  const r = computeInsights(s, now);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].prio >= r[i].prio);
  assert.equal(r[0].id, 'streak-h1');
}

console.log('insights: все проверки пройдены');
