import { store } from '../store.js';
import { h, toast } from '../util.js';
import * as rem from '../reminders.js';

export const VERSION = '1.0.0';
const THEMES = [['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']];

/** Применить тему из настроек. Вызывать при старте приложения. */
export function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
applyTheme();

let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
addEventListener('appinstalled', () => { deferredPrompt = null; });

const CSS = `
.set-sec{margin:0 0 14px;padding:14px}
.set-sec h2{margin:0 0 10px;font-size:1.05rem}
.set-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.set-row .input{flex:1;min-width:120px}
.set-note{font-size:.85rem;opacity:.75;margin:8px 0 0;line-height:1.4}
.set-err{color:var(--danger,#dc2626);font-size:.9rem;margin:8px 0 0}
.set-danger{border:1px solid var(--danger,#dc2626);color:var(--danger,#dc2626);background:transparent}
.chip.set-on{outline:2px solid currentColor;font-weight:600}
`;

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Проверка формата до применения (store.importJSON проверяет только v===1).
export function validate(text) {
  let p;
  try { p = JSON.parse(text); } catch (e) { throw new Error('Файл не является корректным JSON'); }
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.v !== 1) throw new Error('Неверный формат файла (нет метки v:1)');
  const objs = ['profile', 'plan', 'habits', 'workouts', 'health', 'learn', 'lang', 'gamify', 'settings'];
  for (const k of objs) if (k in p && (p[k] == null || typeof p[k] !== 'object' || Array.isArray(p[k]))) throw new Error('Повреждён раздел «' + k + '»');
  if (p.habits && p.habits.items && !Array.isArray(p.habits.items)) throw new Error('Повреждён раздел «habits»');
  if (p.learn && p.learn.cards && !Array.isArray(p.learn.cards)) throw new Error('Повреждён раздел «learn»');
  return p;
}

