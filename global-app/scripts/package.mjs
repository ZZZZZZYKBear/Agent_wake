/**
 * Package the tray app without requiring GitHub access.
 *
 * electron-packager normally asks @electron/get to verify the downloaded
 * Electron zip against SHASUMS256.txt; when that fetch fails it re-downloads the
 * whole zip. If a cached zip exists under %LOCALAPPDATA%\electron\Cache we point
 * packager at it with --electron-zip-dir and skip the network entirely.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const zipName = `electron-v${electronVersion}-win32-x64.zip`;
const cacheRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "electron", "Cache") : "";

let zipDir = null;
if (cacheRoot && fs.existsSync(cacheRoot)) {
  for (const entry of fs.readdirSync(cacheRoot)) {
    const candidate = path.join(cacheRoot, entry, zipName);
    if (fs.existsSync(candidate)) {
      zipDir = path.join(cacheRoot, entry);
      break;
    }
  }
}

const IGNORE =
  "^/(node_modules|\\.pack-cache|\\.npm-cache|\\.electron-profile|\\.hotkey-profile|\\.final-profile|\\.task-profile|\\.data|\\.cmd-profile.*|release|test-.*\\.js|app-.*\\.txt|h-.*\\.txt|p-.*\\.txt|task.*\\.log|agent-ping-global\\.log)";

const args = [
  ".",
  "AgentPing",
  "--platform=win32",
  "--arch=x64",
  "--out=release",
  "--overwrite",
  "--icon=assets/icon.ico",
  `--ignore=${IGNORE}`
];
if (zipDir) args.push(`--electron-zip-dir=${zipDir}`);

console.log(zipDir ? `using cached Electron zip: ${zipDir}` : "no cached Electron zip; packager will download");
const packagerBin = path.resolve("node_modules/@electron/packager/bin/electron-packager.mjs");
if (!fs.existsSync(packagerBin)) {
  console.error("electron-packager is not installed; run npm install first");
  process.exit(1);
}
execFileSync(process.execPath, [packagerBin, ...args], { stdio: "inherit" });
execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/build-shortcut.ps1"], { stdio: "inherit" });
