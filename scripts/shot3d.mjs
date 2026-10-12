// Screenshots of the 3D test page. Usage: node scripts/shot3d.mjs <outPrefix> [w] [h] [evals...]
import { chromium } from 'playwright-core';
const [prefix, w = '1280', h = '640', ...evals] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/proto3d.html');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 120000 });
await page.waitForTimeout(3000);
let i = 0;
await page.screenshot({ path: `${prefix}_${i++}.png` });
for (const e of evals) {
  await page.evaluate(e);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${prefix}_${i++}.png` });
}
await browser.close();
