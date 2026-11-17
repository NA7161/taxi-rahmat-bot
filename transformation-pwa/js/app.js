import { store } from './store.js';
import { h } from './util.js';
import * as util from './util.js';
import * as gamify from './gamify.js';

// Контракт вью: файл js/views/<id>.js экспортирует
//   export function render(root, ctx) { ... ; return optionalCleanup }
// ctx = { store, util, gamify, navigate(id) }
export const ROUTES = [
  { id: 'home', title: 'Сегодня', icon: '🏠', nav: true },
  { id: 'habits', title: 'Привычки', icon: '✅', nav: true },
  { id: 'workout', title: 'Спорт', icon: '💪', nav: true },
  { id: 'learn', title: 'Знания', icon: '🧠', nav: true },
  { id: 'more', title: 'Ещё', icon: '☰', nav: true },
  { id: 'challenge', title: 'Челлендж 12 недель', icon: '🏆' },
  { id: 'activity', title: 'Активность', icon: '📈' },
  { id: 'health', title: 'Здоровье', icon: '❤️' },
  { id: 'languages', title: 'Языки', icon: '🌍' },
  { id: 'plan', title: 'План', icon: '🎯' },
  { id: 'settings', title: 'Настройки', icon: '⚙️' },
];

const main = document.getElementById('app');
const nav = document.getElementById('nav');
let cleanup = null;

export function navigate(id) { location.hash = '#/' + id; }
const ctx = { store, util, gamify, navigate };

function moreView(root) {
  root.append(h('h1', null, 'Ещё'),
    h('div', { class: 'list' }, ROUTES.filter(r => !r.nav).map(r =>
      h('a', { class: 'card row', href: '#/' + r.id }, h('span', { class: 'ico' }, r.icon), h('span', null, r.title)))));
}

async function show() {
  const id = (location.hash.replace('#/', '') || 'home').split('?')[0];
  const route = ROUTES.find(r => r.id === id) || ROUTES[0];
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  main.replaceChildren();
  document.title = route.title + ' · Трансформация';
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.id === (route.nav ? route.id : 'more')));
  if (!store.get().profile.onboarded && route.id !== 'plan') { return navigate('plan'); }
  try {
    if (route.id === 'more') moreView(main);
    else {
      const mod = await import(`./views/${route.id}.js`);
      cleanup = mod.render(main, ctx) || null;
    }
  } catch (e) {
    console.error(e);
    main.replaceChildren(h('div', { class: 'card error' }, 'Не удалось открыть раздел: ' + e.message));
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Линейные значки меню (svg), рисуются через createElementNS
const NAV_ICONS = {
  home: ['M3 11.5 12 4l9 7.5', 'M5 10v10h5v-6h4v6h5V10'],
  habits: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 12.5l2.8 2.8L16 9.8'],
  workout: ['M6.5 6.5v11', 'M17.5 6.5v11', 'M3.5 9v6', 'M20.5 9v6', 'M6.5 12h11'],
  learn: ['M4 5.5A1.5 1.5 0 0 1 5.5 4H20v13H5.5A1.5 1.5 0 0 0 4 18.5z', 'M4 18.5A1.5 1.5 0 0 0 5.5 20H20v-3'],
  more: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
};
function navIcon(id) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ni'); svg.setAttribute('aria-hidden', 'true');
  for (const d of NAV_ICONS[id] || []) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p); }
  return svg;
}
nav.replaceChildren(...ROUTES.filter(r => r.nav).map(r =>
  h('a', { href: '#/' + r.id, 'data-id': r.id }, navIcon(r.id), h('span', { class: 'lbl' }, r.title))));

// Разовый переход на новое (тёмно-синее) оформление; дальше тема меняется только в настройках.
if (!store.get().settings.lookV2) store.update(s => { s.settings.theme = 'dark'; s.settings.lookV2 = true; });

// Тема и напоминания применяются при старте, не только при открытии настроек.
{
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  if (store.get().settings.reminders?.enabled) import('./reminders.js').then(m => m.startReminders()).catch(() => {});
}

// Хостинг (Netlify) может добавить плавающую плашку внизу страницы (iframe#nl-badge-frame).
// Мы её не трогаем, а поднимаем навигацию над ней, чтобы кнопки меню не перекрывались.
function fitBadge() {
  const f = document.getElementById('nl-badge-frame');
  let px = 0;
  if (f) { const r = f.getBoundingClientRect(); if (r.height && r.bottom > innerHeight - 40) px = Math.ceil(innerHeight - r.top) + 4; }
  document.documentElement.style.setProperty('--badge-h', px + 'px');
}
new MutationObserver(fitBadge).observe(document.body, { childList: true });
addEventListener('resize', fitBadge);
setTimeout(fitBadge, 600); setTimeout(fitBadge, 2000);

addEventListener('hashchange', show);
show();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
