/**
 * checks.mjs - the acceptance checks of the UX harness (contract P1-00).
 *
 * `pageChecks` is serialised by Playwright and runs INSIDE the page, so it must stay
 * self-contained (no imports, no outer variables). `evaluateShot` runs in Node and turns the
 * raw measurements into failures. `FIXTURES` are tiny pages, one known pass and one known fail
 * per check, used by `shoot.mjs --self-test` to prove each check does what it claims.
 *
 * What each check claims (and no more):
 *  - overflow:  the DOCUMENT scrolls sideways (scrollWidth > clientWidth); offenders are listed.
 *  - targets:   the hit area (border box incl. padding; for a wrapped inline element its largest
 *               line box; a form control may use its label) is at least 44x44 CSS px. This is the
 *               project's rule and WCAG 2.5.5 (AAA), NOT the AA 2.5.8 24px rule. Exempt: links
 *               inside a sentence (WCAG inline exception), disabled controls, and genuinely
 *               visually-hidden helpers (clipped sr-only). A visible 1px-wide button is a target.
 *  - contrast:  WCAG 1.4.3. Large text is 24px regular or 18.66px bold (3:1), the rest needs 4.5:1.
 *               Anything whose real background cannot be established (image, gradient, overlapping
 *               layer, partial group opacity, pseudo-element text) is NOT judged: it is listed under
 *               `needsHumanEye` and never counted as a pass.
 */

