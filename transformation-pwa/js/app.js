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

nav.replaceChildren(...ROUTES.filter(r => r.nav).map(r =>
  h('a', { href: '#/' + r.id, 'data-id': r.id }, h('span', { class: 'ico', 'aria-hidden': 'true' }, r.icon), h('span', { class: 'lbl' }, r.title))));

addEventListener('hashchange', show);
show();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
