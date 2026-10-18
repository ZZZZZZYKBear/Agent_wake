const { chromium } = require("D:\\Mydocument\\projects\\agent_wake\\global-app\\.test-tools\\node_modules\\playwright-core");

async function pressCombo(page, combo) {
  const parts = combo.split("+");
  const key = parts.pop();
  for (const mod of parts) await page.keyboard.down(mod);
  await page.keyboard.down(key);
  await page.keyboard.up(key);
  for (const mod of parts.reverse()) await page.keyboard.up(mod);
  await page.waitForTimeout(300);
}

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

  await page.mouse.move(50, 50);
  await pressCombo(page, "Shift+Alt+Q");
  const edge = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return {
      center: c.wheel?.center,
      radius: c.wheel?.radius,
      dot: { l: document.querySelector("[data-ap-cursor]")?.style.left, t: document.querySelector("[data-ap-cursor]")?.style.top },
      hint: document.querySelector("[data-ap-hint]")?.textContent
    };
  });
  console.log("EDGE", JSON.stringify(edge));
  await page.keyboard.press("Escape");

  await page.mouse.move(850, 500);
  await pressCombo(page, "Shift+Alt+E");
  const emote = await page.evaluate(() => ({
    mode: document.querySelector("[data-ap-mode]")?.textContent,
    center: window.__agentPingDemo.controller.wheel?.center
  }));
  console.log("EMOTE", JSON.stringify(emote));
  await page.keyboard.press("Escape");

  await pressCombo(page, "Shift+Alt+P");
  const settings = await page.evaluate(() => ({
    open: Boolean(document.querySelector(".ap-settings .ap-card")),
    ping: document.querySelector('[data-ap-capture="pingKey"]')?.textContent,
    emote: document.querySelector('[data-ap-capture="emoteKey"]')?.textContent,
    settings: document.querySelector('[data-ap-capture="settingsKey"]')?.textContent
  }));
  console.log("SETTINGS", JSON.stringify(settings));

  await page.click('[data-ap-capture="pingKey"]');
  await page.keyboard.down("Shift");
  await page.keyboard.down("Alt");
  await page.keyboard.down("w");
  await page.keyboard.up("w");
  await page.keyboard.up("Alt");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(300);
  const captured = await page.evaluate(() => {
    const c = window.__agentPingDemo.controller;
    return {
      ping: c.settings.pingKey,
      button: document.querySelector('[data-ap-capture="pingKey"]')?.textContent,
      stored: JSON.parse(localStorage.getItem("dsh-agent-ping:v1") || "{}").pingKey
    };
  });
  console.log("CAPTURED", JSON.stringify(captured));
  console.log("ERRORS", JSON.stringify(errors));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });

