#!/usr/bin/env node
/**
 * shoot.mjs - screenshot and acceptance harness for the UX overhaul (contract P1-00).
 *
 *   node scripts/ux/shoot.mjs --url <base> --states <file.json> --out <dir>
 *        [--chromium <path>] [--report-only] [--only a,b] [--overwrite] [--allow-host <host,...>]
 *   node scripts/ux/shoot.mjs --self-test [--chromium <path>]
 *
 * For every state it writes three PNGs (375x812 DPR2 touch, 1280x800, 375 with reduced motion)
 * and one report.json. Exit 1 when any check FAILS (0 with --report-only), 2 for a usage error or
 * a refused run. Text whose contrast cannot be established is reported as "needs human eye" and is
 * never counted as a pass.
 *
 * Security policy (all enforced on parsed hostnames, never substrings):
 *  - Production = sipurai.ai and every subdomain. A run against production is refused if ANY
 *    credential-like input exists: any localStorage/sessionStorage entry, cookies, headers, a
 *    `fill` action, URL userinfo, or a credential-like option. Signed-out shots only.
 *  - Credential-like input is refused for every host except localhost / 127.0.0.1 / ::1 and hosts
 *    passed explicitly with --allow-host (never a production host).
 *  - Every request, redirect and frame is checked: a credentialed run aborts any request to a
 *    production host. State paths must stay on the base origin.
 *  - Output: written only inside the resolved real --out directory, with exclusive, symlink-refusing
 *    file creation; a non-empty --out is refused unless --overwrite.
 *  - --chromium and the states file are trusted operator input: never feed this script an
 *    untrusted browser binary or states file.
 */
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, domainToASCII } from 'node:url';
import { pageChecks, evaluateShot, verdictOf, FIXTURES } from './checks.mjs';

const VIEWPORTS = [
  { tag: '375', width: 375, height: 812, dpr: 2, mobile: true, reduced: false },
  { tag: '1280', width: 1280, height: 800, dpr: 1, mobile: false, reduced: false },
  { tag: '375-reduced', width: 375, height: 812, dpr: 2, mobile: true, reduced: true },
];

const CREDENTIAL_OPTION = /cookie|header|token|auth|credential|storage[-_]?state|session|password|secret/i;
const CREDENTIAL_QUERY = /token|secret|pass(word|wd)?|pwd|auth|session|jwt|key|code|sig(nature)?|bearer|credential|cookie/i;

class Refused extends Error {}

// ------------------------------------------------------------------ host policy (parsed hostnames)
// One normalisation for every host decision: brackets off, lower case, ALL trailing dots off, IDNA/punycode.
const bare = (h) => {
  let x = String(h).trim().replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '');
  if (!x.includes(':')) x = domainToASCII(x) || x;
  return x.replace(/\.+$/, '');
};
export const isProductionHost = (h) => { h = bare(h); return h === 'sipurai.ai' || h.endsWith('.sipurai.ai'); };
const isLocalHost = (h) => ['localhost', '127.0.0.1', '::1'].includes(bare(h));

