const { chromium } = require("D:\\Mydocument\\projects\\agent_wake\\global-app\\.test-tools\\node_modules\\playwright-core");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Users\\Bear\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await page.goto("http://127.0.0.1:8765/preview/index.html?clean=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  await page.evaluate(() => window.__agentPingDemo.openPing());
  await page.waitForTimeout(250);
  const wheel = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return { center: c.wheel.center, radius: c.wheel.radius };
  });
  await page.mouse.move(wheel.center.x, wheel.center.y - wheel.radius * 0.64, { steps: 6 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "D:\\Mydocument\\projects\\agent_wake\\screenshots\\02-ping-wheel.png" });

  await page.evaluate(() => window.__agentPingDemo.openAsk());
  await page.waitForTimeout(300);
  await page.screenshot({ path: "D:\\Mydocument\\projects\\agent_wake\\screenshots\\03-question.png" });

  await page.evaluate(() => window.__agentPingDemo.openEmote());
  await page.waitForTimeout(250);
  const emote = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return { center: c.wheel.center, radius: c.wheel.radius };
  });
  await page.mouse.move(emote.center.x + emote.radius * 0.48, emote.center.y + emote.radius * 0.38, { steps: 6 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "D:\\Mydocument\\projects\\agent_wake\\screenshots\\05-emote-wheel.png" });

  await page.evaluate(() => window.__agentPingDemo.openSettings());
  await page.waitForTimeout(300);
  await page.screenshot({ path: "D:\\Mydocument\\projects\\agent_wake\\screenshots\\06-settings.png" });
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });

