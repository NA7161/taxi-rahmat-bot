// Вибро-отклик. Работает только там, где браузер поддерживает navigator.vibrate
// (Android Chrome да; iPhone/Safari нет). Можно выключить в настройках.
import { store } from './store.js';

const PATTERNS = { light: 8, success: [12, 50, 12] };

export function hapticsOn() {
  return store.get().settings.haptics !== false;
}

export function haptic(kind = 'light') {
  try {
    if (!hapticsOn() || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(PATTERNS[kind] || PATTERNS.light);
  } catch (e) { /* вибро недоступно: ничего не делаем */ }
}

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
