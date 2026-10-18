import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const SERVICE = "dsh-agent-ping";
const VERSION = "0.2.0";
const DEFAULT_PORT = 47654;
const PORT_ATTEMPTS = 12;
const MAX_BODY = 2 * 1024 * 1024;
const MAX_QUEUE = 24;
const HEARTBEAT_MS = 15000;

function bridgeHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
}

function configPath() {
  return path.join(bridgeHome(), "agent-ping-bridge.json");
}

function detectWebPort() {
  const args = process.argv;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--port" && args[index + 1]) {
      const port = Number(args[index + 1]);
      if (port) return port;
    }
    if (args[index].startsWith("--port=")) {
      const port = Number(args[index].slice("--port=".length));
      if (port) return port;
    }
  }
  const advertised = process.env.DSH_WEB_URL;
  if (advertised) {
    try {
      const parsed = new URL(advertised);
      if (parsed.port) return Number(parsed.port) || 0;
      return parsed.protocol === "https:" ? 443 : 80;
    } catch {}
  }
  return 0;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-agent-ping-token",
    "access-control-max-age": "600"
  };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders()
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function writeConfig(port, token, webPort) {
  const file = configPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          service: SERVICE,
          version: VERSION,
          port,
          webPort,
          token,
          pid: process.pid,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error("[agent-ping] cannot write bridge config", error);
  }
  return file;
}

function removeConfig(port, token) {
  try {
    const file = configPath();
    if (!fs.existsSync(file)) return;
    const current = JSON.parse(fs.readFileSync(file, "utf8"));
    if (current.port === port && current.token === token) fs.unlinkSync(file);
  } catch {}
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Start the loopback bridge used by the global desktop overlay.
 *
 * The server binds to 127.0.0.1 only. `/events` is a read-only SSE feed for the
 * DSH client half; `/signal` requires the per-process bearer token written to
 * `$DSH_HOME/agent-ping-bridge.json`. The overlay app reads that file, so the
 * token never has to be typed by the user.
 */
export function startBridge() {
  const token = crypto.randomBytes(24).toString("hex");
  const webPort = detectWebPort();
  const clients = new Set();
  const queue = [];
  let dshFocused = false;
  let dshFocusAt = 0;
  let port = 0;
  let server = null;
  let heartbeat = null;
  let stopped = false;

  const broadcast = (event) => {
    const frame = "data: " + JSON.stringify(event) + "\n\n";
    for (const client of clients) {
      try {
        client.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  };

  const enqueue = (event) => {
    if (clients.size > 0) {
      broadcast(event);
      return clients.size;
    }
    queue.push(event);
    while (queue.length > MAX_QUEUE) queue.shift();
    return 0;
  };

  const handler = async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, {
        ok: true,
        service: SERVICE,
        version: VERSION,
        port,
        webPort,
        clients: clients.size,
        queued: queue.length,
        dshFocused: dshFocused && Date.now() - dshFocusAt < 12000
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/focus") {
      const origin = req.headers.origin || "";
      let originPort = 0;
      try {
        originPort = Number(new URL(origin).port);
      } catch {}
      if (webPort && origin && originPort && originPort !== Number(webPort)) {
        json(res, 403, { ok: false, error: "wrong DSH page" });
        return;
      }
      let body;
      try {
        body = await readJson(req);
      } catch (error) {
        json(res, 400, { ok: false, error: error.message });
        return;
      }
      dshFocused = Boolean(body && body.focused);
      dshFocusAt = Date.now();
      json(res, 200, { ok: true, dshFocused });
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
        ...corsHeaders()
      });
      res.write(": connected\n\n");
      clients.add(res);
      while (queue.length > 0) {
        const event = queue.shift();
        try {
          res.write("data: " + JSON.stringify(event) + "\n\n");
        } catch {
          break;
        }
      }
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/signal") {
      const supplied = req.headers["x-agent-ping-token"] || url.searchParams.get("token");
      if (supplied !== token) {
        json(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
      let body;
      try {
        body = await readJson(req);
      } catch (error) {
        json(res, 400, { ok: false, error: error.message });
        return;
      }
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        json(res, 400, { ok: false, error: "prompt is required" });
        return;
      }
      const event = {
        type: "signal",
        id: typeof body.id === "string" ? body.id : "global-" + Date.now().toString(36),
        label: typeof body.label === "string" ? body.label.slice(0, 80) : "全局信号",
        emoji: typeof body.emoji === "string" ? body.emoji.slice(0, 8) : "🖥️",
        color: typeof body.color === "string" ? body.color.slice(0, 32) : "#62b6ff",
        icon: typeof body.icon === "string" ? body.icon.slice(0, 32) : "flag",
        source: "global",
        prompt: prompt.slice(0, 20000),
        target: body.target && typeof body.target === "object" ? body.target : null,
        receivedAt: new Date().toISOString()
      };
      const delivered = enqueue(event);
      json(res, 200, { ok: true, delivered, queued: queue.length });
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        ...corsHeaders()
      });
      res.end(
        "<!doctype html><meta charset=\"utf-8\"><title>Agent Ping Bridge</title>" +
          "<style>body{background:#081018;color:#d8e0e8;font:14px system-ui;padding:32px}" +
          "code{color:#c8aa6e}pre{background:#111a24;padding:12px;border-radius:6px}</style>" +
          "<h1>Agent Ping Bridge</h1><p>DSH 本地桥接正在运行。</p>" +
          "<p>端口：<code>" + port + "</code> · DSH 客户端：<code>" + clients.size + "</code> · 排队：<code>" + queue.length + "</code></p>" +
          "<pre>GET  /health\nGET  /events\nPOST /signal  (X-Agent-Ping-Token)\nPOST /focus   (DSH page focus state)</pre>"
      );
      return;
    }

    json(res, 404, { ok: false, error: "not found" });
  };

  const start = async () => {
    for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
      const candidate = DEFAULT_PORT + attempt;
      const candidateServer = http.createServer(handler);
      try {
        await listen(candidateServer, candidate);
        server = candidateServer;
        port = candidate;
        break;
      } catch (error) {
        candidateServer.close();
        if (error && error.code !== "EADDRINUSE") {
          console.error("[agent-ping] bridge listen failed", error);
          return;
        }
      }
    }
    if (!server) {
      console.error("[agent-ping] bridge could not find a free port");
      return;
    }
    const file = writeConfig(port, token, webPort);
    heartbeat = setInterval(() => {
      for (const client of clients) {
        try {
          client.write(": ping\n\n");
        } catch {
          clients.delete(client);
        }
      }
    }, HEARTBEAT_MS);
    console.log("[agent-ping] bridge listening on http://127.0.0.1:" + port + " (config: " + file + ")");
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    for (const client of clients) {
      try {
        client.end();
      } catch {}
    }
    clients.clear();
    if (server) {
      try {
        server.close();
      } catch {}
      server = null;
    }
    if (port) removeConfig(port, token);
  };

  start().catch((error) => console.error("[agent-ping] bridge startup failed", error));
  return stop;
}

export const bridgeConstants = { SERVICE, VERSION, DEFAULT_PORT, PORT_ATTEMPTS };
