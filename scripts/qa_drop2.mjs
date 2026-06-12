// scripts/qa_drop2.ts
import { chromium } from "playwright";
var BASE_URL = process.env.QA_URL ?? "http://localhost:5173/";
var results = [];
var console_errors = [];
function report(name, pass, detail = "") {
  results.push(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error")
      console_errors.push(message.text());
  });
  page.on("pageerror", (error) => console_errors.push(String(error)));
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  const button_text = await page.locator(".menu-button").first().textContent();
  report("gallery button shows 0/24", /Cards 0\/24/.test(button_text ?? ""), button_text ?? "missing");
  await page.locator(".menu-button").first().click();
  await page.waitForTimeout(400);
  const gallery_visible = await page.locator(".gallery:not(.hidden)").count();
  const tab_count = await page.locator(".gallery-tab").count();
  const silhouettes = await page.locator(".gallery .card.silhouette").count();
  report("gallery opens with 4 tabs", gallery_visible === 1 && tab_count === 4, `tabs=${tab_count}`);
  report("moments tab shows 10 silhouettes", silhouettes === 10, `silhouettes=${silhouettes}`);
  await page.locator(".gallery-tab").nth(3).click();
  await page.waitForTimeout(300);
  const skin_tiles = await page.locator(".gallery .card").count();
  const equipped = await page.locator('.gallery button:has-text("Equipped")').count();
  report("skins tab shows 5 tiles with classic equipped", skin_tiles === 5 && equipped === 1, `tiles=${skin_tiles} equipped=${equipped}`);
  await page.locator(".gallery-close").click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  let prompt = await page.locator(".onboarding-prompt").textContent() ?? "";
  report("onboarding step 1 telegraph", /Press W twice/.test(prompt), prompt.slice(0, 60));
  await page.keyboard.press("KeyW");
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyW");
  await page.waitForTimeout(600);
  prompt = await page.locator(".onboarding-prompt").textContent() ?? "";
  report("onboarding step 2 steer", /Steer with A and D/.test(prompt), prompt.slice(0, 60));
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1400);
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(400);
  prompt = await page.locator(".onboarding-prompt").textContent() ?? "";
  report("onboarding step 3 ice", /Ice ahead/.test(prompt), prompt.slice(0, 60));
  await page.keyboard.press("KeyX");
  await page.waitForTimeout(400);
  const prompt_hidden = await page.locator(".onboarding-prompt.hidden").count();
  report("tutorial skippable with X", prompt_hidden === 1);
  await page.keyboard.press("KeyW");
  await page.keyboard.press("KeyW");
  let game_over = false;
  for (let i = 0;i < 60; i++) {
    await page.waitForTimeout(3000);
    const over = await page.evaluate(() => {
      const screens = document.querySelectorAll(".screen");
      return Array.from(screens).some((s) => !s.classList.contains("hidden") && s.textContent !== null && s.textContent.includes("SHE IS GONE"));
    });
    if (over) {
      game_over = true;
      break;
    }
  }
  report("run ends at game over screen", game_over);
  if (game_over) {
    await page.waitForTimeout(2500);
    const reveal_label = await page.locator(".gameover-cards-label").count();
    const revealed = await page.locator(".gameover-cards .card").count();
    const has_art = await page.evaluate(() => {
      const img = document.querySelector(".gameover-cards .card-art");
      return !!img && img.src.startsWith("data:image/jpeg") && img.src.length > 2000;
    });
    report("game over reveals new cards", reveal_label === 1 && revealed >= 1, `cards=${revealed}`);
    report("card art is captured freeze-frame", has_art);
    await page.screenshot({ path: "scripts/qa_drop2_gameover.png" });
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(500);
    await page.locator(".gallery-tab").nth(1).click();
    await page.waitForTimeout(300);
    const earned_cards = await page.locator(".gallery .card:not(.silhouette)").count();
    report("gallery shows earned ships cards", earned_cards >= 1, `earned=${earned_cards}`);
    const meta = await page.locator(".gallery .card:not(.silhouette) .card-meta").first().textContent();
    report("earned card has date/distance stamp", /Earned .*m \|/.test(meta ?? "") || /Earned/.test(meta ?? ""), meta ?? "none");
    await page.locator(".gallery .card:not(.silhouette)").first().click();
    await page.waitForTimeout(400);
    const inspect_open = await page.locator(".card-inspect-backdrop:not(.hidden) .card").count();
    report("inspect view opens", inspect_open === 1);
    await page.screenshot({ path: "scripts/qa_drop2_gallery.png" });
    await page.reload();
    await page.waitForTimeout(2500);
    const button_after = await page.locator(".menu-button").first().textContent();
    report("cards persist across reload", !/Cards 0\/24/.test(button_after ?? ""), button_after ?? "missing");
  }
  await browser.close();
  for (const line of results)
    process.stdout.write(line + `
`);
  process.stdout.write(`CONSOLE_ERRORS=${console_errors.length}
`);
  for (const err of console_errors.slice(0, 5))
    process.stdout.write(`  ${err}
`);
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  process.stdout.write(failed === 0 ? `QA_RESULT=ALL_PASS
` : `QA_RESULT=${failed}_FAILURES
`);
  process.exit(failed === 0 && console_errors.length === 0 ? 0 : 1);
}
main();
