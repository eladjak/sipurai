/**
 * checks.mjs - the acceptance checks of the UX harness (contract P1-00).
 *
 * `pageChecks` is serialised by Playwright and runs INSIDE the page, so it must stay
 * self-contained (no imports, no outer variables). `evaluateShot` runs in Node and turns the
 * raw measurements into a list of failures.
 */

export function pageChecks() {
  const MIN_TARGET = 44;
  const doc = document.documentElement;

  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    // an ancestor with opacity 0 or display none
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
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

  // ---- accessible name (a pragmatic subset of the accname algorithm) ----
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

  // ---- colour helpers: any CSS colour (rgb, oklch, color()) -> [r,g,b,a] via a canvas ----
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const toRGBA = (css) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const alphaOf = (css) => {
    // canvas rounding loses precise alpha on tiny values; read it from the string when possible
    const m = css.match(/\/\s*([\d.]+%?)\s*\)/) || css.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
    if (!m) return null;
    return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  };
  const parse = (css) => {
    const c = toRGBA(css);
    const a = alphaOf(css);
    if (a !== null) c[3] = a;
    return c;
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [
      top[0] * a + bottom[0] * (1 - a),
      top[1] * a + bottom[1] * (1 - a),
      top[2] * a + bottom[2] * (1 - a),
      1,
    ];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  // Effective background of an element, or null when it cannot be measured honestly (a background
  // image or gradient, a photo or a video is behind the text). Ancestor colours are composited
  // bottom-up. Painted layers that are NOT ancestors (absolutely positioned background divs,
  // ::before / ::after) are found with a geometric scan: any layer under the centre of the text
  // counts. z-order between such layers is not known, so a solid one is composited just above the
  // nearest opaque ancestor, and an image/gradient one makes the text "skipped", never guessed.
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
      const media = ['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME'].includes(n.tagName) && parseFloat(getComputedStyle(n).opacity) > 0;
      if (media) layerCache.push({ n, r, media: true });
      for (const ps of [null, '::before', '::after']) {
        const p = paint(n, ps);
        if (p.image) layerCache.push({ n, r, ps, image: true });
        else if (p.color) layerCache.push({ n, r, ps, color: p.color, opacity: p.opacity });
      }
    }
    return layerCache;
  };
  const backgroundOf = (el) => {
    const stack = [];
    let opaqueAt = -1;
    let opaqueEl = null;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const p = paint(n, null);
      if (p.image) return null;
      if (p.color) {
        stack.push([p.color, p.opacity]);
        if (p.color[3] >= 1 && p.opacity >= 1) { opaqueAt = stack.length - 1; opaqueEl = n; break; }
      }
    }
    const er = el.getBoundingClientRect();
    const x = er.left + er.width / 2, y = er.top + er.height / 2;
    const extra = [];
    for (const l of layers()) {
      if (l.n === el || el.contains(l.n)) continue;
      if (opaqueEl && !opaqueEl.contains(l.n)) continue; // outside the opaque box: it is behind it
      const isAncestor = l.n.contains(el);
      if (isAncestor && !l.ps) continue; // ancestors' own paint was handled in the walk above
      if (x < l.r.left || x > l.r.right || y < l.r.top || y > l.r.bottom) continue;
      if (l.media || l.image) return null;
      extra.push([l.color, l.opacity]);
    }
    // extras sit above the opaque ancestor (if any) and below the nearer ones
    const cut = opaqueAt >= 0 ? opaqueAt : stack.length;
    stack.splice(cut, 0, ...extra.reverse());
    let acc = [255, 255, 255, 1]; // canvas default
    for (let i = stack.length - 1; i >= 0; i--) {
      const [bg, op] = stack[i];
      acc = over([bg[0], bg[1], bg[2], bg[3] * op], acc);
    }
    return acc;
  };
  const opacityChain = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o;
  };

  // ---- 1. overflow ----
  const overflow = {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
    horizontal: doc.scrollWidth > doc.clientWidth,
    offenders: [],
  };
  if (overflow.horizontal) {
    // the innermost elements that stick out of the viewport (an outer box that merely contains one is not the cause)
    const out = new Set();
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > doc.clientWidth + 1 || r.left < -1)) out.add(el);
    }
    const leaves = [...out].filter((el) => ![...el.children].some((c) => out.has(c)));
    leaves.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    for (const el of leaves.slice(0, 8)) {
      overflow.offenders.push(describe(el) + ' ' + Math.round(el.getBoundingClientRect().width) + 'px');
    }
  }

  // ---- 2. small interactive targets ----
  const interactiveSel = [
    'a[href]', 'button', 'summary', 'select', 'textarea',
    'input:not([type=hidden])',
    '[role=button]', '[role=link]', '[role=switch]', '[role=checkbox]', '[role=radio]',
    '[role=tab]', '[role=menuitem]', '[role=option]', '[onclick]',
  ].join(',');
  const smallTargets = [];
  let interactiveCount = 0;
  for (const el of document.querySelectorAll(interactiveSel)) {
    if (el.disabled) continue;
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    // visually hidden helpers (sr-only, clipped 1px inputs) are not targets
    if (r.width <= 1 || r.height <= 1) continue;
    interactiveCount++;
    // WCAG 2.5.8 inline exception: a link that is part of a sentence
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') {
      const p = el.parentElement;
      const around = p ? textOf(p).replace(textOf(el), '').trim() : '';
      if (around.length > 0) continue;
    }
    if (r.width < MIN_TARGET || r.height < MIN_TARGET) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        name: accName(el).slice(0, 40),
        selector: describe(el),
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      });
    }
  }

  // ---- 3. contrast of visible text ----
  const contrastFailures = [];
  let textNodesChecked = 0;
  let textNodesSkipped = 0;
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !/[\p{L}\p{N}]/u.test(node.nodeValue)) continue; // blank or symbol-only (bullets) is decoration
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
    if (!isVisible(el)) continue;
    { const rr = el.getBoundingClientRect(); if (rr.width <= 1 || rr.height <= 1) continue; }
    seen.add(el);
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    const bg = backgroundOf(el);
    if (!bg) { textNodesSkipped++; continue; }
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacityChain(el)], bg);
    const size = parseFloat(cs.fontSize);
    const need = size >= 18 ? 3 : 4.5;
    const cr = ratio(fg, bg);
    textNodesChecked++;
    if (cr < need) {
      contrastFailures.push({
        selector: describe(el),
        text: textOf(el).slice(0, 40),
        ratio: Math.round(cr * 100) / 100,
        required: need,
        fontSize: size,
        color: cs.color,
      });
    }
  }

  // ---- 4. images without alt, 5. icon-only controls without a name ----
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
    contrast: { checked: textNodesChecked, skippedBackgroundImage: textNodesSkipped, failures: contrastFailures },
    imagesWithoutAlt,
    unnamedControls,
  };
}

/** Turns one shot's raw measurements into failure strings. Empty array = the shot passes. */
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
  for (const c of p.contrast.failures) f.push(`low contrast ${c.ratio}:1 (needs ${c.required}) "${c.text}" ${c.selector} ${c.fontSize}px`);
  for (const i of p.imagesWithoutAlt) f.push(`image without alt: ${i}`);
  for (const u of p.unnamedControls) f.push(`control without accessible name: ${u}`);
  for (const e of shot.consoleErrors || []) f.push(`console error: ${e}`);
  return f;
}