export function pageChecks() {
  const MIN_TARGET = 44;
  const doc = document.documentElement;

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || parseFloat(s.opacity) === 0) return false;
    }
    return true;
  };

  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return tag + id + cls;
  };

  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const accName = (el) => {
    const lab = el.getAttribute('aria-label');
    if (lab && lab.trim()) return lab.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map(textOf).join(' ').trim();
      if (t) return t;
    }
    if (el.labels && el.labels.length) {
      const t = [...el.labels].map(textOf).join(' ').trim();
      if (t) return t;
    }
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) && el.value) return el.value;
    if (el.tagName === 'IMG' && el.getAttribute('alt')) return el.getAttribute('alt').trim();
    const own = textOf(el);
    if (own) return own;
    for (const img of el.querySelectorAll('img[alt]')) if (img.alt.trim()) return img.alt.trim();
    for (const n of el.querySelectorAll('[aria-label]')) if (n.getAttribute('aria-label').trim()) return n.getAttribute('aria-label').trim();
    for (const t of el.querySelectorAll('svg title')) if (textOf(t)) return textOf(t);
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    return '';
  };

  // ---- colour helpers: any CSS colour (rgb, oklch, color()) -> [r,g,b,a] ----
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const alphaOf = (css) => {
    const m = css.match(/\/\s*([\d.]+%?)\s*\)/) || css.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
    if (!m) return null;
    return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  };
  const parse = (css) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const c = [d[0], d[1], d[2], d[3] / 255];
    const a = alphaOf(css);
    if (a !== null) c[3] = a;
    return c;
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  // ---- 1. overflow (document level) ----
  const overflow = {
    scrollWidth: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0),
    clientWidth: doc.clientWidth,
    horizontal: false,
    offenders: [],
  };
  overflow.horizontal = overflow.scrollWidth > overflow.clientWidth;
  if (overflow.horizontal) {
    const out = new Set();
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > doc.clientWidth + 1 || r.left < -1)) out.add(el);
    }
    const leaves = [...out].filter((el) => !([...el.children].some((c) => out.has(c))));
    leaves.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    for (const el of leaves.slice(0, 8)) {
      overflow.offenders.push(describe(el) + ' ' + Math.round(el.getBoundingClientRect().width) + 'px');
    }
  }

  // ---- 2. touch targets (hit area >= 44x44) ----
  const interactiveSel = [
    'a[href]', 'button', 'summary', 'select', 'textarea', 'input:not([type=hidden])',
    '[role=button]', '[role=link]', '[role=switch]', '[role=checkbox]', '[role=radio]',
    '[role=tab]', '[role=menuitem]', '[role=option]', '[onclick]',
  ].join(',');
  const isInteractive = (n) => n.nodeType === 1 && n.matches(interactiveSel);
  const srOnly = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const clipped = (s.clip && s.clip !== 'auto' && /rect\(\s*0/.test(s.clip)) || (s.clipPath && /inset\(\s*(50|100)%/.test(s.clipPath));
    return (clipped || (r.width <= 1 && r.height <= 1 && s.overflow === 'hidden')) && s.position === 'absolute';
  };
  // a link that is part of running text: the nearest block ancestor has words outside any control
  const inSentence = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    let block = el.parentElement;
    while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
    if (!block) return false;
    let text = '';
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      let inside = false;
      for (let p = n.parentElement; p && p !== block; p = p.parentElement) if (isInteractive(p)) { inside = true; break; }
      if (!inside) text += n.nodeValue;
    }
    return (text.match(/[\p{L}\p{N}]{2,}/gu) || []).length >= 2;
  };
  const hitArea = (el) => {
    let rects = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (el.labels && el.labels.length) for (const l of el.labels) rects = rects.concat([...l.getClientRects()]);
    let best = { width: 0, height: 0 };
    for (const r of rects) if (r.width * r.height >= best.width * best.height) best = { width: r.width, height: r.height };
    return best;
  };
  const smallTargets = [];
  let interactiveCount = 0;
  for (const el of document.querySelectorAll(interactiveSel)) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (!isVisible(el) || srOnly(el)) continue;
    interactiveCount++;
    if (el.tagName === 'A' && inSentence(el)) continue;
    const a = hitArea(el);
    if (a.width < MIN_TARGET || a.height < MIN_TARGET) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        name: accName(el).slice(0, 40),
        selector: describe(el),
        width: Math.round(a.width * 10) / 10,
        height: Math.round(a.height * 10) / 10,
      });
    }
  }

  // ---- 3. contrast ----
  // Background: ancestor colours composited bottom-up. Anything else painting behind the text
  // (image, gradient, a non-ancestor layer overlapping the text box, a coloured ancestor
  // pseudo-element, partial group opacity) makes the answer unknowable from CSS: needs a human eye.
  const paint = (n, pseudo) => {
    const s = getComputedStyle(n, pseudo || null);
    if (pseudo && (s.content === 'none' || s.content === 'normal' || s.display === 'none')) return { none: true };
    if (s.visibility === 'hidden' || s.display === 'none') return { none: true };
    if (s.backgroundImage && s.backgroundImage !== 'none') return { image: true };
    const bg = parse(s.backgroundColor);
    return bg[3] > 0 ? { color: bg, opacity: parseFloat(s.opacity) } : { none: true };
  };
  let layerCache = null;
  const layers = () => {
    if (layerCache) return layerCache;
    layerCache = [];
    for (const n of [document.body, ...document.body.querySelectorAll('*')]) {
      const r = n.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME'].includes(n.tagName) && parseFloat(getComputedStyle(n).opacity) > 0) layerCache.push({ n, r, why: 'media behind text' });
      for (const ps of [null, '::before', '::after']) {
        const p = paint(n, ps);
        if (p.image) layerCache.push({ n, r, ps, why: 'background image or gradient' });
        else if (p.color) layerCache.push({ n, r, ps, color: p.color, opacity: p.opacity, why: 'overlapping layer' });
      }
    }
    return layerCache;
  };
  // returns { bg } or { unknown: reason }
  const backgroundOf = (el) => {
    const stack = [];
    let opaqueEl = null;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const op = parseFloat(getComputedStyle(n).opacity);
      if (op < 1 && op > 0) return { unknown: 'partial group opacity' };
      const p = paint(n, null);
      if (p.image) return { unknown: 'background image or gradient' };
      if (p.color) {
        stack.push([p.color, p.opacity]);
        if (p.color[3] >= 1 && p.opacity >= 1) { opaqueEl = n; break; }
      }
    }
    const er = el.getBoundingClientRect();
    for (const l of layers()) {
      if (l.n === el || el.contains(l.n)) continue;
      const ancestor = l.n.contains(el);
      if (ancestor && !l.ps) continue; // own paint of ancestors handled in the walk
      if (opaqueEl && !opaqueEl.contains(l.n)) continue; // behind the opaque box
      const overlap = l.r.left < er.right && l.r.right > er.left && l.r.top < er.bottom && l.r.bottom > er.top;
      if (!overlap) continue;
      return { unknown: l.why + (l.ps ? ' (' + l.ps + ')' : '') };
    }
    let acc = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) {
      const [bg, op] = stack[i];
      acc = over([bg[0], bg[1], bg[2], bg[3] * op], acc);
    }
    return { bg: acc };
  };

  const contrastFailures = [];
  const needsHumanEye = [];
  let passed = 0;
  const judge = (el, colorCss, label) => {
    const cs = getComputedStyle(el);
    const bgr = backgroundOf(el);
    if (bgr.unknown) { needsHumanEye.push({ selector: describe(el), text: label.slice(0, 40), reason: bgr.unknown }); return; }
    const fg0 = parse(colorCss);
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3]], bgr.bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bgr.bg);
    if (cr < need) {
      contrastFailures.push({ selector: describe(el), text: label.slice(0, 40), ratio: Math.round(cr * 100) / 100, required: need, fontSize: size, bold, color: colorCss });
    } else passed++;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !/[\p{L}\p{N}]/u.test(node.nodeValue)) continue; // blank or symbol-only is decoration
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'OPTION'].includes(el.tagName)) continue;
    if (!isVisible(el)) continue;
    const rr = el.getBoundingClientRect();
    if (rr.width <= 1 || rr.height <= 1) continue;
    seen.add(el);
    judge(el, getComputedStyle(el).color, textOf(el));
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')) {
    if (!isVisible(el)) continue;
    if (el.value) judge(el, getComputedStyle(el).color, el.value);
    else if (el.placeholder) judge(el, getComputedStyle(el, '::placeholder').color, el.placeholder);
  }
  for (const el of document.body.querySelectorAll('*')) {
    for (const ps of ['::before', '::after']) {
      const c = getComputedStyle(el, ps).content;
      if (c && c !== 'none' && c !== 'normal' && /[\p{L}\p{N}]/u.test(c) && isVisible(el)) {
        needsHumanEye.push({ selector: describe(el) + ps, text: c.slice(0, 40), reason: 'text generated by a pseudo-element' });
      }
    }
  }

  // ---- 4. alt text, 5. accessible names ----
  const imagesWithoutAlt = [];
  for (const img of document.querySelectorAll('img')) {
    if (!isVisible(img)) continue;
    if (!img.hasAttribute('alt')) imagesWithoutAlt.push(describe(img) + ' ' + (img.getAttribute('src') || '').slice(0, 60));
  }
  for (const el of document.querySelectorAll('[role=img]')) {
    if (!isVisible(el)) continue;
    if (!accName(el)) imagesWithoutAlt.push(describe(el) + ' (role=img, no label)');
  }
  const unnamedControls = [];
  for (const el of document.querySelectorAll('a[href],button,[role=button],[role=link],[role=switch],[role=checkbox],[role=tab],[role=menuitem],input:not([type=hidden]),select,textarea')) {
    if (!isVisible(el)) continue;
    if (!accName(el)) unnamedControls.push(describe(el));
  }

  return {
    lang: doc.getAttribute('lang') || '',
    dir: doc.getAttribute('dir') || getComputedStyle(doc).direction || '',
    overflow,
    interactiveCount,
    smallTargets,
    contrast: {
      checked: passed + contrastFailures.length,
      passed,
      failures: contrastFailures,
      needsHumanEye: { count: needsHumanEye.length, items: needsHumanEye.slice(0, 30) },
    },
    imagesWithoutAlt,
    unnamedControls,
  };
}

