// ЗАГЛУШКА-КОНТРАКТ. Агент gamify полностью заменяет реализацию, сохраняя экспорты.
import { store } from './store.js';

/** Начислить XP. Все модули вызывают ТОЛЬКО эту функцию. */
export function awardXP(amount, reason) {
  store.update(s => {
    s.gamify.xp += amount;
    s.gamify.events.push({ t: Date.now(), xp: amount, reason });
    if (s.gamify.events.length > 500) s.gamify.events.splice(0, s.gamify.events.length - 500);
  });
}
/** @returns {{level:number, xpInLevel:number, xpForNext:number, total:number}} */
export function levelInfo() {
  const total = store.get().gamify.xp;
  const level = Math.floor(Math.sqrt(total / 50)) + 1;
  const base = 50 * (level - 1) ** 2, next = 50 * level ** 2;
  return { level, xpInLevel: total - base, xpForNext: next - base, total };
}
