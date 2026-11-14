/**
 * Design check - run with `npm run test:design`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The maintainer kept finding the same small design faults by eye: boxes
 * touching with no gap, a row of tabs pressed onto a divider line (the
 * Dashboard's Invoices / Cancelled / Trash tabs, fixed in ae21248), screens
 * scrolling sideways on a phone. "Once built, it should not change."
 *
 * So this opens every main screen at 1366x768 and 390x844 on a fixed set of
 * demo books (tests/design-seed.mjs) with the browser clock frozen, and:
 *   1. runs the rules in tests/design-rules.js (no baseline needed):
 *      no sideways scroll, boxes at least MIN_GAP px from a line or another
 *      box, no overlapping controls, no cut-off button / label text;
 *   2. compares a screenshot of each screen with tests/design-baseline/,
 *      so a screen that changes by accident fails.
 *
 * Usage:
 *   npm run test:design               # starts its own app on fresh books
 *   npm run test:design -- --update   # after an INTENDED change: new baselines
 *   APP_URL=http://localhost:47405 node tests/design-check.mjs   # a running test app
 *   DESIGN_OUT=<folder>               # where problem shots and diffs go
 *   DESIGN_ONLY=dashboard,settings    # only screens whose name starts so
 *
 * Needs a build (`npx vite build`): the app serves dist/.
 */
import { firefox } from 'playwright';
import { PNG } from 'pngjs';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';
import { designAudit } from './design-rules.js';
import { seedBooks, FROZEN_AT } from './design-seed.mjs';
import { SCREENS, ALLOW } from './design-screens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASELINE_DIR = path.join(HERE, 'design-baseline');
const OUT = process.env.DESIGN_OUT || path.join(os.tmpdir(), 'design-check');
const UPDATE = process.argv.includes('--update');
const ONLY = (process.env.DESIGN_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = [{ width: 1366, height: 768 }, { width: 390, height: 844 }];
const MIN_GAP = 4;            // px between a box and a line or another box
const PIXEL_TOLERANCE = 40;   // per channel, 0-255: anti-aliasing noise
const MAX_CHANGED = 0.003;    // share of pixels that may differ (0.3%)
const PROBLEM_SHOTS = 6;      // outlined screenshots per screen and width

let serverProc = null;
let booksDir = null;

/** A running test app (APP_URL), or our own on a fresh, empty books folder. */
async function startServer() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('No build found: run `npx vite build` first.');
  booksDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-design-'));
  fs.mkdirSync(path.join(booksDir, 'data'));
  fs.writeFileSync(path.join(booksDir, 'data', 'port.txt'), '47405');
  serverProc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, FGSB_HOME: booksDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the app did not start within 30s')), 30_000);
    serverProc.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolve(m[0]); }
    });
    serverProc.on('error', reject);
  });
}

async function stopServer() {
  if (serverProc && serverProc.exitCode === null) {
    const gone = new Promise((r) => serverProc.once('exit', r));
    serverProc.kill();
    await gone;
  }
  // The temporary books go too (Windows can hold the files a moment longer).
  for (let i = 0; booksDir && i < 6; i += 1) {
    try { fs.rmSync(booksDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
}

/** Waits until the screen has stopped loading and moving. */
async function settle(page) {
  let quiet = 0;
  for (let i = 0; i < 60 && quiet < 3; i += 1) {
    const busy = await page.evaluate(() => window.__dcBusy > 0 || !!document.querySelector('.view-loading, .spin, [aria-busy="true"]')).catch(() => true);
    quiet = busy ? 0 : quiet + 1;
    await sleep(150);
  }
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await sleep(250);
}

/** Things that differ by machine or by day, not by design: covered in the screenshot. */
async function markMasks(page, selectors, port) {
  await page.evaluate(({ selectors, port }) => {
    document.querySelectorAll('[data-dc-mask]').forEach((e) => e.removeAttribute('data-dc-mask'));
    const leafs = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim());
    for (const e of leafs) {
      const t = e.textContent;
      // Versions (the app's, Node's), the port, folder paths and sizes.
      if (/\bv?\d+\.\d+\.\d+\b|localhost:\d+|\d\s?(KB|MB|GB|bytes)\b|[A-Z]:\\|\/tmp\//.test(t) || t.trim() === port) e.setAttribute('data-dc-mask', '');
    }
    for (const sel of selectors) document.querySelectorAll(sel).forEach((e) => e.setAttribute('data-dc-mask', ''));
  }, { selectors, port });
}

function comparePng(basePath, png) {
  const base = PNG.sync.read(fs.readFileSync(basePath));
  if (base.width !== png.width || base.height !== png.height) return { share: 1, diff: null, note: `size ${base.width}x${base.height} -> ${png.width}x${png.height}` };
  const diff = new PNG({ width: png.width, height: png.height });
  let changed = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.max(Math.abs(png.data[i] - base.data[i]), Math.abs(png.data[i + 1] - base.data[i + 1]), Math.abs(png.data[i + 2] - base.data[i + 2]));
    const grey = Math.round((base.data[i] + base.data[i + 1] + base.data[i + 2]) / 3 * 0.3 + 178);
    if (d > PIXEL_TOLERANCE) { changed += 1; diff.data.set([255, 0, 0, 255], i); } else diff.data.set([grey, grey, grey, 255], i);
  }
  return { share: changed / (png.width * png.height), diff };
}

async function shoot(page, file) {
  return page.screenshot({ path: file, animations: 'disabled', caret: 'hide', mask: [page.locator('[data-dc-mask]')], maskColor: '#9ca3af' });
}

/** Red outlines on the problem's elements, scrolled into view, one screenshot. */
async function shootProblem(page, problem, file) {
  await page.evaluate((ids) => {
    const els = ids.map((id) => document.querySelector(`[data-dc="${id}"]`)).filter(Boolean);
    els.forEach((e) => e.setAttribute('data-dc-flag', ''));
    els[0]?.scrollIntoView({ block: 'center', inline: 'nearest' });
    if (!document.getElementById('dc-flag-style')) {
      const st = document.createElement('style');
      st.id = 'dc-flag-style';
      st.textContent = '[data-dc-flag]{outline:2px solid #ff0000 !important;outline-offset:0 !important;}';
      document.head.append(st);
    }
  }, problem.ids);
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  await page.evaluate(() => {
    document.querySelectorAll('[data-dc-flag]').forEach((e) => e.removeAttribute('data-dc-flag'));
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) el.scrollTo(0, 0);
  });
}

async function newPage(browser, APP, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(FROZEN_AT));
  await page.addInitScript(() => {
    // Counts requests in flight, so settle() knows when a screen has its data.
    window.__dcBusy = 0;
    const f = window.fetch;
    window.fetch = (...args) => { window.__dcBusy += 1; return f(...args).finally(() => { window.__dcBusy -= 1; }); };
  });
  // Nothing from the internet: the update check asks GitHub, and its answer changes.
  await page.route('**/api/check-update*', (r) => r.fulfill({ json: { current: '0', latest: '0', updateAvailable: false } }));
  await page.route((url) => !url.href.startsWith(APP), (r) => r.abort());
  // The Trash and the daily backups are dated by the server's real clock:
  // today, every run. They get the frozen date.
  const frozen = new Date(FROZEN_AT).toISOString();
  const redate = (pattern, fix) => page.route(pattern, async (r) => {
    if (r.request().method() !== 'GET') return r.continue();
    return r.fulfill({ json: fix(await (await r.fetch()).json()) });
  });
  await redate(/\/api\/trash$/, (list) => list.map((b) => ({ ...b, _trashedAt: frozen })));
  await redate(/\/api\/backups$/, (list) => list.slice(0, 1).map((b) => ({ ...b, date: frozen.slice(0, 10), createdAt: frozen })));
  await page.goto(APP, { waitUntil: 'networkidle' });
  await settle(page);
  return { ctx, page };
}

const APP = await startServer();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(BASELINE_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT, f));
console.log(`\nDesign check against ${APP} (Firefox)${UPDATE ? ' - updating baselines' : ''}\nOutput: ${OUT}\n`);

const started = Date.now();
const browser = await firefox.launch({ headless: true });
const failures = [];
const notes = [];
try {
  await seedBooks(APP);
  for (const viewport of VIEWPORTS) {
    const { ctx, page } = await newPage(browser, APP, viewport);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const screen of SCREENS) {
      if (ONLY.length && !ONLY.some((o) => screen.name.startsWith(o))) continue;
      if (screen.widths && !screen.widths.includes(viewport.width)) continue;
      const name = `${screen.name}-${viewport.width}`;
      try {
        await screen.go(page, viewport);
        await settle(page);
        // Every scroll box back to its start, so the screenshot shows the same part each run.
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          for (const el of document.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) el.scrollTo(0, 0);
        });
        const problems = await page.evaluate(designAudit, { minGap: MIN_GAP, allow: ALLOW });
        problems.forEach((p, n) => {
          const shot = n < PROBLEM_SHOTS ? path.join(OUT, `${name}-problem-${n + 1}.png`) : '';
          failures.push({ name, line: `${p.rule}: ${p.what.join('  <->  ')} - ${p.detail}`, shot, p });
        });
        for (const f of failures.filter((x) => x.name === name && x.shot)) await shootProblem(page, f.p, f.shot);

        // The part of the screen this one is about, at the top of the shot.
        if (screen.focus) await page.locator(screen.focus).first().evaluate((e) => { e.style.scrollMarginTop = '72px'; e.scrollIntoView({ block: 'start' }); });
        await markMasks(page, ALLOW.mask, new URL(APP).port);
        const file = path.join(BASELINE_DIR, `${name}.png`);
        const current = path.join(OUT, `${name}.png`);
        await shoot(page, current);
        if (UPDATE || !fs.existsSync(file)) {
          fs.copyFileSync(current, file);
          if (!UPDATE) notes.push(`${name}: no baseline yet - saved one`);
        } else {
          const { share, diff, note } = comparePng(file, PNG.sync.read(fs.readFileSync(current)));
          if (share > MAX_CHANGED) {
            const diffFile = path.join(OUT, `${name}-diff.png`);
            if (diff) fs.writeFileSync(diffFile, PNG.sync.write(diff));
            failures.push({ name, line: `changed: ${(share * 100).toFixed(2)}% of the screen differs from tests/design-baseline/${name}.png${note ? ` (${note})` : ''}`, shot: diff ? diffFile : current });
          } else if (share > 0) notes.push(`${name}: ${(share * 100).toFixed(3)}% pixels differ (within ${MAX_CHANGED * 100}%)`);
        }
        const mine = failures.filter((x) => x.name === name);
        console.log(`  ${mine.length ? '✗' : '✓'} ${name}${mine.length ? `  (${mine.length})` : ''}`);
      } catch (err) {
        const shot = path.join(OUT, `${name}-did-not-open.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        failures.push({ name, line: `could not open the screen: ${err.message.split('\n')[0]}`, shot });
        console.log(`  ✗ ${name}  (did not open)`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
    if (errors.length) failures.push({ name: `app-${viewport.width}`, line: `page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`, shot: '' });
    await ctx.close();
  }
} catch (err) {
  failures.push({ name: 'setup', line: err.message, shot: '' });
} finally {
  await browser.close();
  await stopServer();
}

for (const n of notes) console.log(`  note: ${n}`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log(`\n  [${f.name}] ${f.line}${f.shot ? `\n    screenshot: ${f.shot}` : ''}`);
}
console.log(`\nDesign check ${failures.length ? 'FAILED' : 'passed'} in ${Math.round((Date.now() - started) / 1000)}s.`);
if (failures.some((f) => f.line.startsWith('changed:'))) console.log('If a change was intended: look at the -diff.png images, then run `npm run test:design -- --update`.');
process.exit(failures.length ? 1 : 0);
