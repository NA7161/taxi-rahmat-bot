// Напоминания. Честно: без push-сервера уведомление сработает только пока приложение
// открыто (или свёрнуто, но не выгружено системой). Проверяем время раз в 30 секунд.
import { store } from './store.js';
import { today } from './util.js';

const LAST_KEY = 'transformation.reminder.last';
let timer = null;

export const supported = () => typeof Notification !== 'undefined';
export const permission = () => (supported() ? Notification.permission : 'unsupported');

/** Вызывать ТОЛЬКО из обработчика тапа. */
export async function requestPermission() {
  if (!supported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
}

export async function notify(title, body) {
  if (!supported() || Notification.permission !== 'granted') return false;
  const opts = { body, icon: 'icons/icon-192.png', tag: 'transformation-daily' };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
    }
  } catch (e) { /* падаем на обычный Notification */ }
  try { new Notification(title, opts); return true; } catch (e) { return false; }
}

function lastShown() { try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; } }
function markShown() { try { localStorage.setItem(LAST_KEY, today()); } catch (e) { /* ignore */ } }

export function checkNow() {
  const r = store.get().settings.reminders;
  if (!r || !r.enabled || permission() !== 'granted') return false;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (hhmm < (r.time || '09:00') || lastShown() === today()) return false;
  markShown();
  notify('Трансформация', 'Время отметить привычки и сделать шаг к цели.');
  return true;
}

/** Запустить проверку (идемпотентно). Вызывать при старте приложения. */
export function startReminders() {
  stopReminders();
  if (!store.get().settings.reminders.enabled) return;
  checkNow();
  timer = setInterval(checkNow, 30000);
  document.addEventListener('visibilitychange', onVis);
}
export function stopReminders() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVis);
}
function onVis() { if (!document.hidden) checkNow(); }
