// E2E: node tests/e2e.mjs   (requires `playwright` + chromium, python3)
import { createRequire } from 'module';
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = ['home', 'habits', 'workout', 'learn', 'health', 'languages', 'plan', 'settings'];
const results = []; // {name, ok, why}
const rec = (name, ok, why = '') => { results.push({ name, ok, why }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${why ? '  -> ' + why : ''}`); };

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const port = await freePort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break; } catch { await sleep(100); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  let errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('sw.js') && !r.url().includes('favicon')) errs.push(`HTTP ${r.status()}: ${r.url()}`); });
  const settle = async () => { await page.waitForLoadState('load'); await sleep(400); };

  // 1. open + onboarding redirect
  try {
    await page.goto(base);
    await settle();
    const hash = await page.evaluate(() => location.hash);
    rec('open -> onboarding redirect to #/plan', hash.startsWith('#/plan'), `hash=${hash}`);
  } catch (e) { rec('open', false, e.message); }

  // 2. onboarding: try to complete it through the UI; fallback: set store flag
  let onboarded = false;
  try {
    const key = await page.evaluate(() => Object.keys(localStorage));
    const btn = page.locator('main button, #app button').first();
    if (await btn.count()) { /* best effort: click primary-looking buttons */
      for (const t of [/начать|далее|продолж|готово|старт|сохран/i]) {
        const b = page.getByRole('button', { name: t }).first();
        for (let i = 0; i < 6 && await b.count() && await b.isVisible().catch(() => false); i++) { await b.click().catch(() => {}); await sleep(200); }
      }
    }
    onboarded = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) { try { const o = JSON.parse(localStorage[k]); if (o && o.profile && o.profile.onboarded) return true; } catch {} }
      return false;
    });
    if (!onboarded) {
      // fallback: flip the flag directly in whichever key holds the store
      onboarded = await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) { try { const o = JSON.parse(localStorage[k]); if (o && o.profile) { o.profile.onboarded = true; localStorage[k] = JSON.stringify(o); return true; } } catch {} }
        return false;
      });
      if (onboarded) { await page.reload(); await settle(); }
    }
    rec('onboarding done (via UI, else store flag fallback)', onboarded, onboarded ? (key.length ? 'keys=' + key.join(',') : '') : 'plan view not implemented yet or store key not found; keys=' + key.join(','));
  } catch (e) { rec('onboarding', false, e.message); }

  // 3. routes
  for (const r of ROUTES) {
    errs = [];
    try {
      await page.goto(base + '#/' + r);
      await settle();
      const hash = await page.evaluate(() => location.hash);
      const problems = [];
      if (!onboarded && r !== 'plan') problems.push('not onboarded; redirected to ' + hash);
      const errCard = await page.locator('.error').count();
      if (errCard) problems.push('.error card: ' + (await page.locator('.error').first().innerText()).slice(0, 160));
      if (errs.length) problems.push(errs.slice(0, 3).join(' | '));
      const sc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (sc.sw > sc.cw) problems.push(`horizontal scroll ${sc.sw}>${sc.cw}`);
      const empty = await page.evaluate(() => document.getElementById('app').children.length === 0);
      if (empty) problems.push('empty #app');
      rec('route ' + r, problems.length === 0, problems.join(' ; '));
    } catch (e) { rec('route ' + r, false, 'exception: ' + e.message.split('\n')[0]); }
  }

  // 4. habit create + check + persistence (best effort over unknown UI)
  errs = [];
  const HABIT = 'E2E привычка ' + Date.now();
  try {
    await page.goto(base + '#/habits'); await settle();
    const addBtn = page.getByRole('button', { name: /добав|нов|созда|\+/i }).first();
    if (!(await addBtn.count())) throw new Error('кнопка добавления привычки не найдена (view habits ещё не готов?)');
    await addBtn.click(); await sleep(300);
    const input = page.locator('input[type=text], input:not([type]), textarea').first();
    if (!(await input.count())) throw new Error('поле ввода названия не найдено');
    await input.fill(HABIT);
    const save = page.getByRole('button', { name: /сохран|добав|созда|ok|готово/i }).last();
    await save.click(); await sleep(400);
    if (!(await page.getByText(HABIT).count())) throw new Error('созданная привычка не появилась в списке');
    rec('habit created', true);
    const check = page.locator('input[type=checkbox], [role=checkbox], button.check, .check, button[aria-label*="тмет" i]').first();
    if (!(await check.count())) throw new Error('элемент отметки не найден');
    await check.click(); await sleep(300);
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    rec('habit checked (UI click went through)', true);
    await page.reload(); await settle();
    const still = await page.getByText(HABIT).count();
    rec('data persisted after reload', still > 0 && (await page.evaluate(() => JSON.stringify(localStorage))).includes('E2E'), still ? '' : 'привычка пропала после перезагрузки');
    if (errs.length) rec('no errors during habit flow', false, errs.slice(0, 3).join(' | '));
  } catch (e) { rec('habit flow', false, e.message.split('\n')[0]); }
} catch (e) {
  rec('harness', false, e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  srv.kill();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name + ': ' + f.why)); }
process.exit(failed.length ? 1 : 0);
