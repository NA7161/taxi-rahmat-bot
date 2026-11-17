// Интервальные повторения по алгоритму SM-2 (чистые функции, без побочных эффектов).
// Источник: P. A. Wozniak, "SuperMemo 2" (1987); описание: https://super-memory.com/english/ol/sm2.htm
//
// Оценка q = 0..5 (q < 3 — не вспомнил).
//   q < 3:   reps = 0, interval = 1 день, lapses += 1 (ease не меняется)
//   q >= 3:  reps = 0 -> interval = 1; reps = 1 -> interval = 6;
//            иначе interval = round(interval_prev * EF); reps += 1
//   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), минимум 1.3 (начальное 2.5)
// Карточка: {ease, interval, due:'YYYY-MM-DD'|null, reps, lapses, ...}; новая карточка имеет due=null.

export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

function addDaysKey(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = x => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Возвращает НОВУЮ карточку; исходная не изменяется. */
export function schedule(card, grade, nowKey) {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  let ease = typeof card.ease === 'number' ? card.ease : START_EASE;
  let reps = card.reps || 0;
  let interval = card.interval || 0;
  let lapses = card.lapses || 0;
  if (q < 3) {
    reps = 0; interval = 1; lapses += 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    reps += 1;
    ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (ease < MIN_EASE) ease = MIN_EASE;
  }
  ease = Math.round(ease * 1000) / 1000;
  return { ...card, ease, interval, reps, lapses, due: addDaysKey(nowKey, interval) };
}

/** Через сколько дней карточка вернётся при данной оценке (для подписи на кнопке). */
export function previewInterval(card, grade) {
  return schedule(card, grade, '2000-01-01').interval;
}
