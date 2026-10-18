const {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  ipcMain,
  screen,
  nativeImage,
  Notification,
  dialog
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const { captureTarget } = require("./capture");

const APP_ID = "com.deepseek.agentping.global";
const exeDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, ".data");
const portableData = path.join(exeDir, "AgentPingData");
try {
  fs.mkdirSync(portableData, { recursive: true });
  app.setPath("userData", portableData);
} catch {}

const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABRklEQVR4nM2XsQ0CMQxFY3M7IDECE1xHh5iAhoKOkmEo6ShobgJER8cEDECDGAKBgohkWfZh5yLdfQkpHE7ejxMfSQg9C3I6XZvtW/utXu5cY0IJaBczkAOebRo1/rJfuoyAFU6ho9NhpfV5LdZHyYxmAjzwBKYQLh7zzwS0wT1gqxFuAixwD1gy0mYCJbjUOVexP98zlINSpzh7K/x5O5tNSNWD3FVbiZVQGj/xUAoqOfu2pVANeOUxwgU8/bmzH0/nJmAaP1UEhp5VlUp3em7NhMvA07HGNNZiprIMKg2Uuwe4MHTQ5P74froIu8CldpaB+vfnEEtDe2GUEC/ByO29DFF6aMnCa7EW25q0FxymBl0GqyLYAqfiZwLUgkruBb72VEi/8ONSCRNS6ikHBncmHMSpeBD3gkHcjAJRb3dDrxnv7fgDgKwNyebPPUcAAAAASUVORK5CYII=";
let logFile = null;

