// Usage: NODE_PATH=/root/work/sipurai-dash-1179515851/node_modules node live-shots.cjs
const { chromium } = require("/root/work/sipurai-dash-1179515851/node_modules/playwright");
const fs = require('fs'), path = require('path');
const BASE = 'https://www.sipurai.ai';
const OUT = path.join(__dirname, '..', 'shots');
const DATA = path.join(__dirname, '..', 'data', 'i18n-live-pages.json');
const pages = [['home','/'],['welcome','/welcome'],['pricing','/pricing'],['blog','/blog'],['blogpost',null],['privacy','/privacy'],['terms','/terms'],['accessibility','/accessibility'],['contact','/contact'],['signin','/sign-in'],['signup','/sign-up'],['404','/this-does-not-exist'],['bookwizard','/BookWizard'],['library','/Library'],['settings','/Settings']];
const measure = () => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
  const latin = new Set(); let nLat=0, nHeb=0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const p = n.parentElement; if (!p || ['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName) || !vis(p)) continue;
    const t = n.textContent.trim(); if (!t) continue;
    if (/[A-Za-z]{3,}/.test(t)) { nLat++; if (!/^sipurai$/i.test(t)) latin.add(t.slice(0,120)); }
    if (/[֐-׿]/.test(t)) nHeb++;
  }
  const small = [], noName = []; let smallN=0, noNameN=0;
  document.querySelectorAll('a,button,[role=button],input').forEach(el => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label')||el.innerText||el.getAttribute('title')||el.getAttribute('placeholder')||el.value||'').trim().slice(0,40);
    if (r.width<44 || r.height<44) { smallN++; if (small.length<15) small.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`); }
    const lab = el.getAttribute('aria-label')||el.innerText?.trim()||el.getAttribute('title')||el.getAttribute('aria-labelledby')||(el.labels&&el.labels.length)||el.querySelector?.('img[alt]:not([alt=""])')||el.getAttribute('placeholder');
    if (!lab && el.type!=='hidden') { noNameN++; if (noName.length<10) noName.push(el.outerHTML.slice(0,100)); }
  });
  const heb = [...document.querySelectorAll('h1,h2,h3,p,span,a,button,div')].find(e => /[֐-׿]/.test(e.childNodes.length && [...e.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('')) && vis(e));
  return {
    lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title,
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    textNodesLatin: nLat, textNodesHebrew: nHeb, latinStrings: [...latin].slice(0,40),
    smallTargets: smallN, smallExamples: small, imagesNoAlt: [...document.images].filter(i=>!i.hasAttribute('alt')).length,
    imagesEmptyAlt: [...document.images].filter(i=>i.getAttribute('alt')==='').length,
    noAccessibleName: noNameN, noNameExamples: noName,
    hebFont: heb ? getComputedStyle(heb).fontFamily : null, hebFontTag: heb ? heb.tagName : null,
    nunitoHebrew: document.fonts.check('16px Nunito','שלום'),
    nunitoLoaded: [...document.fonts].filter(f=>/nunito/i.test(f.family)).map(f=>f.family+':'+f.status+':'+(f.unicodeRange||'').slice(0,60)).slice(0,6),
    bodyFont: getComputedStyle(document.body).fontFamily,
  };
};
(async () => {
  const browser = await chromium.launch({executablePath:"/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"});
  const results = []; let blogSlug = null;
  async function ctx(w, h, mobile, english) {
    const c = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor: mobile?2:1, isMobile:mobile, hasTouch:mobile, locale:'he-IL', extraHTTPHeaders:{'Accept-Language':'he'} });
    if (english) await c.addInitScript(() => { try { localStorage.setItem('language','english'); } catch(e){} });
    return c;
  }
  async function visit(c, url, prefix, name, doFold, record) {
    const p = await c.newPage(); const errs = [];
    p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,200)); });
    p.on('pageerror', e => errs.push('pageerror: '+String(e.message).slice(0,190)));
    let status = null, err = null;
    try {
      const r = await p.goto(BASE+url, { waitUntil:'networkidle', timeout:45000 }); status = r && r.status();
    } catch(e) { err = String(e.message).slice(0,150); try { await p.waitForTimeout(3000);} catch(_){} }
    await p.waitForTimeout(1500);
    const base = `${prefix}-${name}`;
    try { if (doFold) await p.screenshot({ path: path.join(OUT, base+'-fold.png') });
          if (!/-en$/.test(prefix)) await p.screenshot({ path: path.join(OUT, base+'-full.png'), fullPage:true }); } catch(e) { err = (err||'')+' shot:'+String(e.message).slice(0,100); }
    let m = null; try { m = await p.evaluate(measure); } catch(e) { err = (err||'')+' eval:'+String(e.message).slice(0,100); }
    if (name==='blog' && record) { blogSlug = await p.evaluate(() => { const a=[...document.querySelectorAll('a[href^="/blog/"]')].map(x=>x.getAttribute('href')).filter(h=>h.length>7); return a[0]||null; }); }
    const rec = { page:name, requested:url, viewport:prefix, finalUrl:p.url(), status, error:err, consoleErrorCount:errs.length, consoleFirst3:errs.slice(0,3), ...(m||{}), overflowX: m ? m.scrollWidth>m.clientWidth : null };
    await p.close(); return rec;
  }
  for (const [vp,w,h,mob] of [['375',375,812,true],['1280',1280,800,false]]) {
    const c = await ctx(w,h,mob,false);
    for (const [name,url] of pages) {
      const u = name==='blogpost' ? blogSlug : url; if (!u) { results.push({page:name,viewport:vp,error:'no blog slug discovered'}); continue; }
      const rec = await visit(c, u, vp, name, vp==='375', vp==='375'); results.push(rec); console.log(vp, name, rec.status, rec.finalUrl, rec.lang, rec.dir);
    }
    await c.close();
  }
  const ce = await ctx(375,812,true,true);
  for (const [name,url] of [['home','/'],['pricing','/pricing']]) { const rec = await visit(ce, url, '375-en', name, true, false); rec.page=name+'-en'; results.push(rec); console.log('en', name, rec.lang, rec.dir); }
  await ce.close(); await browser.close();
  fs.writeFileSync(DATA, JSON.stringify({ capturedAt:new Date().toISOString(), blogSlug, results }, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
