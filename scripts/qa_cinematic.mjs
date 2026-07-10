// file: scripts/qa_cinematic.mjs
// description: Fast browser smoke test for the cinematic renderer, quality tiers, and ocean authoring controls.
// usage: set QA_URL to a running dev/preview URL, then run `npm run qa:cinematic` or `bun run qa:cinematic`.

import { chromium } from 'playwright';

const baseUrl = process.env.QA_URL ?? 'http://127.0.0.1:5173/';
const failures = [];
const consoleErrors = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8_000);
  page.setDefaultNavigationTimeout(12_000);
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(`${baseUrl}?debug=perf`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  expect(await page.locator('canvas').count() === 1, 'expected one WebGL canvas');
  const performanceText = await page.getByLabel('Rendering performance').textContent();
  expect(performanceText?.includes('FPS:') === true, 'performance overlay did not render FPS');
  expect(performanceText?.includes('Draws:') === true, 'performance overlay did not render draw calls');

  await page.goto(`${baseUrl}?debug=ocean`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  const panel = page.getByLabel('Ocean authoring controls');
  expect(await panel.count() === 1, 'ocean authoring panel is missing');
  await panel.getByLabel('Quality').selectOption('high');
  await page.waitForTimeout(500);
  await panel.getByLabel('Weather').selectOption('storm');
  await page.waitForTimeout(750);
  expect(await panel.getByLabel('Quality').inputValue() === 'high', 'High quality selection did not stick');
  expect(await panel.getByLabel('Weather').inputValue() === 'storm', 'Storm selection did not stick');
  expect(await page.getByText('PRESS ENTER TO SET SAIL').count() === 1, 'debug controls unexpectedly started the game');
} finally {
  await browser.close();
}

for (const error of consoleErrors) failures.push(`console error: ${error}`);
if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('PASS cinematic renderer smoke\n');
}
