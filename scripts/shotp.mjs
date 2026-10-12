// Portrait screenshots of the painted prototype. Usage: node scripts/shotp.mjs <outPrefix> [evals...]
import { chromium } from 'playwright-core';
const [prefix, ...evals] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/painted.html');
await page.waitForTimeout(6000);
let i = 0;
await page.screenshot({ path: `${prefix}_${i++}.png` });
for (const e of evals) { await page.evaluate(e); await page.waitForTimeout(2500); await page.screenshot({ path: `${prefix}_${i++}.png` }); }
await browser.close();