export function render(root, ctx) {
  applyTheme();
  const S = () => store.get().settings;
  const style = h('style', { id: 'settings-css' }); style.textContent = CSS;
  const view = h('div', null);
  root.append(style, h('h1', null, 'Настройки'), view);

  function draw() {
    view.replaceChildren(themeSec(), feelSec(), profileSec(), remindSec(), dataSec(), aboutSec());
  }

  function themeSec() {
    return h('section', { class: 'card set-sec' }, h('h2', null, 'Тема'),
      h('div', { class: 'set-row' }, THEMES.map(([v, l]) =>
        h('button', { class: 'chip' + (S().theme === v ? ' set-on' : ''), type: 'button', 'aria-pressed': String(S().theme === v),
          onclick: () => { store.update(s => { s.settings.theme = v; }); applyTheme(); draw(); } }, l))));
  }

  function feelSec() {
    const on = store.get().settings.haptics !== false;
    const supported = typeof navigator.vibrate === 'function';
    return h('section', { class: 'card set-sec' }, h('h2', null, 'Отклик'),
      h('div', { class: 'set-row' },
        h('button', { class: 'chip' + (on ? ' set-on' : ''), type: 'button', 'aria-pressed': String(on),
          onclick: () => { store.update(s => { s.settings.haptics = !on; }); draw(); } }, on ? 'Вибро-отклик: вкл' : 'Вибро-отклик: выкл')),
      h('p', { class: 'muted' }, supported ? 'Короткая вибрация при нажатиях и начислении XP.' : 'В этом браузере вибрация недоступна (например, на iPhone в Safari).'));
  }

  function profileSec() {
    const inp = h('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'Ваше имя', value: store.get().profile.name || '', 'aria-label': 'Имя' });
    const save = () => { store.update(s => { s.profile.name = inp.value.trim(); }); toast('Имя сохранено'); };
    return h('section', { class: 'card set-sec' }, h('h2', null, 'Профиль'),
      h('div', { class: 'set-row' }, inp, h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, 'Сохранить')));
  }

  function remindSec() {
    const perm = rem.permission();
    const r = S().reminders;
    const status = perm === 'unsupported' ? 'Браузер не поддерживает уведомления.'
      : perm === 'denied' ? 'Уведомления запрещены в настройках браузера или системы.'
      : perm === 'granted' ? 'Разрешение на уведомления получено.' : 'Разрешение ещё не запрошено.';
    const time = h('input', { class: 'input', type: 'time', value: r.time || '09:00', 'aria-label': 'Время напоминания',
      onchange: e => { if (!e.target.value) return; store.update(s => { s.settings.reminders.time = e.target.value; }); rem.startReminders(); toast('Время сохранено'); } });
    const toggle = async () => {
      if (!r.enabled) {
        if (rem.permission() === 'default') await rem.requestPermission();
        if (rem.permission() !== 'granted') { toast('Без разрешения напоминания не работают'); draw(); return; }
        store.update(s => { s.settings.reminders.enabled = true; });
        rem.startReminders();
      } else {
        store.update(s => { s.settings.reminders.enabled = false; });
        rem.stopReminders();
      }
      draw();
    };
    return h('section', { class: 'card set-sec' }, h('h2', null, 'Напоминание'),
      h('div', { class: 'set-row' },
        h('button', { class: 'btn ' + (r.enabled ? '' : 'btn-primary'), type: 'button', disabled: perm === 'unsupported' || perm === 'denied', onclick: toggle },
          r.enabled ? 'Выключить напоминание' : 'Включить ежедневное напоминание'),
        time),
      h('p', { class: 'set-note' }, status),
      r.enabled ? h('div', { class: 'set-row' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
        const ok = await rem.notify('Трансформация', 'Проверка уведомлений: всё работает.'); toast(ok ? 'Отправлено' : 'Не удалось показать уведомление'); } }, 'Проверить уведомление')) : null,
      h('p', { class: 'set-note' }, 'Важно: без сервера push напоминание сработает, только пока приложение открыто или находится в фоне. Если оно закрыто, уведомление может не прийти.'));
  }

  function dataSec() {
    const err = h('p', { class: 'set-err', role: 'alert', hidden: true });
    const showErr = m => { err.textContent = m; err.hidden = !m; };
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
      const f = e.target.files[0]; e.target.value = ''; showErr('');
      if (!f) return;
      try {
        if (f.size > 20 * 1024 * 1024) throw new Error('Файл слишком большой');
        const text = await f.text();
        validate(text);
        if (!confirm('Импорт заменит все текущие данные данными из файла «' + f.name + '». Продолжить?')) return;
        store.importJSON(text); applyTheme(); rem.startReminders();
        toast('Данные импортированы'); draw();
      } catch (ex) { showErr('Не удалось импортировать: ' + ex.message); }
    } });
    return h('section', { class: 'card set-sec' }, h('h2', null, 'Данные'),
      h('div', { class: 'set-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => { download('transformation-' + new Date().toISOString().slice(0, 10) + '.json', store.exportJSON()); toast('Файл сохранён'); } }, 'Экспорт в файл'),
        h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'Импорт из файла'), file),
      err,
      h('div', { class: 'set-row' }, h('button', { class: 'btn set-danger', type: 'button', onclick: () => {
        if (!confirm('Удалить ВСЕ данные приложения? Это нельзя отменить.')) return;
        if (!confirm('Точно удалить всё? Рекомендуем сначала сделать экспорт.')) return;
        store.reset(); rem.stopReminders(); applyTheme(); toast('Данные удалены'); ctx.navigate('plan');
      } }, 'Сбросить все данные')));
  }

  function aboutSec() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const note = h('p', { class: 'set-note' });
    const btn = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      if (deferredPrompt) { const d = deferredPrompt; deferredPrompt = null; d.prompt(); try { await d.userChoice; } catch (e) { /* ignore */ } }
      else note.textContent = ios ? 'В Safari нажмите «Поделиться» → «На экран Домой».' : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».';
    } }, 'Установить на экран');
    return h('section', { class: 'card set-sec' }, h('h2', null, 'О приложении'),
      h('p', { class: 'set-note' }, 'Трансформация, версия ' + VERSION + '.'),
      h('p', { class: 'set-note' }, 'Все данные хранятся только на вашем устройстве, в браузере. Мы ничего не отправляем на сервер. Делайте экспорт, чтобы не потерять данные при очистке браузера.'),
      standalone ? h('p', { class: 'set-note' }, 'Приложение уже установлено.') : h('div', { class: 'set-row' }, btn),
      standalone ? null : note);
  }

  draw();
  return () => {};
}