function log(...args) {
  try {
    if (!logFile) logFile = path.join(app.getPath("userData"), "agent-ping-global.log");
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${args.map((value) => (typeof value === "string" ? value : JSON.stringify(value))).join(" ")}\n`, "utf8");
  } catch {}
}
const PING_KEY = "Shift+Alt+Q";
const EMOTE_KEY = "Shift+Alt+E";
const SETTINGS_KEY = "Shift+Alt+P";
const FALLBACK_KEYS = { ping: "Shift+Alt+W", emote: "Shift+Alt+R", settings: "Shift+Alt+O" };

let tray = null;
let currentWindow = null;
let currentDisplayId = null;
let hideTimer = null;
let statusTimer = null;
let flushTimer = null;
let health = { kind: "unknown", clients: 0 };
let outbox = [];
let activeKeys = { ping: PING_KEY, emote: EMOTE_KEY, settings: SETTINGS_KEY };
let dshFocused = false;
let hotkeysSuppressed = false;
const overlays = new Map();

log("module loaded", process.argv);
app.setAppUserModelId(APP_ID);
const gotLock = app.requestSingleInstanceLock();
log("single instance lock", gotLock);
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    openAtPoint("ping", screen.getCursorScreenPoint()).catch((error) => console.error(error));
  });
}

function bridgeFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  return path.join(home, "agent-ping-bridge.json");
}

function readBridge() {
  try {
    const value = JSON.parse(fs.readFileSync(bridgeFile(), "utf8"));
    if (!value || !value.port || !value.token) return null;
    return value;
  } catch {
    return null;
  }
}

function loopback(method, pathname, body, timeoutMs = 2400) {
  return new Promise((resolve) => {
    const config = readBridge();
    if (!config) {
      resolve({ ok: false, error: "bridge-offline" });
      return;
    }
    const data = body ? JSON.stringify(body) : null;
    const request = http.request(
      {
        host: "127.0.0.1",
        port: config.port,
        path: pathname,
        method,
        headers: {
          "x-agent-ping-token": config.token,
          ...(data
            ? {
                "content-type": "application/json; charset=utf-8",
                "content-length": Buffer.byteLength(data)
              }
            : {})
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {}
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data: parsed });
        });
      }
    );
    request.on("error", (error) => resolve({ ok: false, error: error.code || error.message }));
    request.setTimeout(timeoutMs, () => request.destroy(new Error("timeout")));
    if (data) request.write(data);
    request.end();
  });
}

async function postSignal(payload) {
  let result = await loopback("POST", "/signal", payload);
  if (!result.ok && result.status === 401) {
    await new Promise((resolve) => setTimeout(resolve, 160));
    result = await loopback("POST", "/signal", payload);
  }
  return result;
}

async function checkHealth() {
  const result = await loopback("GET", "/health");
  if (result.ok && result.data && result.data.service === "dsh-agent-ping") {
    health = { kind: result.data.clients > 0 ? "connected" : "waiting", clients: result.data.clients || 0 };
    setDshFocused(Boolean(result.data.dshFocused));
  } else {
    health = { kind: "offline", clients: 0 };
    setDshFocused(false);
  }
  updateTray();
  return health;
}

// While the DSH window has focus, its in-page client owns the same
// Shift+Alt shortcuts. Suspend the OS-wide registrations so the page receives
// the keys; restore them as soon as DSH loses focus.
function setDshFocused(next) {
  if (next === dshFocused) return;
  dshFocused = next;
  if (dshFocused) {
    hotkeysSuppressed = true;
    try {
      globalShortcut.unregisterAll();
    } catch {}
    log("dsh focused; global hotkeys suspended");
  } else {
    hotkeysSuppressed = false;
    registerHotkeys(true);
    log("dsh blurred; global hotkeys restored");
  }
  updateTray();
}

function notify(title, body) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title, body, silent: true }).show();
  } catch {}
}

function enqueue(payload) {
  outbox.push({ payload, at: Date.now() });
  while (outbox.length > 16) outbox.shift();
  updateTray();
}

async function flushOutbox() {
  if (outbox.length === 0) return;
  const config = readBridge();
  if (!config) {
    updateTray();
    return;
  }
  const batch = outbox.splice(0);
  let failed = false;
  for (const entry of batch) {
    if (failed) {
      outbox.push(entry);
      continue;
    }
    const result = await postSignal(entry.payload);
    if (!result.ok) {
      outbox.push(entry);
      failed = true;
    }
  }
  updateTray();
}

async function buildTarget(display, point) {
  const shot = await captureTarget(display, point, { log }).catch((error) => {
    log("capture: unexpected failure", error && error.message);
    return null;
  });
  if (!shot) log("capture: no screenshot available", display.label);
  const localX = point.x - display.bounds.x;
  const localY = point.y - display.bounds.y;
  const displayLabel = display.label || `显示器 ${display.id}`;
  const lines = [];
  if (shot) {
    lines.push(`屏幕截图：${shot.path}`);
    lines.push("截图是标记点周围约 430×300 的桌面区域。");
  } else {
    lines.push("屏幕截图：捕获失败（仍可按坐标和用户问题处理）");
  }
  lines.push(`全局屏幕坐标：(${point.x}, ${point.y})`);
  return {
    x: localX,
    y: localY,
    screenX: point.x,
    screenY: point.y,
    selector: `桌面 / ${displayLabel} / (${point.x}, ${point.y})`,
    label: `桌面标记 · ${displayLabel}`,
    text: lines.join("\n"),
    tag: "desktop",
    rect: { left: localX - 72, top: localY - 54, width: 144, height: 108 },
    url: "global-desktop",
    preview: shot ? shot.dataUrl : ""
  };
}

function ensureOverlay(display) {
  const existing = overlays.get(display.id);
  if (existing && !existing.isDestroyed()) return existing;
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.__ready = false;
  win.__readyPromise = new Promise((resolve) => {
    win.webContents.once("did-finish-load", () => {
      win.__ready = true;
      resolve();
    });
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("blur", () => {
    if (currentWindow !== win) return;
    setTimeout(() => {
      if (currentWindow === win && !win.isDestroyed() && !win.isFocused()) {
        hideCurrent();
      }
    }, 220);
  });
  win.on("closed", () => overlays.delete(display.id));
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  overlays.set(display.id, win);
  return win;
}

async function showOverlay(display, mode) {
  const win = ensureOverlay(display);
  await win.__readyPromise;
  if (win.isDestroyed()) return null;
  const previous = currentWindow;
  if (previous && previous !== win && !previous.isDestroyed()) {
    previous.webContents.send("close-overlay");
    previous.hide();
    previous.setIgnoreMouseEvents(true, { forward: true });
  }
  currentWindow = win;
  currentDisplayId = display.id;
  clearTimeout(hideTimer);
  win.setBounds(display.bounds);
  win.show();
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(false);
  win.focus();
  return win;
}

function normalizeScreenPoint(point, display) {
  const localX = point.x - display.bounds.x;
  const localY = point.y - display.bounds.y;
  if (localX >= 0 && localY >= 0 && localX <= display.bounds.width && localY <= display.bounds.height) return point;
  try {
    if (typeof screen.screenToDipPoint === "function") {
      const dip = screen.screenToDipPoint(point);
      if (dip && Number.isFinite(dip.x) && Number.isFinite(dip.y)) return dip;
    }
  } catch {}
  const scale = display.scaleFactor || 1;
  return { x: display.bounds.x + localX / scale, y: display.bounds.y + localY / scale };
}

async function openAtPoint(mode, point) {
  log("openAtPoint", mode, point);
  const display = screen.getDisplayNearestPoint(point);
  const normalized = normalizeScreenPoint(point, display);
  log("display", {
    bounds: display.bounds,
    scaleFactor: display.scaleFactor,
    original: point,
    normalized
  });
  if (currentWindow) hideCurrent();
  const target = await buildTarget(display, normalized);
  const win = await showOverlay(display, mode);
  if (!win) return;
  if (win.isDestroyed() || currentWindow !== win) return;
  win.webContents.send("open-wheel", {
    mode,
    point: { x: normalized.x - display.bounds.x, y: normalized.y - display.bounds.y },
    target
  });
}

async function openSettings() {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const win = await showOverlay(display, "settings");
  if (!win) return;
  win.webContents.send("open-settings");
}

function hideCurrent() {
  const win = currentWindow;
  currentWindow = null;
  currentDisplayId = null;
  if (!win || win.isDestroyed()) return;
  win.webContents.send("close-overlay");
  win.hide();
  win.setIgnoreMouseEvents(true, { forward: true });
}

function hideOtherOverlays(keepId) {
  for (const [id, win] of overlays) {
    if (id === keepId || win.isDestroyed()) continue;
    try {
      win.webContents.send("close-overlay");
      win.hide();
      win.setIgnoreMouseEvents(true, { forward: true });
    } catch {}
  }
}

function registerHotkeys(silent = false) {
  if (hotkeysSuppressed) return;
  globalShortcut.unregisterAll();
  const candidates = {
    ping: [PING_KEY, FALLBACK_KEYS.ping, "Shift+Alt+J", "Shift+Alt+K", "Shift+Alt+A"],
    emote: [EMOTE_KEY, FALLBACK_KEYS.emote, "Shift+Alt+T", "Shift+Alt+Y", "Shift+Alt+U"],
    settings: [SETTINGS_KEY, FALLBACK_KEYS.settings, "Shift+Alt+S", "Shift+Alt+D", "Shift+Alt+F"]
  };
  const handlers = {
    ping: () => {
      log("hotkey ping", activeKeys.ping);
      openAtPoint("ping", screen.getCursorScreenPoint()).catch((error) => log("open ping error", error.message));
    },
    emote: () => {
      log("hotkey emote", activeKeys.emote);
      openAtPoint("emote", screen.getCursorScreenPoint()).catch((error) => log("open emote error", error.message));
    },
    settings: () => {
      log("hotkey settings", activeKeys.settings);
      openSettings().catch((error) => log("open settings error", error.message));
    }
  };
  activeKeys = { ping: "", emote: "", settings: "" };
  for (const action of ["ping", "emote", "settings"]) {
    for (const key of candidates[action]) {
      try {
        if (globalShortcut.register(key, handlers[action])) {
          activeKeys[action] = key;
          break;
        }
      } catch {}
    }
  }
  log("shortcuts", activeKeys);
  const changed = activeKeys.ping !== PING_KEY || activeKeys.emote !== EMOTE_KEY || activeKeys.settings !== SETTINGS_KEY;
  if (changed) {
    const labels = [activeKeys.ping, activeKeys.emote, activeKeys.settings].filter(Boolean).join(" / ");
    log("shortcuts changed", labels);
    if (!silent) {
      if (activeKeys.ping && activeKeys.emote) {
        notify("Agent Ping 快捷键", `当前使用：${labels}`);
      } else {
        notify("Agent Ping 快捷键冲突", "部分全局快捷键被占用，请从托盘菜单打开。");
      }
    }
  }
}

function updateTray() {
  if (!tray) return;
  const statusText =
    health.kind === "connected"
      ? "已连接 DSH"
      : health.kind === "waiting"
        ? "DSH 已启动，等待页面连接"
        : health.kind === "offline"
          ? "DSH 未连接"
          : "正在检测 DSH…";
  const queueText = outbox.length > 0 ? ` · ${outbox.length} 条待发送` : "";
  tray.setToolTip(`Agent Ping · ${statusText}${queueText}`);
  const menu = Menu.buildFromTemplate([
    { label: "Agent Ping Global", enabled: false },
    { label: `${statusText}${queueText}`, enabled: false },
    ...(hotkeysSuppressed ? [{ label: "DSH 聚焦：快捷键由页面内轮盘处理", enabled: false }] : []),
    { type: "separator" },
    { label: `信号轮盘   ${activeKeys.ping || "未注册"}`, click: () => openAtPoint("ping", screen.getCursorScreenPoint()).catch(() => {}) },
    { label: `表情轮盘   ${activeKeys.emote || "未注册"}`, click: () => openAtPoint("emote", screen.getCursorScreenPoint()).catch(() => {}) },
    { label: `设置   ${activeKeys.settings || "托盘菜单"}`, click: () => openSettings().catch(() => {}) },
    { type: "separator" },
    { label: `重试待发送${outbox.length ? ` (${outbox.length})` : ""}`, enabled: outbox.length > 0, click: () => flushOutbox() },
    {
      label: "退出",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  let image = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  if (!image || image.isEmpty()) {
    try {
      image = nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
    } catch {}
  }
  if (!image || image.isEmpty()) image = nativeImage.createEmpty();
  try {
    tray = new Tray(image);
    tray.on("double-click", () => openSettings().catch(() => {}));
    updateTray();
  } catch (error) {
    log("tray failed", error.message);
    tray = null;
  }
}

ipcMain.on("overlay-state", (event, value) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const active = Boolean(value && value.active);
  if (active) {
    clearTimeout(hideTimer);
    win.show();
    win.setIgnoreMouseEvents(false);
    win.focus();
    return;
  }
  win.setIgnoreMouseEvents(true, { forward: true });
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (currentWindow === win) {
      win.hide();
      currentWindow = null;
      currentDisplayId = null;
    }
  }, 1600);
});

ipcMain.on("close-overlay-request", () => hideCurrent());

ipcMain.handle("send-signal", async (event, payload) => {
  if (!payload || typeof payload !== "object" || typeof payload.prompt !== "string" || !payload.prompt.trim()) {
    return { ok: false, error: "invalid payload" };
  }
  const result = await postSignal(payload);
  if (result.ok) {
    const delivered = result.data && typeof result.data.delivered === "number" ? result.data.delivered : 0;
    return { ok: true, queued: delivered === 0, delivered };
  }
  enqueue(payload);
  return { ok: true, queued: true };
});

app.whenReady().then(() => {
  if (process.argv.includes("--capture-test")) {
    const display = screen.getPrimaryDisplay();
    const point = screen.getCursorScreenPoint();
    buildTarget(display, point)
      .then((target) => {
        log("capture-test", {
          point,
          text: target && target.text,
          preview: Boolean(target && target.preview)
        });
      })
      .catch((error) => log("capture-test failed", error && error.message))
      .finally(() => app.quit());
    return;
  }
  log("ready", { electron: process.versions.electron, dshHome: process.env.DSH_HOME || "" });
  createTray();
  registerHotkeys();
  checkHealth().catch(() => {});
  statusTimer = setInterval(() => checkHealth().catch(() => {}), 1200);
  flushTimer = setInterval(() => flushOutbox().catch(() => {}), 5000);
  const demo = process.argv.find((arg) => arg.startsWith("--demo="));
  let firstRun = false;
  try {
    firstRun = !fs.existsSync(path.join(app.getPath("userData"), ".started"));
  } catch {
    firstRun = true;
  }
  if (!demo && (firstRun || process.argv.includes("--status"))) {
    setTimeout(() => {
      const detail = [
        `信号轮盘：${activeKeys.ping || "未注册"}`,
        `表情轮盘：${activeKeys.emote || "未注册"}`,
        `设置：${activeKeys.settings || "参见托盘菜单"}`,
        "",
        "程序已留在托盘；如果看不到托盘图标，上面的全局快捷键仍然可用。"
      ].join("\n");
      dialog
        .showMessageBox({
          type: "info",
          title: "Agent Ping 已启动",
          message: "全局信号轮盘已就绪",
          detail,
          buttons: ["开始使用"],
          noLink: true
        })
        .then(() => {
          try {
            fs.writeFileSync(path.join(app.getPath("userData"), ".started"), new Date().toISOString(), "utf8");
          } catch {}
        })
        .catch(() => {});
    }, 900);
  }
  if (demo) {
    const mode = demo.slice("--demo=".length);
    const pointArg = process.argv.find((arg) => arg.startsWith("--demo-point="));
    let point = screen.getCursorScreenPoint();
    if (pointArg) {
      const [x, y] = pointArg.slice("--demo-point=".length).split(",").map(Number);
      if (Number.isFinite(x) && Number.isFinite(y)) point = { x, y };
    }
    setTimeout(() => {
      if (mode === "settings") openSettings().catch((error) => console.error(error));
      else openAtPoint(mode === "emote" ? "emote" : "ping", point).catch((error) => console.error(error));
    }, 900);
  }
});

app.on("window-all-closed", () => {
  // Keep the tray host alive even when every overlay is hidden.
});

app.on("will-quit", () => {
  clearInterval(statusTimer);
  clearInterval(flushTimer);
  globalShortcut.unregisterAll();
  for (const win of overlays.values()) {
    try {
      win.destroy();
    } catch {}
  }
});
