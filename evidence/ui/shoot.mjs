import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:5199";
const OUT = "/root/work/sipbuild-20261108/evidence/ui";
const browser = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell" });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: "he-IL", isMobile: true, hasTouch: true });
const log = [];
async function open(state, name = state) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log.push(`${name}: pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") log.push(`${name}: console.error ${m.text().slice(0, 160)}`); });
  await page.goto(`${BASE}/__checkout-states?state=${state}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return page;
}
async function shot(page, name, full = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log.push(`${name}: scrollWidth=${m.sw} clientWidth=${m.cw}${m.sw > m.cw ? "  <-- HORIZONTAL OVERFLOW" : ""}`);
  await page.close();
}
for (const s of ["step1", "step2", "step3", "step3-quote-error", "orders-empty", "orders-list", "orders-loading", "orders-error", "after-payment", "after-payment-checking", "admin-list", "admin-403"]) {
  const p = await open(s);
  await shot(p, s);
}
{
  const p = await open("step2");
  await p.getByRole("button", { name: /המשך/ }).click();
  await shot(p, "step2-errors");
}
{
  const p = await open("step2");
  await p.getByLabel("טלפון נייד").fill("123");
  await p.getByLabel("עיר").fill("חי");
  await p.getByRole("button", { name: /המשך/ }).click();
  await shot(p, "step2-phone-wrong");
}
for (const s of ["step3-creating", "step3-error"]) {
  const p = await open(s);
  await p.getByTestId("pay-button").click();
  await p.waitForTimeout(500);
  await shot(p, s);
}
{
  const p = await open("admin-list");
  await p.locator("[data-action=cancel]").first().click();
  await shot(p, "admin-cancel-confirm");
}
await browser.close();
console.log(log.join("\n"));