/** Turns one shot's raw measurements into failure strings. Empty array = no check failed. */
export function evaluateShot(shot) {
  const f = [];
  if (shot.status && shot.status >= 400) f.push(`http status ${shot.status}`);
  if (shot.navigationError) f.push(`navigation error: ${shot.navigationError}`);
  if (shot.waitForError) f.push(`waitFor did not appear: ${shot.waitForError}`);
  if (shot.actionError) f.push(`action failed: ${shot.actionError}`);
  const p = shot.page;
  if (!p) return f;
  if (p.overflow.horizontal) {
    f.push(`horizontal overflow: scrollWidth ${p.overflow.scrollWidth} > clientWidth ${p.overflow.clientWidth}` +
      (p.overflow.offenders.length ? ` (${p.overflow.offenders.join('; ')})` : ''));
  }
  for (const t of p.smallTargets) f.push(`small target ${t.width}x${t.height} <${t.tag}> "${t.name}" ${t.selector}`);
  for (const c of p.contrast.failures) f.push(`low contrast ${c.ratio}:1 (needs ${c.required}) "${c.text}" ${c.selector} ${c.fontSize}px${c.bold ? ' bold' : ''}`);
  for (const i of p.imagesWithoutAlt) f.push(`image without alt: ${i}`);
  for (const u of p.unnamedControls) f.push(`control without accessible name: ${u}`);
  for (const e of shot.consoleErrors || []) f.push(`console error: ${e}`);
  return f;
}

/** 'fail' (a check failed) | 'needs-human-eye' (nothing failed but some text could not be judged) | 'pass' */
export function verdictOf(shot, failures) {
  if (failures.length) return 'fail';
  if (shot.page && shot.page.contrast.needsHumanEye.count > 0) return 'needs-human-eye';
  return 'pass';
}

// ---------------------------------------------------------------------------------------------
// Fixtures for `--self-test`: per check, one page that must NOT trigger it and one that MUST.
// `fires(pageResult)` says whether the check fired. `expect` is 'pass' (must not fire) or 'fail'.
// ---------------------------------------------------------------------------------------------
const page = (body, head = '') =>
  `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>fixture</title><style>body{margin:0;font:16px sans-serif;background:#fff;color:#111}${head}</style></head><body>${body}</body></html>`;

