// Drives the game in headless Chromium and saves screenshots.
// Usage: node scripts/play.mjs <outPrefix> <scenario.json>
// scenario: [{ "eval": "js", "wait": ms, "shot": "name", "click": "css", "tap": [x,y] }]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [prefix, file, w = '1280', h = '640', dpr = '1'] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(file, 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: false });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/');
await page.waitForTimeout(2500);
for (const s of steps) {
  if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log('[eval]', JSON.stringify(r)); }
  if (s.click) await page.click(s.click);
  if (s.tap) await page.mouse.click(s.tap[0], s.tap[1]);
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: `${prefix}_${s.shot}.png` });
}
await browser.close();
