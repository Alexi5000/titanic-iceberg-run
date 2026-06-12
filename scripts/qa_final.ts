// file: scripts/qa_final.ts
// description: Final v2 QA - desktop flow (daily mode, records, metrics panel) and mobile emulation (touch controls, responsive HUD) in headless Chromium
// reference: scripts/qa_drop2.ts, GAME_PLAN_V2.md

import { chromium, devices } from 'playwright';

const BASE_URL = process.env.QA_URL ?? 'http://localhost:5173/';
const results: string[] = [];
const console_errors: string[] = [];

function report(name: string, pass: boolean, detail = ''): void {
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function desktop_pass(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error') console_errors.push(`desktop: ${m.text()}`);
  });
  page.on('pageerror', (e) => console_errors.push(`desktop: ${String(e)}`));

  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);

  const buttons = await page.locator('.menu-button').count();
  report('title shows 3 menu buttons', buttons === 3, `buttons=${buttons}`);

  // Records overlay (empty).
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  const empty = await page.locator('.records-empty').count();
  report('records overlay opens empty', empty === 1);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(300);

  // Daily voyage run.
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyX'); // skip tutorial
  await page.waitForTimeout(300);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(120);
  }

  let game_over = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(3000);
    const over = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.screen')).some(
        (s) => !s.classList.contains('hidden') && (s.textContent ?? '').includes('SHE IS GONE'),
      ),
    );
    if (over) {
      game_over = true;
      break;
    }
  }
  report('daily run reaches game over', game_over);

  if (game_over) {
    await page.waitForTimeout(1500);
    const go_text = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('.screen')).find((s) => !s.classList.contains('hidden'))?.textContent ?? '',
    );
    report('daily logged with streak shown', /DAILY VOYAGE LOGGED - streak 1/.test(go_text), go_text.slice(0, 100));

    await page.keyboard.press('KeyR');
    await page.waitForTimeout(500);
    const tabs = page.locator('.gallery:not(.hidden) .gallery-tab');
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    const rows = await page.locator('.records-row:not(.records-head)').count();
    report('records board logs the daily run', rows >= 1, `rows=${rows}`);
    await page.keyboard.press('Escape');
  }

  // Metrics debug panel.
  await page.goto(`${BASE_URL}?debug=metrics`);
  await page.waitForTimeout(2500);
  const panel_text = await page.evaluate(
    () => Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.includes('tir.metrics.v1'))?.textContent ?? '',
  );
  report('metrics debug panel renders', /runs_total/.test(panel_text) && /play_days_last_7/.test(panel_text), panel_text.slice(0, 80));

  await browser.close();
}

async function mobile_pass(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console_errors.push(`mobile: ${m.text()}`);
  });
  page.on('pageerror', (e) => console_errors.push(`mobile: ${String(e)}`));

  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);

  const title_size = await page.evaluate(() => {
    const title = document.querySelector('.game-title');
    return title ? getComputedStyle(title).fontSize : '';
  });
  report('responsive title scales down on mobile', title_size === '38px', title_size);

  // Tap to start.
  await page.touchscreen.tap(195, 400);
  await page.waitForTimeout(1200);

  const touch_visible = await page.locator('.touch-controls:not(.hidden)').count();
  const steps = await page.locator('.touch-telegraph-step').count();
  report('touch controls appear on run start', touch_visible === 1 && steps === 6, `steps=${steps}`);

  // Skip tutorial via tapping is not bound; dismiss by performing actions: tap FULL+ telegraph step (top).
  const step_box = await page.locator('.touch-telegraph-step').first().boundingBox();
  if (step_box) {
    await page.touchscreen.tap(step_box.x + step_box.width / 2, step_box.y + step_box.height / 2);
    await page.waitForTimeout(1500);
  }
  const telegraph_label = await page.locator('.telegraph-label').textContent();
  report('touch telegraph sets FULL AHEAD', telegraph_label === 'FULL AHEAD', telegraph_label ?? 'none');

  // Drag the rudder pad and verify the handle moves.
  const pad_box = await page.locator('.touch-rudder-pad').boundingBox();
  if (pad_box) {
    const cx = pad_box.x + pad_box.width / 2;
    const cy = pad_box.y + pad_box.height / 2;
    await page.evaluate(
      ([x, y]) => {
        const pad = document.querySelector('.touch-rudder-pad');
        if (!pad) return;
        pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
        pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: x + 70, clientY: y, bubbles: true }));
      },
      [cx, cy],
    );
    await page.waitForTimeout(300);
    const handle_left = await page.evaluate(
      () => (document.querySelector('.touch-rudder-handle') as HTMLElement | null)?.style.left ?? '',
    );
    report('rudder drag moves handle', handle_left !== '50%' && handle_left !== '', handle_left);
  }

  await page.screenshot({ path: 'scripts/qa_final_mobile.png' });
  await browser.close();
}

async function main(): Promise<void> {
  await desktop_pass();
  await mobile_pass();

  for (const line of results) process.stdout.write(line + '\n');
  process.stdout.write(`CONSOLE_ERRORS=${console_errors.length}\n`);
  for (const err of console_errors.slice(0, 5)) process.stdout.write(`  ${err}\n`);
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  process.stdout.write(failed === 0 ? 'QA_RESULT=ALL_PASS\n' : `QA_RESULT=${failed}_FAILURES\n`);
  process.exit(failed === 0 && console_errors.length === 0 ? 0 : 1);
}

void main();