export const FIXTURES = [
  { name: 'overflow-pass', check: 'overflow', expect: 'pass', html: page('<div style="width:300px;height:20px;background:#eee"></div>'), fires: (p) => p.overflow.horizontal },
  { name: 'overflow-fail', check: 'overflow', expect: 'fail', html: page('<div id="wide" style="width:900px;height:20px;background:#eee"></div>'), fires: (p) => p.overflow.horizontal && p.overflow.offenders.some((o) => o.includes('#wide')) },
  { name: 'target-pass-48px', check: 'target', expect: 'pass', html: page('<button style="width:48px;height:48px" aria-label="ok">x</button>'), fires: (p) => p.smallTargets.length > 0 },
  { name: 'target-pass-padding', check: 'target', expect: 'pass', html: page('<a href="#" style="display:inline-block;padding:14px 20px;line-height:16px">Go</a>'), fires: (p) => p.smallTargets.length > 0 },
  { name: 'target-pass-inline-link-in-sentence', check: 'target', expect: 'pass', html: page('<p>Please read the <a href="#">terms of use</a> before you continue.</p>'), fires: (p) => p.smallTargets.length > 0 },
  { name: 'target-fail-30px', check: 'target', expect: 'fail', html: page('<button style="width:30px;height:30px" aria-label="small">x</button>'), fires: (p) => p.smallTargets.length === 1 },
  { name: 'target-fail-1px-wide', check: 'target', expect: 'fail', html: page('<button style="width:1px;height:48px;padding:0;border:0;background:#000" aria-label="thin">x</button>'), fires: (p) => p.smallTargets.length === 1 },
  { name: 'target-fail-nav-links', check: 'target', expect: 'fail', html: page('<nav><a href="#">One</a> | <a href="#">Two</a> | <a href="#">Three</a></nav>'), fires: (p) => p.smallTargets.length === 3 },
  { name: 'contrast-pass-normal', check: 'contrast', expect: 'pass', html: page('<p style="color:#595959">Readable grey text</p>'), fires: (p) => p.contrast.failures.length > 0 || p.contrast.needsHumanEye.count > 0 },
  { name: 'contrast-pass-large-24px', check: 'contrast', expect: 'pass', html: page('<p style="color:#8c8c8c;font-size:24px">Large text</p>'), fires: (p) => p.contrast.failures.length > 0 || p.contrast.needsHumanEye.count > 0 },
  { name: 'contrast-fail-light-grey', check: 'contrast', expect: 'fail', html: page('<p style="color:#bbb">Too light</p>'), fires: (p) => p.contrast.failures.length === 1 },
  { name: 'contrast-fail-20px-regular-is-not-large', check: 'contrast', expect: 'fail', html: page('<p style="color:#8c8c8c;font-size:20px">Not large text</p>'), fires: (p) => p.contrast.failures.length === 1 && p.contrast.failures[0].required === 4.5 },
  { name: 'contrast-pass-19px-bold-is-large', check: 'contrast', expect: 'pass', html: page('<p style="color:#8c8c8c;font-size:19px;font-weight:700">Bold large</p>'), fires: (p) => p.contrast.failures.length > 0 || p.contrast.needsHumanEye.count > 0 },
  { name: 'contrast-needs-eye-gradient', check: 'contrast-skip', expect: 'fail', html: page('<div style="background:linear-gradient(#000,#fff);padding:8px"><p style="color:#777;margin:0">On a gradient</p></div>'), fires: (p) => p.contrast.needsHumanEye.count === 1 && p.contrast.failures.length === 0 && p.contrast.passed === 0 },
  { name: 'contrast-needs-eye-overlapping-layer', check: 'contrast-skip', expect: 'fail', html: page('<div style="position:relative"><div style="position:absolute;inset:0;background:#123"></div><p style="position:relative;color:#fff;margin:0">Over a layer</p></div>'), fires: (p) => p.contrast.needsHumanEye.count >= 1 && p.contrast.passed === 0 },
  { name: 'alt-pass', check: 'alt', expect: 'pass', html: page('<img alt="a dot" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'), fires: (p) => p.imagesWithoutAlt.length > 0 },
  { name: 'alt-fail', check: 'alt', expect: 'fail', html: page('<img width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'), fires: (p) => p.imagesWithoutAlt.length === 1 },
  { name: 'name-pass', check: 'name', expect: 'pass', html: page('<button style="width:48px;height:48px" aria-label="Close"><svg width="10" height="10"></svg></button>'), fires: (p) => p.unnamedControls.length > 0 },
  { name: 'name-fail', check: 'name', expect: 'fail', html: page('<button style="width:48px;height:48px"><svg width="10" height="10"></svg></button>'), fires: (p) => p.unnamedControls.length === 1 },
];
