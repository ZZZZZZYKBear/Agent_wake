# Agent Ping Global

The Windows-side companion for Agent Ping. It runs in the tray, registers system-wide hotkeys, shows a transparent signal wheel over any application, captures a screenshot of the marked area, and forwards the signal to the DSH plugin's loopback bridge.

This is what makes Agent Ping usable while DSH is in the background.

## Requirements

1. DSH with `dsh-agent-ping` **0.2.0** installed and enabled.
2. Restart DSH once after installing 0.2.0 so the host bridge starts.
3. Windows 10/11.

The bridge status is shown in the tray menu. If it says `DSH 未连接`, start DSH and make sure the plugin is enabled.

## Run

### Packaged build

Run **`AgentPing.cmd`** (recommended) or **`AgentPing.lnk`**:

```text
release\AgentPing-win32-x64\AgentPing.cmd
```

Both launch `AgentPingCore.exe` with the required flag:

```text
--no-sandbox
```

Do **not** double-click `AgentPingCore.exe` directly; on some machines Electron exits silently without that flag. If you hit GPU driver problems, add `--disable-gpu` manually.

Windows SmartScreen may block the unsigned executable once. Choose **More info → Run anyway**. On first launch a small dialog shows the actual global hotkeys; after dismissing it the app stays in the notification area / tray.

Runtime data (logs, first-run marker, cache) is stored **next to the executable** in `AgentPingData/`, so the app does not depend on AppData permissions.

### If the hotkey does not respond

1. Open Task Manager and look for `AgentPingCore.exe`. If it is absent, the app did not start.
2. Run `AgentPing.cmd` from a PowerShell/CMD window so the console stays open and shows errors.
3. Read `release\AgentPing-win32-x64\AgentPingData\agent-ping-global.log`; the `shortcuts` line shows the keys that actually registered.
4. The first-run dialog may be behind the current window. Look for **Agent Ping 已启动** in the taskbar.
5. If SmartScreen blocked the app, allow it once via **More info → Run anyway**.

`AgentPing.lnk` stores an absolute target path. If you move the folder, use `AgentPing.cmd` instead or recreate the shortcut.

### From source

```powershell
npm install
npm start
```

`npm start` first copies the current DSH plugin client into `renderer/` (`npm run sync`) and then starts Electron.

## Use

| Action | How |
| --- | --- |
| Arm signal wheel | `Shift + Alt + Q` (fallback shown in tray) |
| Arm emote wheel | `Shift + Alt + E` (fallback shown in tray) |
| Settings | `Shift + Alt + P` or tray → 设置 |
| Open at cursor | Move the mouse after the hotkey; the wheel opens at the first pointer position |
| Select a sector | Move the mouse and **click** the sector |
| Question | Click the `?` sector, type, `Ctrl + Enter` |
| Close | `Esc` or click outside |

Because these are OS-level shortcuts, the interaction is **press → move → click**, not the in-page hold-and-drag gesture. The first `pointermove` event decides the wheel center; this avoids the Windows 150% DPI mismatch between the OS cursor and browser CSS coordinates, so the wheel center, laser line and cursor dot stay aligned.

The tray menu always shows the keys that actually registered. All defaults use `Shift + Alt + letter`; if one is occupied, the app falls back through other `Shift + Alt + letter` combinations rather than plain `Alt` menus.

The global overlay disables backdrop blur, rotating rune animations and per-sector drop shadows, and is launched with hardware acceleration (only `--no-sandbox` is forced). This keeps dragging/selection smooth.

## What gets sent

The overlay captures the screen around the cursor before showing itself, saves a PNG to:

```text
%USERPROFILE%\.dsh\agent-ping\shots\
```

and sends:

- the prompt text (`提问` / `危险` / `继续工作` / custom emote command)
- the screenshot path
- the desktop display and global cursor coordinates
- a preview image in the question composer

The DSH plugin receives the signal over SSE and sends it to the active conversation through `session.prompt()`.

## Tray and queue

- Tray status: `已连接 DSH` / `DSH 已启动，等待页面连接` / `DSH 未连接`.
- If DSH is not reachable, signals are queued in memory and retried every 5 seconds.
- `重试待发送` in the tray flushes the queue immediately.
- If the DSH page is connected but no conversation is active, the plugin queues the signal until a session binds.

## Configuration and security

- Bridge port is chosen from `127.0.0.1:47654` upward; the active port/token is in `$DSH_HOME\agent-ping-bridge.json`.
- The global app reads that file for every send; no token needs to be typed.
- `/signal` requires `X-Agent-Ping-Token`; `/events` is read-only and loopback-only; `/focus` receives the DSH page focus state.
- When DSH reports focus, the app suspends its OS-wide shortcuts so the in-page wheel receives the same keys. When DSH loses focus, the global shortcuts are registered again. Health polling is 1.2s with a 12s focus lease.
- The app never uploads screenshots anywhere; they stay on disk.
- `--remote-debugging-port` is not enabled in normal runs. Do not leave a debugging port open.

## Build

```powershell
npm run package
```

Output: `release\AgentPing-win32-x64\` with `AgentPingCore.exe`, `AgentPing.cmd` and `AgentPing.lnk`. Use the cmd or shortcut, not the core executable.

## Files

```text
global-app/
  main.js              # tray, global hotkeys, overlay windows, screenshot, bridge client
  preload.js           # narrow IPC bridge
  renderer/index.html  # transparent overlay host
  renderer/overlay.js  # mock session adapter for the shared wheel
  renderer/agent-ping-client.js  # synced copy of the DSH client bundle
  assets/              # tray + app icons
  scripts/sync-client.mjs
  scripts/build-shortcut.ps1  # renames Electron core, writes AgentPing.cmd/.lnk
```

The renderer reuses the DSH plugin's `createAgentPing(ctx, { globalMode: true })`; the only difference is that `session.prompt()` is replaced by an IPC call to the local bridge.
