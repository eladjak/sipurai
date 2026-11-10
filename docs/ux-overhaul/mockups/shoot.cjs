const { chromium } = require('/root/work/sipurai-dash-1179515851/node_modules/playwright');
const base = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'});
  for (const f of ['a-home','a-wizard','a-read','b-home','b-wizard']) {
    for (const [w,h,tag] of [[375,812,'375'],[1280,800,'1280']]) {
      const c = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:w===375?2:1,locale:'he-IL'});
      const p = await c.newPage(); await p.goto(`${base}/${f}.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
      const m = await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
        hebFont:getComputedStyle((document.querySelector('h1,h2,.text')||document.body)).fontFamily,
        small:[...document.querySelectorAll('a,button,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.width<44||r.height<44)}).map(e=>(e.getAttribute('aria-label')||e.textContent.trim()).slice(0,20)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))}));
      await p.screenshot({path:`${out}/${f}-${tag}-fold.png`});
      await p.screenshot({path:`${out}/${f}-${tag}.png`,fullPage:true}); console.log(f,tag,JSON.stringify(m));
      await c.close();
    }
  }
  await b.close();
})();
