/**
 * Attach a running CLI agent (Codex, Claude Code, anything interactive) to the
 * signal hub.
 *
 * The agent is spawned inside a real Windows ConPTY, so it renders exactly as
 * it would in a terminal. Keystrokes are forwarded both ways, and a claimed
 * signal is typed into the agent's input line followed by Enter.
 */
import pty from "node-pty";
import { startHub, readHubConfig } from "./hub.js";

const WAIT_SECONDS = 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reuse a running hub or start one for this process. */
export async function ensureHub() {
  const config = readHubConfig();
  if (config && config.port && config.token) {
    try {
      const response = await fetch("http://" + (config.host || "127.0.0.1") + ":" + config.port + "/health", {
        signal: AbortSignal.timeout(1200)
      });
      if (response.ok) return { config, started: null };
    } catch {}
  }
  const hub = await startHub({ port: 47660 });
  return { config: { host: hub.host, port: hub.port, token: hub.token }, started: hub };
}

function hubBase(config) {
  return "http://" + (config.host || "127.0.0.1") + ":" + config.port;
}

function isWindows() {
  return process.platform === "win32";
}

function flatten(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/**
 * Spawn `command` inside a PTY and inject claimed signals.
 * Returns the agent's exit code.
 */
export async function attach(command, args = []) {
  const { config, started } = await ensureHub();
  if (started) {
    console.log("agent-ping: started a hub at " + hubBase(config));
    console.log("agent-ping: point the wheel at it with `AgentPingCore.exe --target=hub`");
  }

  const spawnCommand = isWindows() && !/\.exe$/i.test(command) ? process.env.ComSpec || "cmd.exe" : command;
  const spawnArgs = spawnCommand === command ? args : ["/c", command, ...args];

  const term = pty.spawn(spawnCommand, spawnArgs, {
    name: "xterm-256color",
    cols: process.stdout.columns || 120,
    rows: process.stdout.rows || 30,
    cwd: process.cwd(),
    env: process.env
  });

  let stopped = false;
  const restoreStdin = () => {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(false); } catch {}
    }
  };

  term.onData((data) => {
    process.stdout.write(data);
  });

  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    process.stdin.setRawMode(true);
  }
  process.stdin.on("data", (chunk) => {
    term.write(chunk.toString("utf8"));
  });

  const resize = () => {
    try {
      term.resize(process.stdout.columns || 120, process.stdout.rows || 30);
    } catch {}
  };
  process.stdout.on("resize", resize);

  const claimLoop = async () => {
    while (!stopped) {
      try {
        const response = await fetch(hubBase(config) + "/next?timeout=" + WAIT_SECONDS, {
          headers: { "x-agent-ping-token": config.token }
        });
        if (response.status === 204) continue;
        if (!response.ok) {
          await sleep(1000);
          continue;
        }
        const signal = await response.json();
        const line = flatten(signal && signal.prompt);
        if (!line) continue;
        term.write(line + "\r");
      } catch {
        if (stopped) break;
        await sleep(1000);
      }
    }
  };
  claimLoop().catch(() => {});

  return new Promise((resolve) => {
    term.onExit(({ exitCode }) => {
      stopped = true;
      restoreStdin();
      if (started) started.close();
      resolve(typeof exitCode === "number" ? exitCode : 0);
    });
  });
}
