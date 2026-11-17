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

  // 2. onboarding: real UI (name -> wheel -> goals -> finish); fallback: seed localStorage
  const KEY = 'transformation.v1';
  const isOnb = () => page.evaluate(k => { try { return !!JSON.parse(localStorage.getItem(k)).profile.onboarded; } catch { return false; } }, KEY);
  let onboarded = false, how = 'UI';
  try {
    await page.locator('input[type=text]').first().fill('E2E');
    await page.getByRole('button', { name: 'Далее' }).first().click(); await sleep(300);
    await page.getByRole('button', { name: 'Далее' }).first().click(); await sleep(300);
    const goalInp = page.locator('input[type=text]').first();
    if (await goalInp.count()) await goalInp.fill('E2E цель');
    await page.getByRole('button', { name: /Начать трансформацию/ }).click(); await sleep(500);
    onboarded = await isOnb();
    if (!onboarded) throw new Error('после прохождения UI profile.onboarded=false');
  } catch (e) {
    how = 'fallback seed (UI failed: ' + e.message.split('\n')[0] + ')';
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ profile: { name: 'E2E', onboarded: true, createdAt: new Date().toISOString() } })), KEY);
    await page.goto(base + '#/home'); await page.reload(); await settle();
    onboarded = await isOnb();
  }
  rec('onboarding done', how === 'UI' && onboarded, how === 'UI' ? '' : how);

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

  // 4. habit create + check + persistence
  errs = [];
  const HABIT = 'E2E привычка ' + Date.now();
  try {
    await page.goto(base + '#/habits'); await settle();
    const add = page.getByRole('button', { name: /Добавить|Создать первую/ }).first();
    if (!(await add.count())) throw new Error('кнопка добавления привычки не найдена');
    await add.click(); await sleep(300);
    await page.locator('input.input').first().fill(HABIT);
    const chips = page.locator('.hb-chips button[aria-pressed="true"]');
    if (!(await chips.count())) { // choose first day chip if none preselected
      await page.locator('.hb-chips').last().locator('button').first().click();
    }
    await page.getByRole('button', { name: 'Сохранить' }).click(); await sleep(400);
    if (!(await page.getByText(HABIT).count())) throw new Error('созданная привычка не появилась в списке');
    rec('habit created', true);
    const check = page.locator('.hb-check').first();
    await check.click(); await sleep(300);
    const pressed = await page.locator('.hb-check').first().getAttribute('aria-pressed');
    rec('habit checked', pressed === 'true', 'aria-pressed=' + pressed);
    await page.reload(); await settle();
    const still = await page.getByText(HABIT).count();
    const pressed2 = await page.locator('.hb-check').first().getAttribute('aria-pressed');
    rec('data persisted after reload', still > 0 && pressed2 === 'true', `found=${still} pressed=${pressed2}`);
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
