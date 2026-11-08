import { chromium } from "/root/work/sipbuild-20261108/node_modules/@playwright/test/index.mjs";
import fs from "fs";
const env = fs.readFileSync("/etc/elad-network/keyvault/vercel-bypass.env","utf8");
const m = env.match(/VERCEL_BYPASS_prj_BaA1U9oTvtNIzlLXsHTj3Q3gxZiF=([A-Za-z0-9_-]+)/);
if(!m){console.log("no bypass secret");process.exit(1)}
const BASE=process.env.BASE; const OUT="/root/work/sipbuild-20261108/evidence/preview"; fs.mkdirSync(OUT,{recursive:true});
const b = await chromium.launch({executablePath:"/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"});
const ctx = await b.newContext({viewport:{width:375,height:812},deviceScaleFactor:2,locale:"he-IL",isMobile:true,extraHTTPHeaders:{"x-vercel-protection-bypass":m[1],"x-vercel-set-bypass-cookie":"true"}});
for (const s of ["step1","step2-errors","step3","step3-creating","step3-error","after-payment","orders-empty","orders-list","admin-list","admin-403"]) {
  const p = await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(`${BASE}/__checkout-states?state=${s.replace("-errors","")}`,{waitUntil:"networkidle"}); await p.waitForTimeout(800);
  if (s==="step2-errors") await p.getByRole("button",{name:/המשך/}).click();
  if (s==="step3-creating"||s==="step3-error") await p.getByTestId("pay-button").click();
  await p.waitForTimeout(500);
  await p.screenshot({path:`${OUT}/${s}.png`,fullPage:true});
  const t=(await p.textContent("body")).length; console.log(s,"textlen",t,"errs",errs.length, "overflow", await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth));
  await p.close();
}
await b.close();
