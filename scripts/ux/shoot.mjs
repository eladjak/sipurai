#!/usr/bin/env node
/**
 * shoot.mjs - screenshot and acceptance harness for the UX overhaul (contract P1-00).
 *
 *   node scripts/ux/shoot.mjs --url <base> --states scripts/ux/states.example.json --out <dir>
 *        [--chromium <path>] [--report-only] [--only name1,name2]
 *
 * For every state it writes three PNGs (375x812 DPR2 touch, 1280x800, and a 375 shot with
 * reduced motion) and one report.json with the measurements and the checks of checks.mjs.
 * Exit code 1 when any check fails (0 with --report-only, 2 for a usage error).
 *
 * Safety: it never loads a stored login. It refuses to run against the production hosts when a
 * state injects anything that looks like a session (see README.md).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pageChecks, evaluateShot } from './checks.mjs';

const VIEWPORTS = [
  { tag: '375', width: 375, height: 812, dpr: 2, mobile: true, reduced: false },
  { tag: '1280', width: 1280, height: 800, dpr: 1, mobile: false, reduced: false },
  { tag: '375-reduced', width: 375, height: 812, dpr: 2, mobile: true, reduced: true },
];

const PRODUCTION_HOSTS = [/(^|\.)sipurai\.ai$/i];
const SESSION_LIKE = /clerk|__session|__client|token|auth|supabase|^sb-|jwt|session/i;

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
    'usage: node scripts/ux/shoot.mjs --url <base> --states <file.json> --out <dir>\n' +
    '         [--chromium <path>] [--report-only] [--only name1,name2]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const a = { reportOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--report-only') a.reportOnly = true;
    else if (['--url', '--states', '--out', '--chromium', '--only'].includes(k)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) usage(`${k} needs a value`);
      a[k.slice(2)] = v;
    } else usage(`unknown argument ${k}`);
  }
  if (!a.url) usage('--url is required');
  if (!a.states) usage('--states is required');
  if (!a.out) usage('--out is required');
  return a;
}

function assertSafe(baseUrl, states) {
  const host = new URL(baseUrl).hostname;
  if (!PRODUCTION_HOSTS.some((re) => re.test(host))) return;
  for (const s of states) {
    const setup = s.setup || {};
    const keys = [...Object.keys(setup.localStorage || {}), ...Object.keys(setup.sessionStorage || {})];
    const bad = keys.filter((k) => SESSION_LIKE.test(k));
    if (bad.length || setup.cookies) {
      throw new Error(
        `refusing to run: ${host} is production and state "${s.name}" injects session-like data ` +
        `(${[...bad, setup.cookies ? 'cookies' : ''].filter(Boolean).join(', ')}). ` +
        'Signed-out states only on production.',
      );
    }
  }
}

function loadStates(file, only) {
  let states;
  try {
    states = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    usage(`cannot read states file ${file}: ${e.message}`);
  }
  if (!Array.isArray(states) || !states.length) usage('states file must be a non-empty JSON array');
  const names = new Set();
  for (const s of states) {
    if (!s.name || !/^[\w.-]+$/.test(s.name)) usage(`every state needs a "name" of letters, digits, _ . - (got ${JSON.stringify(s.name)})`);
    if (names.has(s.name)) usage(`duplicate state name ${s.name}`);
    names.add(s.name);
    if (typeof s.path !== 'string' || !s.path.startsWith('/')) usage(`state ${s.name}: "path" must start with /`);
  }
  if (only) {
    const want = new Set(only.split(',').map((x) => x.trim()).filter(Boolean));
    states = states.filter((s) => want.has(s.name));
    if (!states.length) usage(`--only matched no state`);
  }
  return states;
}

const SLOW_4G = { offline: false, latency: 562, downloadThroughput: (1.6 * 1024 * 1024) / 8 * 0.9, uploadThroughput: (750 * 1024) / 8 * 0.9 };

async function runActions(page, context, cdp, actions) {
  for (const act of actions) {
    if (act.click) await page.click(act.click, { timeout: 8000 });
    else if (act.fill) await page.fill(act.fill, String(act.value ?? ''), { timeout: 8000 });
    else if (act.press) {
      if (act.on) await page.press(act.on, act.press, { timeout: 8000 });
      else await page.keyboard.press(act.press);
    } else if (act.hover) await page.hover(act.hover, { timeout: 8000 });
    else if (act.waitFor) await page.waitForSelector(act.waitFor, { timeout: 10000 });
    else if (act.throttle) {
      if (act.throttle !== 'slow-4g') throw new Error(`unknown throttle ${act.throttle}`);
      await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
    } else if (act.offline !== undefined) await context.setOffline(!!act.offline);
    else throw new Error(`unknown action ${JSON.stringify(act)}`);
    await page.waitForTimeout(150);
  }
}

async function shootOne(browser, base, state, vp, outDir) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: 'he-IL',
    reducedMotion: vp.reduced ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const shot = {
    state: state.name,
    viewport: vp.tag,
    size: `${vp.width}x${vp.height}`,
    file: `${state.name}-${vp.tag}.png`,
    requestedUrl: '',
    finalUrl: '',
    status: null,
    consoleErrors: [],
    failures: [],
  };
  const consoleErrors = shot.consoleErrors;
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`));

  const setup = state.setup || {};
  if (setup.localStorage || setup.sessionStorage) {
    await page.addInitScript(({ ls, ss }) => {
      try { for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) { /* storage blocked */ }
      try { for (const [k, v] of Object.entries(ss || {})) sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) { /* storage blocked */ }
    }, { ls: setup.localStorage, ss: setup.sessionStorage });
  }

  const actions = [...(state.actions || [])];
  const cdp = await context.newCDPSession(page);
  // a throttle listed before anything else applies from the first request
  const early = [];
  while (actions.length && actions[0].throttle) early.push(actions.shift());
  const rest = actions;
  shot.requestedUrl = new URL(state.path + (setup.query || ''), base).toString();
  try {
    await runActions(page, context, cdp, early);
    const resp = await page.goto(shot.requestedUrl, { waitUntil: 'load', timeout: 30000 });
    shot.status = resp ? resp.status() : null;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch (e) {
    shot.navigationError = String(e.message).split('\n')[0];
  }
  if (!shot.navigationError) {
    if (state.waitFor) {
      try { await page.waitForSelector(state.waitFor, { timeout: 10000 }); }
      catch (e) { shot.waitForError = `${state.waitFor}`; }
    }
    try { await runActions(page, context, cdp, rest); }
    catch (e) { shot.actionError = String(e.message).split('\n')[0]; }
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    // let finite animations (entry splash, fades) finish so the shot and the checks see the settled page;
    // endless loops are ignored. Capped at 6 s.
    await page.evaluate(async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const running = document.getAnimations().filter((a) => a.playState === 'running'
          && a.effect && a.effect.getComputedTiming().iterations !== Infinity);
        if (!running.length) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }).catch(() => {});
    await page.waitForTimeout(vp.reduced ? 200 : 500);
    try { shot.page = await page.evaluate(pageChecks); }
    catch (e) { shot.actionError = (shot.actionError ? shot.actionError + '; ' : '') + `checks could not run: ${String(e.message).split('\n')[0]}`; }
    shot.finalUrl = page.url();
    await page.screenshot({ path: path.join(outDir, shot.file), fullPage: true });
  }
  shot.failures = evaluateShot(shot);
  shot.pass = shot.failures.length === 0;
  await context.close();
  return shot;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const states = loadStates(args.states, args.only);
  assertSafe(args.url, states);
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const exe = args.chromium || process.env.UX_CHROMIUM || undefined;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  } catch (e) {
    console.error(`cannot launch Chromium${exe ? ` at ${exe}` : ''}: ${String(e.message).split('\n')[0]}`);
    console.error('hint: pass --chromium <path>, e.g. /root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
    process.exit(2);
  }

  const shots = [];
  const produced = [];
  try {
    for (const state of states) {
      for (const vp of VIEWPORTS) {
        const shot = await shootOne(browser, args.url, state, vp, outDir);
        shots.push(shot);
        if (fs.existsSync(path.join(outDir, shot.file))) produced.push(shot.file);
        console.log(`${shot.pass ? 'PASS' : 'FAIL'}  ${shot.state} @ ${shot.viewport}  ${shot.failures.length} issue(s)`);
        for (const f of shot.failures) console.log(`      - ${f}`);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = shots.filter((s) => !s.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: args.url,
    totals: { shots: shots.length, passed: shots.length - failed.length, failed: failed.length },
    shots: shots.map((s) => ({
      state: s.state,
      viewport: s.viewport,
      size: s.size,
      file: fs.existsSync(path.join(outDir, s.file)) ? s.file : null,
      requestedUrl: s.requestedUrl,
      finalUrl: s.finalUrl,
      status: s.status,
      lang: s.page?.lang ?? null,
      dir: s.page?.dir ?? null,
      scrollWidth: s.page?.overflow.scrollWidth ?? null,
      clientWidth: s.page?.overflow.clientWidth ?? null,
      interactiveCount: s.page?.interactiveCount ?? null,
      smallTargets: s.page?.smallTargets ?? [],
      contrast: s.page?.contrast ?? null,
      imagesWithoutAlt: s.page?.imagesWithoutAlt ?? [],
      unnamedControls: s.page?.unnamedControls ?? [],
      consoleErrors: s.consoleErrors,
      navigationError: s.navigationError ?? null,
      failures: s.failures,
      pass: s.pass,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  produced.push('report.json');

  console.log('\nfiles produced in ' + outDir + ':');
  for (const f of produced) console.log('  ' + path.join(outDir, f));
  console.log(`\n${report.totals.passed}/${report.totals.shots} shots pass` + (args.reportOnly ? ' (--report-only: exit 0)' : ''));
  process.exit(failed.length && !args.reportOnly ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(2);
});