/** Credential-like names in the query or fragment of a URL (the fragment is read as key=value pairs too). */
function urlCredentialNames(u) {
  const names = [...u.searchParams.keys()];
  const frag = u.hash.replace(/^#/, '');
  if (frag) {
    const afterQ = frag.includes('?') ? frag.slice(frag.indexOf('?') + 1) : frag;
    const keys = [...new URLSearchParams(afterQ).keys()];
    names.push(...(keys.length ? keys : [frag]));
  }
  return names.filter((k) => CREDENTIAL_QUERY.test(k));
}

/** Decided on the FULLY RESOLVED target of every state (base + path + setup.query), wherever the parameter came from. */
export function credentialReasons(states, base) {
  const why = [];
  for (const s of states) {
    const st = s.setup || {};
    if (st.localStorage && Object.keys(st.localStorage).length) why.push(`state "${s.name}": localStorage entries`);
    if (st.sessionStorage && Object.keys(st.sessionStorage).length) why.push(`state "${s.name}": sessionStorage entries`);
    if (st.cookies) why.push(`state "${s.name}": cookies`);
    if (st.headers) why.push(`state "${s.name}": headers`);
    if ((s.actions || []).some((a) => a && a.fill !== undefined)) why.push(`state "${s.name}": fill action (typed input)`);
    const target = new URL(s.path + (st.query || ''), base);
    if (target.username || target.password) why.push(`state "${s.name}": URL userinfo`);
    const names = urlCredentialNames(target);
    if (names.length) why.push(`state "${s.name}": credential-like URL parameter (${names.join(', ')})`);
  }
  return why;
}

export function assertSafe(baseUrl, states, allowHosts = []) {
  let base;
  try { base = new URL(baseUrl); } catch { throw new Refused(`--url is not a valid URL: ${baseUrl}`); }
  if (!['http:', 'https:'].includes(base.protocol)) throw new Refused('--url must be http or https');
  if (base.username || base.password) throw new Refused('refusing: URL userinfo is a credential');
  const host = bare(base.hostname);
  for (const a of allowHosts) {
    if (isProductionHost(a)) throw new Refused(`--allow-host ${a} is a production host; credentials are never allowed there`);
  }
  for (const s of states) {
    if (s.path.startsWith('//') || s.path.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(s.path)) {
      throw new Refused(`state "${s.name}": path must be a plain absolute path on the base origin`);
    }
    const target = new URL(s.path + ((s.setup && s.setup.query) || ''), base);
    if (target.origin !== base.origin) throw new Refused(`state "${s.name}": resolves to ${target.origin}, not the base origin ${base.origin}`);
    if (target.username || target.password) throw new Refused(`state "${s.name}": URL userinfo is a credential`);
  }
  const creds = credentialReasons(states, base);
  if (creds.length && isProductionHost(host)) {
    throw new Refused(`refusing: ${host} is production and credential-like input was supplied (${creds.join('; ')}). Signed-out states only on production.`);
  }
  if (creds.length && !isLocalHost(host) && !allowHosts.map(bare).includes(host)) {
    throw new Refused(`refusing: credential-like input for ${host}, which is not localhost and not passed with --allow-host (${creds.join('; ')})`);
  }
  return { credentialed: creds.length > 0, baseHost: host };
}

/** Request-level rule: a credentialed run must not talk to a production host at all. */
export function shouldBlockRequest(requestUrl, credentialed) {
  let u;
  try { u = new URL(requestUrl); } catch { return false; }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) return false;
  return credentialed && isProductionHost(u.hostname);
}

// ------------------------------------------------------------------ output boundary
const O_NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
const FILE_NAME = /^[A-Za-z0-9_][\w.-]*$/;

export function prepareOut(outArg, overwrite) {
  const abs = path.resolve(outArg);
  let st = null;
  try { st = fs.lstatSync(abs); } catch { /* does not exist yet */ }
  if (st) {
    if (st.isSymbolicLink()) throw new Refused(`refusing: --out ${abs} is a symlink`);
    if (!st.isDirectory()) throw new Refused(`refusing: --out ${abs} exists and is not a directory`);
    if (fs.readdirSync(abs).length && !overwrite) throw new Refused(`refusing: --out ${abs} is not empty (pass --overwrite to write into it)`);
  } else fs.mkdirSync(abs, { recursive: true });
  const real = fs.realpathSync(abs);
  return { root: real, overwrite };
}

export function safeWrite(out, name, data) {
  if (!FILE_NAME.test(name) || name.includes('..')) throw new Refused(`refusing: unsafe output file name ${JSON.stringify(name)}`);
  const target = path.join(out.root, name);
  if (path.dirname(target) !== out.root) throw new Refused(`refusing: ${name} would leave the output directory`);
  let st = null;
  try { st = fs.lstatSync(target); } catch { /* new file */ }
  if (st) {
    if (st.isSymbolicLink()) throw new Refused(`refusing: ${target} is a symlink`);
    if (!out.overwrite) throw new Refused(`refusing: ${target} already exists`);
    fs.unlinkSync(target);
  }
  const fd = fs.openSync(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW, 0o644);
  try { fs.writeSync(fd, data); } finally { fs.closeSync(fd); }
  const real = fs.realpathSync(target);
  if (path.dirname(real) !== out.root) throw new Refused(`refusing: ${name} resolved outside the output directory`);
  return target;
}

