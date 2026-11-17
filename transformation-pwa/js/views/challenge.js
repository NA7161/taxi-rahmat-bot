// Челлендж на 12 недель. Очки берутся из XP, которые приложение уже начисляет
// за действия (привычки, тренировки, уроки и т.д.), ничего отдельно не копится.
// Недельная цель задаётся пользователем: значение по умолчанию (100 XP) выбрано произвольно.
const WEEKS = 12, DAYS = WEEKS * 7;
const NS = 'http://www.w3.org/2000/svg';

const toUTC = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);

export function render(root, ctx) {
  const { store, util: { h, today, addDays, dateKey, toast }, gamify } = ctx;

  function xpByDay() {
    const m = {};
    for (const e of store.get().gamify.events || []) {
      const k = dateKey(new Date(e.t));
      m[k] = (m[k] || 0) + (e.xp || 0);
    }
    return m;
  }

  function weekSums(start, byDay) {
    const out = [];
    for (let w = 0; w < WEEKS; w++) {
      let sum = 0;
      for (let d = 0; d < 7; d++) sum += byDay[addDays(start, w * 7 + d)] || 0;
      out.push(sum);
    }
    return out;
  }

  function chart(sums, goal, nowWeek) {
    const W = 320, H = 150, pad = 18, bw = 18, gap = (W - pad * 2 - bw * WEEKS) / (WEEKS - 1);
    const max = Math.max(goal * 1.25, ...sums, 10);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 16}`);
    svg.setAttribute('class', 'ch-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'XP по неделям челленджа');
    const el = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text != null) n.textContent = text;
      return n;
    };
    sums.forEach((v, i) => {
      const bh = Math.max(v > 0 ? 2 : 0, (v / max) * (H - 14));
      const x = pad + i * (bw + gap);
      const cls = 'b' + (i === nowWeek ? ' now' : i > nowWeek ? ' future' : '');
      svg.append(el('rect', { x, y: H - bh, width: bw, height: bh, rx: 3, class: cls }));
      svg.append(el('text', { x: x + bw / 2, y: H + 12 }, String(i + 1)));
    });
    const gy = H - (goal / max) * (H - 14);
    svg.append(el('line', { x1: pad - 4, x2: W - pad + 4, y1: gy, y2: gy, class: 'goal' }));
    return svg;
  }

  function intro(root) {
    const input = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 10, max: 5000, value: store.get().challenge.weeklyGoal, 'aria-label': 'Цель на неделю, XP' });
    const err = h('p', { class: 'field-error', role: 'alert' });
    root.append(
      h('h1', null, '🏆 Челлендж 12 недель'),
      h('div', { class: 'card ch-hero' },
        h('p', { class: 'ch-big' }, '84 дня, одна цель на неделю'),
        h('p', null, 'Каждое действие в приложении приносит XP: привычка, тренировка, урок, карточки, запись здоровья. Вы задаёте цель на неделю и смотрите, сколько недель из 12 удалось выполнить.'),
        h('p', { class: 'ch-sub' }, 'Командных рейтингов нет: приложение работает без сервера, данные только на вашем телефоне.')),
      h('div', { class: 'card' },
        h('label', null, 'Цель на неделю (XP)'),
        input, err,
        h('p', { class: 'ch-sub' }, 'Стартовое значение 100 выбрано произвольно. Посмотрите свою первую неделю и поправьте цель.'),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: () => {
            const n = Number(input.value);
            if (!Number.isInteger(n) || n < 10 || n > 5000) { err.textContent = 'Введите целое число от 10 до 5000'; input.classList.add('invalid'); input.focus(); return; }
            store.update(s => { s.challenge = { start: today(), weeklyGoal: n }; });
            // бонус за старт даём один раз за всё время, иначе перезапуск позволял бы копить XP
            if (!(store.get().gamify.events || []).some(e => e.reason === 'Челлендж: старт')) gamify.awardXP(10, 'Челлендж: старт');
            redraw();
          },
        }, 'Начать сегодня')));
  }

  function running(root, ch) {
    const t = today();
    const elapsed = Math.max(0, dayDiff(ch.start, t));
    const finished = elapsed >= DAYS;
    const nowWeek = Math.min(WEEKS - 1, Math.floor(elapsed / 7));
    const sums = weekSums(ch.start, xpByDay());
    const goal = ch.weeklyGoal;
    const total = sums.reduce((a, b) => a + b, 0);
    const doneWeeks = sums.filter(v => v >= goal).length;
    const thisXp = sums[nowWeek], pct = Math.min(100, Math.round((thisXp / goal) * 100));
    const daysLeftWeek = 7 - (elapsed % 7);
    const goalInput = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 10, max: 5000, value: goal, 'aria-label': 'Цель на неделю, XP' });
    const err = h('p', { class: 'field-error', role: 'alert' });

    root.append(
      h('h1', null, '🏆 Челлендж 12 недель'),
      h('div', { class: 'card ch-hero' },
        h('p', { class: 'ch-big' }, finished ? 'Челлендж завершён' : `Неделя ${nowWeek + 1} из ${WEEKS}`),
        h('div', { class: 'ch-bar blue', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': DAYS, 'aria-valuenow': Math.min(elapsed, DAYS) },
          h('i', { style: `width:${Math.min(100, (elapsed / DAYS) * 100)}%` })),
        h('p', { class: 'ch-sub' }, `День ${Math.min(elapsed + 1, DAYS)} из ${DAYS}. Старт: ${ch.start}`)),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' }, h('div', { class: 'ch-sub' }, 'Всего XP'), h('div', { class: 'ch-big' }, String(total))),
        h('div', { class: 'card' }, h('div', { class: 'ch-sub' }, 'Недель с целью'), h('div', { class: 'ch-big' }, `${doneWeeks} из ${WEEKS}`))),
      h('div', { class: 'card' },
        h('strong', null, finished ? 'Последняя неделя' : 'Эта неделя'),
        h('div', { class: 'ch-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': Math.min(thisXp, goal) }, h('i', { style: `width:${pct}%` })),
        h('p', { class: 'ch-sub' }, `${thisXp} из ${goal} XP (${pct}%)` + (finished ? '' : `. До конца недели дней: ${daysLeftWeek}`))),
      h('div', { class: 'card' }, h('strong', null, 'XP по неделям'), chart(sums, goal, finished ? WEEKS : nowWeek),
        h('p', { class: 'ch-sub' }, 'Пунктирная линия: ваша цель на неделю. Оранжевый столбик: текущая неделя.')),
      h('div', { class: 'card' }, h('strong', null, 'Недели'),
        h('ol', { class: 'ch-weeks' }, sums.map((v, i) => {
          const passed = i <= nowWeek;
          const ok = v >= goal;
          return h('li', { class: (i === nowWeek && !finished ? 'now ' : '') + (ok ? 'ok' : '') },
            h('span', null, `Неделя ${i + 1}`),
            h('b', null, passed ? `${v} XP${ok ? ' ✓' : ''}` : '—'));
        }))),
      h('div', { class: 'card' },
        h('label', null, 'Цель на неделю (XP)'), goalInput, err,
        h('div', { class: 'row' },
          h('button', {
            class: 'btn', type: 'button',
            onclick: () => {
              const n = Number(goalInput.value);
              if (!Number.isInteger(n) || n < 10 || n > 5000) { err.textContent = 'Введите целое число от 10 до 5000'; goalInput.classList.add('invalid'); return; }
              store.update(s => { s.challenge.weeklyGoal = n; });
              toast('Цель обновлена'); redraw();
            },
          }, 'Сохранить цель'),
          h('button', {
            class: 'btn btn-danger', type: 'button',
            onclick: () => { if (confirm('Начать челлендж заново? История XP в приложении останется, сбросится только старт челленджа.')) { store.update(s => { s.challenge.start = null; }); redraw(); } },
          }, 'Начать заново'))));
  }

  function redraw() {
    root.replaceChildren();
    const ch = store.get().challenge;
    if (!ch || !ch.start) intro(root); else running(root, ch);
  }
  redraw();
}
