import assert from 'node:assert/strict';
import { schedule, previewInterval, MIN_EASE } from '../js/srs.js';

const fresh = { id: 'a', ease: 2.5, interval: 0, due: null, reps: 0, lapses: 0 };
const frozen = JSON.stringify(fresh);

let c = schedule(fresh, 4, '2025-01-01');
assert.equal(JSON.stringify(fresh), frozen, 'вход не мутируется');
assert.equal(c.interval, 1); assert.equal(c.due, '2025-01-02'); assert.equal(c.reps, 1);

c = schedule(c, 4, '2025-01-02');
assert.equal(c.interval, 6); assert.equal(c.due, '2025-01-08');

const prev = c.interval;
c = schedule(c, 4, '2025-01-08');
assert.equal(c.interval, Math.round(prev * 2.5)); // 15
assert.ok(c.interval > 6);
const c2 = schedule(c, 5, '2025-01-23');
assert.ok(c2.interval > c.interval && c2.ease > c.ease);

// сброс при оценке < 3
const lapsed = schedule(c2, 2, '2025-02-01');
assert.equal(lapsed.interval, 1); assert.equal(lapsed.reps, 0); assert.equal(lapsed.lapses, 1);
assert.equal(lapsed.due, '2025-02-02');
assert.equal(lapsed.ease, c2.ease);

// ease не падает ниже 1.3
let e = { ...fresh, reps: 2, interval: 6 };
for (let i = 0; i < 30; i++) e = schedule(e, 3, '2025-01-01');
assert.equal(e.ease, MIN_EASE);

// переход через границу месяца/года
assert.equal(schedule({ ...fresh, reps: 1 }, 4, '2025-12-30').due, '2026-01-05');
assert.equal(previewInterval(fresh, 1), 1);
assert.equal(previewInterval({ ...fresh, reps: 1 }, 5), 6);
console.log('srs: все проверки пройдены');