// ------------------------------------------------------------------ args and states
function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
    'usage: node scripts/ux/shoot.mjs --url <base> --states <file.json> --out <dir>\n' +
    '         [--chromium <path>] [--report-only] [--only a,b] [--overwrite] [--allow-host <host,...>]\n' +
    '       node scripts/ux/shoot.mjs --self-test [--chromium <path>]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const a = { reportOnly: false, overwrite: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--report-only') a.reportOnly = true;
    else if (k === '--overwrite') a.overwrite = true;
    else if (k === '--self-test') a.selfTest = true;
    else if (['--url', '--states', '--out', '--chromium', '--only', '--allow-host'].includes(k)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) usage(`${k} needs a value`);
      a[k.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    } else if (CREDENTIAL_OPTION.test(k)) usage(`${k}: credential-like options are not supported by this harness`);
    else usage(`unknown argument ${k}`);
  }
  if (a.selfTest) return a;
  if (!a.url) usage('--url is required');
  if (!a.states) usage('--states is required');
  if (!a.out) usage('--out is required');
  a.allowHosts = (a.allowHost || '').split(',').map((x) => x.trim()).filter(Boolean);
  return a;
}

function loadStates(file, only) {
  let states;
  try { states = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { usage(`cannot read states file ${file}: ${e.message}`); }
  if (!Array.isArray(states) || !states.length) usage('states file must be a non-empty JSON array');
  const names = new Set();
  for (const s of states) {
    if (!s || typeof s.name !== 'string' || !FILE_NAME.test(s.name) || s.name.includes('..')) usage(`every state needs a "name" of letters, digits, _ . - that starts with a letter, digit or _ and has no ".." (got ${JSON.stringify(s && s.name)})`);
    if (names.has(s.name)) usage(`duplicate state name ${s.name}`);
    names.add(s.name);
    if (typeof s.path !== 'string' || !s.path.startsWith('/')) usage(`state ${s.name}: "path" must start with /`);
  }
  if (only) {
    const want = new Set(only.split(',').map((x) => x.trim()).filter(Boolean));
    states = states.filter((s) => want.has(s.name));
    if (!states.length) usage('--only matched no state');
  }
  return states;
}

// ------------------------------------------------------------------ shooting
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

async function shootOne(browser, base, state, vp, out, policy) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: 'he-IL',
    reducedMotion: vp.reduced ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
  const blocked = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (shouldBlockRequest(url, policy.credentialed)) { blocked.push(url.slice(0, 120)); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  const page = await context.newPage();
  const shot = {
    state: state.name, viewport: vp.tag, size: `${vp.width}x${vp.height}`, file: `${state.name}-${vp.tag}.png`,
    requestedUrl: '', finalUrl: '', status: null, consoleErrors: [], blockedRequests: blocked, failures: [],
  };
  const consoleErrors = shot.consoleErrors;
  // requests this harness aborted on purpose are reported as blockedRequests, not as page errors
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`));

  const setup = state.setup || {};
  if (setup.localStorage || setup.sessionStorage) {
    // only on the base origin: a redirect or frame to another origin gets nothing
    await page.addInitScript(({ ls, ss, origin }) => {
      if (location.origin !== origin) return;
      try { for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) { /* storage blocked */ }
      try { for (const [k, v] of Object.entries(ss || {})) sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) { /* storage blocked */ }
    }, { ls: setup.localStorage, ss: setup.sessionStorage, origin: new URL(base).origin });
  }

  const actions = [...(state.actions || [])];
  const cdp = await context.newCDPSession(page);
  const early = [];
  while (actions.length && actions[0].throttle) early.push(actions.shift());
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
      try { await page.waitForSelector(state.waitFor, { timeout: 10000 }); } catch (e) { shot.waitForError = `${state.waitFor}`; }
    }
    try { await runActions(page, context, cdp, actions); } catch (e) { shot.actionError = String(e.message).split('\n')[0]; }
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    // let finite animations (entry splash, fades) finish; endless loops are ignored; capped at 6 s
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
    const png = await page.screenshot({ fullPage: true });
    safeWrite(out, shot.file, png);
    shot.written = true;
  }
  shot.failures = evaluateShot(shot);
  shot.verdict = verdictOf(shot, shot.failures);
  await context.close();
  return shot;
}

async function launch(args) {
  const exe = args.chromium || process.env.UX_CHROMIUM || undefined;
  try {
    return await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  } catch (e) {
    console.error(`cannot launch Chromium${exe ? ` at ${exe}` : ''}: ${String(e.message).split('\n')[0]}`);
    console.error('hint: pass --chromium <path>, e.g. /root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
    process.exit(2);
  }
}

// ------------------------------------------------------------------ self test
function spawnSelf(extra) {
  return spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...extra], { encoding: 'utf8' });
}

async function selfTest(args) {
  let bad = 0;
  const line = (ok, what) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };
  const throws = (fn) => { try { fn(); return null; } catch (e) { return e instanceof Refused ? e.message : `UNEXPECTED ${e.message}`; } };
  const st = (name, setup, actions, p = '/') => ({ name, path: p, setup, actions });

  console.log('== checks: one known pass and one known fail per check ==');
  const browser = await launch(args);
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    for (const f of FIXTURES) {
      const page = await ctx.newPage();
      await page.setContent(f.html);
      const p = await page.evaluate(pageChecks);
      const fired = !!f.fires(p);
      const want = f.expect === 'fail';
      let extra = '';
      if (f.check === 'target' && p.smallTargets[0]) extra = ` (${p.smallTargets.map((t) => t.width + 'x' + t.height).join(', ')})`;
      if (f.check.startsWith('contrast')) extra = ` (judged ${p.contrast.checked}, failed ${p.contrast.failures.length}, needs human eye ${p.contrast.needsHumanEye.count}${p.contrast.failures[0] ? ', ratio ' + p.contrast.failures[0].ratio + ' needs ' + p.contrast.failures[0].required : ''})`;
      line(fired === want, `${f.check.padEnd(13)} ${f.name.padEnd(42)} expected ${want ? 'FIRES' : 'quiet'}, got ${fired ? 'fires' : 'quiet'}${extra}`);
      await page.close();
    }
    await ctx.close();
  } finally { await browser.close(); }

  console.log('\n== production and credential guard ==');
  const refuses = (label, base, states, allow = []) => { const m = throws(() => assertSafe(base, states, allow)); line(!!m && !m.startsWith('UNEXPECTED'), `refuse  ${label}${m ? '  -> ' + m.slice(0, 90) : '  (NOT refused)'}`); };
  const allows = (label, base, states, allow = []) => { const m = throws(() => assertSafe(base, states, allow)); line(m === null, `allow   ${label}${m ? '  -> ' + m.slice(0, 90) : ''}`); };
  const ls = { localStorage: { harmless: '1' } };
  const userinfoUrl = 'https://' + ['someone', 'x'].join(':') + '@sipurai.ai';
  refuses('production www + storage with an innocuous key', 'https://www.sipurai.ai', [st('a', ls)]);
  refuses('production bare domain + storage', 'https://sipurai.ai/anything', [st('a', ls)]);
  refuses('production subdomain + sessionStorage', 'https://clerk.sipurai.ai', [st('a', { sessionStorage: { x: '1' } })]);
  refuses('production + cookies', 'https://sipurai.ai', [st('a', { cookies: [{ name: 'a' }] })]);
  refuses('production + headers', 'https://sipurai.ai', [st('a', { headers: { a: 'b' } })]);
  refuses('production + fill action', 'https://sipurai.ai', [st('a', undefined, [{ fill: '#x', value: 'y' }])]);
  refuses('production + URL userinfo', userinfoUrl, [st('a')]);
  refuses('production + token-like query', 'https://sipurai.ai', [st('a', { query: '?token=1' })]);
  refuses('local base but //sipurai.ai path escapes the origin', 'http://127.0.0.1:4173', [st('a', ls, undefined, '//sipurai.ai/x')]);
  refuses('local base but backslash path', 'http://127.0.0.1:4173', [st('a', undefined, undefined, '/\\evil.com')]);
  refuses('non-local, non-allowed host + storage', 'https://preview-abc.vercel.app', [st('a', ls)]);
  refuses('look-alike host notsipurai.ai + storage (not local, not allowed)', 'https://notsipurai.ai', [st('a', ls)]);
  refuses('--allow-host naming a production host', 'https://preview-abc.vercel.app', [st('a', ls)], ['www.sipurai.ai']);
  refuses('production with trailing dot www host + storage', 'https://www.sipurai.ai./', [st('a', ls)]);
  refuses('production with trailing dot bare host + storage', 'https://sipurai.ai./', [st('a', ls)]);
  refuses('trailing-dot production base passed to --allow-host (the real bypass)', 'https://www.sipurai.ai./', [st('a', ls)], ['www.sipurai.ai.']);
  refuses('production upper case + trailing dot', 'https://SIPURAI.AI./', [st('a', ls)]);
  refuses('--allow-host production with trailing dot', 'https://preview-abc.vercel.app', [st('a', ls)], ['www.sipurai.ai.']);
  refuses('--allow-host production upper case', 'https://preview-abc.vercel.app', [st('a', ls)], ['WWW.SIPURAI.AI']);
  refuses('production + token in state.path query', 'https://sipurai.ai', [st('a', undefined, undefined, '/login?token=abc')]);
  refuses('production + key in state.path query', 'https://www.sipurai.ai', [st('a', undefined, undefined, '/x?apikey=1')]);
  refuses('production + sig in state.path query', 'https://sipurai.ai', [st('a', undefined, undefined, '/x?sig=1')]);
  refuses('production + access_token in fragment', 'https://sipurai.ai', [st('a', undefined, undefined, '/x#access_token=abc')]);
  refuses('production + code in setup.query', 'https://sipurai.ai', [st('a', { query: '?code=1' })]);
  refuses('preview host, not allowed + session in state.path', 'https://preview-abc.vercel.app', [st('a', undefined, undefined, '/x?session=1')]);
  refuses('resolved URL leaves the base origin (absolute URL in path)', 'http://127.0.0.1:4173', [st('a', undefined, undefined, 'https://sipurai.ai/x')]);
  allows('production, benign query and fragment', 'https://www.sipurai.ai', [st('a', { query: '?state=empty&lang=he' }, undefined, '/welcome?ref=home#top')]);
  allows('preview host with messy allow-list entry', 'https://preview-abc.vercel.app', [st('a', ls)], ['Preview-ABC.vercel.app.']);
  allows('localhost with trailing dot + storage', 'http://localhost.:4173', [st('a', ls)]);
  allows('production, signed-out, no credentials', 'https://www.sipurai.ai', [st('a'), st('b', undefined, [{ click: '#x' }], '/welcome')]);
  allows('127.0.0.1 + storage', 'http://127.0.0.1:4173', [st('a', ls)]);
  allows('localhost + storage', 'http://localhost:4173', [st('a', ls)]);
  allows('IPv6 loopback + storage', 'http://[::1]:4173', [st('a', ls)]);
  allows('preview host passed with --allow-host + storage', 'https://preview-abc.vercel.app', [st('a', ls)], ['preview-abc.vercel.app']);
  const rb = (label, url, cred, want) => line(shouldBlockRequest(url, cred) === want, `request ${label}: ${want ? 'aborted' : 'let through'}`);
  rb('credentialed run -> clerk.sipurai.ai (redirect/subresource)', 'https://clerk.sipurai.ai/v1/client', true, true);
  rb('credentialed run -> sipurai.ai', 'https://sipurai.ai/', true, true);
  rb('credentialed run -> look-alike sipurai.ai.evil.com', 'https://sipurai.ai.evil.com/', true, false);
  rb('credentialed run -> local app', 'http://127.0.0.1:4173/x', true, false);
  rb('credentialed run -> www host with trailing dot', 'https://www.sipurai.ai./x', true, true);
  rb('credentialed run -> upper case, two trailing dots', 'https://SIPURAI.AI../', true, true);
  rb('signed-out run -> production', 'https://sipurai.ai/', false, false);
  for (const o of ['--cookie', '--header', '--storage-state', '--auth-token']) {
    const r = spawnSelf([o, 'x']);
    line(r.status === 2 && /credential-like options/.test(r.stderr), `refuse  credential-like option ${o}`);
  }

  console.log('\n== output directory boundary ==');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-selftest-'));
  const outside = path.join(tmp, 'outside.txt');
  fs.writeFileSync(outside, 'KEEP');
  const fresh = path.join(tmp, 'fresh');
  const o1 = prepareOut(fresh, false);
  safeWrite(o1, 'ok.png', Buffer.from('x'));
  line(fs.existsSync(path.join(fresh, 'ok.png')), 'allow   new directory, normal file');
  for (const bad_ of ['../x', '..', 'a/b', '/etc/passwd', '.hidden', 'a..b', '']) {
    const m = throws(() => safeWrite(o1, bad_, Buffer.from('x')));
    line(!!m && !m.startsWith('UNEXPECTED'), `refuse  file name ${JSON.stringify(bad_)}`);
  }
  line(!!throws(() => prepareOut(fresh, false)), 'refuse  existing non-empty directory without --overwrite');
  const o2 = prepareOut(fresh, true);
  safeWrite(o2, 'ok.png', Buffer.from('y'));
  line(fs.readFileSync(path.join(fresh, 'ok.png'), 'utf8') === 'y', 'allow   non-empty directory with --overwrite (own file replaced)');
  fs.symlinkSync(outside, path.join(fresh, 'report.json'));
  const m1 = throws(() => safeWrite(o2, 'report.json', Buffer.from('PWNED')));
  line(!!m1 && fs.readFileSync(outside, 'utf8') === 'KEEP', `refuse  planted symlink report.json -> outside file (target still "${fs.readFileSync(outside, 'utf8')}")`);
  fs.symlinkSync(outside, path.join(fresh, 'a-375.png'));
  const m2 = throws(() => safeWrite(o2, 'a-375.png', Buffer.from('PWNED')));
  line(!!m2 && fs.readFileSync(outside, 'utf8') === 'KEEP', 'refuse  planted symlink PNG name -> outside file');
  const linkDir = path.join(tmp, 'linkdir');
  fs.symlinkSync(tmp, linkDir);
  line(!!throws(() => prepareOut(linkDir, true)), 'refuse  --out that is itself a symlink');
  fs.writeFileSync(path.join(tmp, 'afile'), '1');
  line(!!throws(() => prepareOut(path.join(tmp, 'afile'), true)), 'refuse  --out that is a regular file');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(bad ? `\n${bad} self-test case(s) FAILED` : '\nall self-test cases behaved as expected');
  process.exit(bad ? 1 : 0);
}

// ------------------------------------------------------------------ main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return selfTest(args);
  const states = loadStates(args.states, args.only);
  const policy = assertSafe(args.url, states, args.allowHosts);
  const out = prepareOut(args.out, args.overwrite);

  const browser = await launch(args);
  const shots = [];
  const produced = [];
  try {
    for (const state of states) {
      for (const vp of VIEWPORTS) {
        const shot = await shootOne(browser, args.url, state, vp, out, policy);
        shots.push(shot);
        if (shot.written) produced.push(shot.file);
        const tag = { pass: 'PASS  ', fail: 'FAIL  ', 'needs-human-eye': 'REVIEW' }[shot.verdict];
        const eye = shot.page ? shot.page.contrast.needsHumanEye.count : 0;
        console.log(`${tag} ${shot.state} @ ${shot.viewport}  ${shot.failures.length} failure(s)` + (eye ? `, ${eye} text node(s) need a human eye` : ''));
        for (const f of shot.failures) console.log(`      - ${f}`);
        if (shot.blockedRequests.length) console.log(`      (blocked ${shot.blockedRequests.length} request(s) to production hosts)`);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = shots.filter((s) => s.verdict === 'fail');
  const review = shots.filter((s) => s.verdict === 'needs-human-eye');
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: args.url,
    credentialedRun: policy.credentialed,
    totals: {
      shots: shots.length,
      pass: shots.filter((s) => s.verdict === 'pass').length,
      fail: failed.length,
      needsHumanEye: review.length,
      textNodesNeedingHumanEye: shots.reduce((n, s) => n + (s.page ? s.page.contrast.needsHumanEye.count : 0), 0),
    },
    shots: shots.map((s) => ({
      state: s.state, viewport: s.viewport, size: s.size,
      file: s.written ? s.file : null,
      requestedUrl: s.requestedUrl, finalUrl: s.finalUrl, status: s.status,
      lang: s.page?.lang ?? null, dir: s.page?.dir ?? null,
      scrollWidth: s.page?.overflow.scrollWidth ?? null, clientWidth: s.page?.overflow.clientWidth ?? null,
      overflowOffenders: s.page?.overflow.offenders ?? [],
      interactiveCount: s.page?.interactiveCount ?? null,
      smallTargets: s.page?.smallTargets ?? [],
      contrast: s.page?.contrast ?? null,
      imagesWithoutAlt: s.page?.imagesWithoutAlt ?? [],
      unnamedControls: s.page?.unnamedControls ?? [],
      consoleErrors: s.consoleErrors,
      blockedRequests: s.blockedRequests,
      navigationError: s.navigationError ?? null,
      failures: s.failures,
      verdict: s.verdict,
    })),
  };
  safeWrite(out, 'report.json', JSON.stringify(report, null, 2));
  produced.push('report.json');

  console.log('\nfiles produced in ' + out.root + ':');
  for (const f of produced) console.log('  ' + path.join(out.root, f));
  const t = report.totals;
  console.log(`\n${t.pass} pass, ${t.fail} fail, ${t.needsHumanEye} need a human eye (${t.textNodesNeedingHumanEye} text nodes not judged, NOT counted as passing)` + (args.reportOnly ? '  [--report-only: exit 0]' : ''));
  process.exit(failed.length && !args.reportOnly ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e instanceof Refused ? e.message : (e.stack || e)));
  process.exit(2);
});
