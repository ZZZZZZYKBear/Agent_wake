/**
 * Screen capture for the global overlay.
 *
 * Primary path is Electron's desktopCapturer. It is known to hand back empty
 * thumbnails on some Windows/GPU combinations, so every failure is logged and
 * a DPI-aware GDI capture (PowerShell + System.Drawing) is used as fallback.
 */
const { app, desktopCapturer, nativeImage, screen } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const POWERSHELL_TIMEOUT = 15000;

function defaultHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
}

function shotsDir(home) {
  return path.join(home || defaultHome(), "agent-ping", "shots");
}

function displayRectInPixels(display) {
  const bounds = display.bounds;
  const scale = display.scaleFactor || 1;
  try {
    if (typeof screen.dipToScreenRect === "function") {
      const rect = screen.dipToScreenRect(null, bounds);
      if (rect && rect.width > 0 && rect.height > 0) {
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height))
        };
      }
    }
  } catch {}
  return {
    x: Math.round(bounds.x * scale),
    y: Math.round(bounds.y * scale),
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale))
  };
}

/**
 * Crop the given image around the pointer and persist it. The image may be a
 * full-screen thumbnail or just the display it was scaled from, so the pointer
 * is mapped proportionally to the image size.
 */
function shotLocations(home) {
  const locations = [shotsDir(home)];
  try {
    locations.push(path.join(app.getPath("userData"), "shots"));
  } catch {}
  locations.push(path.join(os.tmpdir(), "agent-ping-shots"));
  return locations;
}

/**
 * Persist the crop. The DSH home can be read-only for this process on some
 * machines (sandbox ACLs, corporate policy), so fall back to the app data dir
 * and finally the temp dir instead of losing the screenshot entirely.
 */
function writeShot(crop, home, log) {
  for (const dir of shotLocations(home)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `global-${Date.now()}.png`);
      fs.writeFileSync(file, crop.toPNG());
      return file;
    } catch (error) {
      log("capture: cannot write to", dir, error && error.code);
    }
  }
  return null;
}

function saveCrop(image, display, point, home, log) {
  if (!image || image.isEmpty()) {
    log("capture: empty image before crop");
    return null;
  }
  const imageSize = image.getSize();
  if (!imageSize.width || !imageSize.height) {
    log("capture: zero-sized image", imageSize);
    return null;
  }
  const scale = display.scaleFactor || 1;
  const localX = point.x - display.bounds.x;
  const localY = point.y - display.bounds.y;
  const px = Math.round((localX / Math.max(1, display.bounds.width)) * imageSize.width);
  const py = Math.round((localY / Math.max(1, display.bounds.height)) * imageSize.height);
  const cropWidth = Math.min(imageSize.width, Math.max(240, Math.round(430 * scale)));
  const cropHeight = Math.min(imageSize.height, Math.max(180, Math.round(300 * scale)));
  const x = Math.max(0, Math.min(imageSize.width - cropWidth, Math.round(px - cropWidth / 2)));
  const y = Math.max(0, Math.min(imageSize.height - cropHeight, Math.round(py - cropHeight / 2)));
  let crop;
  try {
    crop = image.crop({ x, y, width: cropWidth, height: cropHeight });
  } catch (error) {
    log("capture: crop failed", error && error.message, { x, y, cropWidth, cropHeight, imageSize });
    return null;
  }
  const file = writeShot(crop, home, log);
  if (!file) {
    log("capture: no writable screenshot directory");
    return null;
  }
  return { path: file, width: cropWidth, height: cropHeight, dataUrl: crop.toDataURL() };
}

async function captureWithDesktopCapturer(display, point, options) {
  const { home, log } = options;
  const scale = display.scaleFactor || 1;
  const width = Math.max(1, Math.round(display.size.width * scale));
  const height = Math.max(1, Math.round(display.size.height * scale));
  const attempts = [
    { width, height },
    { width: Math.min(1920, width), height: Math.min(1080, height) }
  ];
  for (const thumbnailSize of attempts) {
    let sources = [];
    try {
      sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize,
        fetchWindowIcons: false
      });
    } catch (error) {
      log("capture: desktopCapturer threw", error && error.message, thumbnailSize);
      continue;
    }
    if (!sources || sources.length === 0) {
      log("capture: desktopCapturer returned no screen sources", thumbnailSize);
      continue;
    }
    let source = sources.find((item) => String(item.display_id) === String(display.id));
    if (!source) source = sources.find((item) => item.name && item.name === display.label);
    if (!source) source = sources[0];
    const image = source.thumbnail;
    if (!image || image.isEmpty()) {
      log("capture: empty thumbnail", { display: display.label, source: source.name, thumbnailSize });
      continue;
    }
    const shot = saveCrop(image, display, point, home, log);
    if (shot) {
      shot.via = "desktopCapturer";
      return shot;
    }
  }
  return null;
}

function powerShellScript(rect, file) {
  const escaped = String(file).replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Drawing",
    "Add-Type @'",
    "using System.Runtime.InteropServices;",
    "public class AgentPingDpi { [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); }",
    "'@",
    "[AgentPingDpi]::SetProcessDPIAware() | Out-Null",
    "try {",
    `  $bmp = New-Object System.Drawing.Bitmap(${rect.width}, ${rect.height})`,
    "  $g = [System.Drawing.Graphics]::FromImage($bmp)",
    `  $g.CopyFromScreen(${rect.x}, ${rect.y}, 0, 0, $bmp.Size)`,
    `  $bmp.Save('${escaped}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    "  $g.Dispose()",
    "  $bmp.Dispose()",
    "} catch {",
    "  [Console]::Error.WriteLine($_.Exception.Message)",
    "  exit 1",
    "}"
  ].join("\n");
}

function captureWithPowerShell(display, point, options) {
  const { home, log } = options;
  return new Promise((resolve) => {
    const rect = displayRectInPixels(display);
    const temp = path.join(os.tmpdir(), `agent-ping-shot-${process.pid}-${Date.now()}.png`);
    const script = powerShellScript(rect, temp);
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", script],
      { windowsHide: true, timeout: POWERSHELL_TIMEOUT },
      (error, stdout, stderr) => {
        if (error) {
          log("capture: powershell fallback failed", error.message, String(stderr || "").trim().slice(-400));
          try { fs.unlinkSync(temp); } catch {}
          resolve(null);
          return;
        }
        let shot = null;
        try {
          const image = nativeImage.createFromPath(temp);
          shot = saveCrop(image, display, point, home, log);
        } catch (fallbackError) {
          log("capture: powershell image unreadable", fallbackError && fallbackError.message);
        }
        try { fs.unlinkSync(temp); } catch {}
        if (shot) {
          shot.via = "gdi";
          log("capture: GDI fallback ok", { path: shot.path, rect });
        }
        resolve(shot);
      }
    );
  });
}

/**
 * Capture the area around `point` on `display`.
 * Returns { path, width, height, dataUrl, via } or null.
 */
async function captureTarget(display, point, options = {}) {
  const logger = typeof options.log === "function" ? options.log : () => {};
  const home = options.home || defaultHome();
  const primary = await captureWithDesktopCapturer(display, point, { home, log: logger });
  if (primary) return primary;
  logger("capture: falling back to GDI", { display: display.label });
  return captureWithPowerShell(display, point, { home, log: logger });
}

module.exports = { captureTarget, displayRectInPixels, shotsDir };
