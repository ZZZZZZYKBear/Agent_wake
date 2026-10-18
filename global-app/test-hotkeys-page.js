const { chromium } = require("D:\\Mydocument\\projects\\agent_wake\\global-app\\.test-tools\\node_modules\\playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Users\\Bear\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto("http://127.0.0.1:8765/preview/index.html?clean=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const defaults = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return { ping: c.settings.pingKey, emote: c.settings.emoteKey, settings: c.settings.settingsKey };
  });
  console.log("DEFAULTS", JSON.stringify(defaults));

  await page.mouse.move(850, 500);
  await page.keyboard.down("Shift");
  await page.keyboard.down("Alt");
  await page.keyboard.down("q");
  await page.waitForTimeout(350);
  const open = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return {
      cls: document.querySelector("[data-agent-ping-root]")?.className,
      center: c.wheel?.center,
      radius: c.wheel?.radius,
      hover: c.wheel?.hover,
      dot: { l: document.querySelector("[data-ap-cursor]")?.style.left, t: document.querySelector("[data-ap-cursor]")?.style.top }
    };
  });
  console.log("OPEN", JSON.stringify(open));
  await page.keyboard.up("q");
  await page.keyboard.up("Alt");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(250);
  const stillOpen = await page.evaluate(() => Boolean(window.__agentPingDemo.controller.wheel));
  console.log("STILL_OPEN_AFTER_KEYUP", stillOpen);
  if (open.center && open.radius) {
    await page.mouse.click(open.center.x + open.radius * 0.55, open.center.y, { steps: 4 });
    await page.waitForTimeout(900);
  }
  const sent = await page.evaluate(() => {
    const messages = Array.from(document.querySelectorAll(".pv-msg.user .pv-bubble")).map((el) => el.textContent);
    return messages[messages.length - 1] || "";
  });
  console.log("SENT", JSON.stringify(sent.slice(0, 90)));

  await page.keyboard.down("Shift");
  await page.keyboard.down("Alt");
  await page.keyboard.down("p");
  await page.keyboard.up("p");
  await page.keyboard.up("Alt");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(300);
  const settings = await page.evaluate(() => ({
    open: Boolean(document.querySelector(".ap-settings .ap-card")),
    ping: document.querySelector('[data-ap-capture="pingKey"]')?.textContent,
    emote: document.querySelector('[data-ap-capture="emoteKey"]')?.textContent,
    settings: document.querySelector('[data-ap-capture="settingsKey"]')?.textContent
  }));
  console.log("SETTINGS", JSON.stringify(settings));
  console.log("ERRORS", JSON.stringify(errors));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });

