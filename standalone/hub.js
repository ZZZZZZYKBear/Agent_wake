/**
 * agent-ping hub — a tiny loopback signal bus for any agent.
 *
 * The wheel (or any script) posts a signal here; agents either long-poll
 * `GET /next` (competing consumers) or register a webhook. `GET /events` is a
 * read-only SSE feed for monitors and the overlay UI.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const SERVICE = "agent-ping-hub";
export const VERSION = "0.1.0";
export const DEFAULT_PORT = 47660;
export const PORT_ATTEMPTS = 11;
const MAX_QUEUE = 50;
const MAX_BODY = 2 * 1024 * 1024;
const DEFAULT_WAIT_SECONDS = 25;
const MAX_WAIT_SECONDS = 120;

export function hubHome() {
  return process.env.AGENT_PING_HOME || path.join(os.homedir(), ".agent-ping");
}

export function configFile() {
  return path.join(hubHome(), "hub.json");
}

export function readHubConfig() {
  try {
    const text = fs.readFileSync(configFile(), "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-agent-ping-token,authorization",
    "access-control-max-age": "600"
  };
}

function sendJson(res, status, body) {
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
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeSignal(body) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return null;
  return {
    type: "signal",
    id: typeof body.id === "string" ? body.id : "ping-" + Date.now().toString(36),
    label: typeof body.label === "string" ? body.label.slice(0, 80) : "信号",
    emoji: typeof body.emoji === "string" ? body.emoji.slice(0, 8) : "🔔",
    color: typeof body.color === "string" ? body.color.slice(0, 32) : "#c8aa6e",
    icon: typeof body.icon === "string" ? body.icon.slice(0, 32) : "flag",
    source: typeof body.source === "string" ? body.source.slice(0, 32) : "cli",
    prompt: prompt.slice(0, 20000),
    target: body.target && typeof body.target === "object" ? body.target : null,
    createdAt: new Date().toISOString()
  };
}

function listenOnce(server, port, host) {
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
    server.listen(port, host);
  });
}

/**
 * Start the hub. `port: 0` lets the OS choose and the real port is returned.
 * Returns { port, token, url, close }.
 */
export async function startHub({ port = DEFAULT_PORT, host = "127.0.0.1", log = () => {} } = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  const queue = [];
  const waiters = new Set();
  const sseClients = new Set();
  const webhooks = new Set();
  let actualPort = port;
  let server = null;

  const authOk = (req, url) => {
    const header = req.headers["x-agent-ping-token"];
    const bearer = typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    const supplied = header || bearer || url.searchParams.get("token") || "";
    return supplied === token;
  };

  const broadcast = (event) => {
    const frame = "data: " + JSON.stringify(event) + "\n\n";
    for (const res of sseClients) {
      try {
        res.write(frame);
      } catch {
        sseClients.delete(res);
      }
    }
  };

  const deliverWebhook = async (url, event) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) log("hub: webhook", url, "returned", response.status);
    } catch (error) {
      log("hub: webhook failed", url, error && error.message);
    }
  };

  const deliver = (event) => {
    broadcast(event);
    for (const waiter of waiters) {
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(event);
      return "claimed";
    }
    if (webhooks.size > 0) {
      for (const url of webhooks) void deliverWebhook(url, event);
      return "webhook";
    }
    queue.push(event);
    while (queue.length > MAX_QUEUE) queue.shift();
    return "queued";
  };

  const handler = async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE,
        version: VERSION,
        port: actualPort,
        clients: sseClients.size,
        waiters: waiters.size,
        queued: queue.length,
        webhooks: webhooks.size
      });
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
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    if (req.method === "GET" && url.pathname === "/next") {
      if (!authOk(req, url)) {
        sendJson(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
      if (queue.length > 0) {
        sendJson(res, 200, queue.shift());
        return;
      }
      const seconds = Math.min(
        MAX_WAIT_SECONDS,
        Math.max(0.5, Number(url.searchParams.get("timeout")) || DEFAULT_WAIT_SECONDS)
      );
      const event = await new Promise((resolve) => {
        const waiter = { resolve, timer: null };
        waiter.timer = setTimeout(() => {
          waiters.delete(waiter);
          resolve(null);
        }, seconds * 1000);
        waiters.add(waiter);
        req.on("close", () => {
          waiters.delete(waiter);
          clearTimeout(waiter.timer);
        });
      });
      if (!event) {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
      }
      sendJson(res, 200, event);
      return;
    }

    if (req.method === "POST" && url.pathname === "/signal") {
      if (!authOk(req, url)) {
        sendJson(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
      let body;
      try {
        body = await readJson(req);
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }
      const signal = normalizeSignal(body);
      if (!signal) {
        sendJson(res, 400, { ok: false, error: "prompt is required" });
        return;
      }
      const delivered = deliver(signal);
      sendJson(res, 200, {
        ok: true,
        delivered,
        queued: queue.length,
        waiters: waiters.size
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/subscribe") {
      if (!authOk(req, url)) {
        sendJson(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
      let body;
      try {
        body = await readJson(req);
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }
      let target = null;
      try {
        target = new URL(String(body.url || ""));
      } catch {
        sendJson(res, 400, { ok: false, error: "url must be an absolute http(s) URL" });
        return;
      }
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        sendJson(res, 400, { ok: false, error: "url must be an absolute http(s) URL" });
        return;
      }
      webhooks.add(target.href);
      sendJson(res, 200, { ok: true, webhooks: [...webhooks] });
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...corsHeaders() });
      res.end(
        "<!doctype html><meta charset=\"utf-8\"><title>Agent Ping Hub</title>" +
          "<style>body{background:#081018;color:#d8e0e8;font:14px system-ui;padding:32px}" +
          "code{color:#c8aa6e}pre{background:#111a24;padding:12px;border-radius:6px}</style>" +
          "<h1>Agent Ping Hub</h1><p>任意 agent 都可以从这里取信号。</p>" +
          "<p>端口：<code>" + actualPort + "</code> · SSE：<code>" + sseClients.size +
          "</code> · 等待：<code>" + waiters.size + "</code> · 排队：<code>" + queue.length + "</code></p>" +
          "<pre>GET  /health\nGET  /events          (SSE, 只读)\n" +
          "GET  /next?timeout=25 (Bearer / X-Agent-Ping-Token)\n" +
          "POST /signal          (Bearer / X-Agent-Ping-Token)\n" +
          "POST /subscribe {url} (Bearer / X-Agent-Ping-Token)</pre>"
      );
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  };

  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
    const candidate = port + attempt;
    const candidateServer = http.createServer(handler);
    try {
      await listenOnce(candidateServer, candidate, host);
      server = candidateServer;
      actualPort = candidateServer.address().port;
      break;
    } catch (error) {
      candidateServer.close();
      if (!error || error.code !== "EADDRINUSE") throw error;
    }
  }
  if (!server) throw new Error("no free port for the hub");

  const config = {
    service: SERVICE,
    version: VERSION,
    port: actualPort,
    host,
    token,
    pid: process.pid,
    updatedAt: new Date().toISOString()
  };
  try {
    fs.mkdirSync(hubHome(), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    log("hub: cannot write config", error && error.message);
  }

  const close = () => {
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    waiters.clear();
    for (const res of sseClients) {
      try { res.end(); } catch {}
    }
    sseClients.clear();
    try {
      if (server) server.close();
    } catch {}
    try {
      const current = readHubConfig();
      if (current && current.token === token) fs.unlinkSync(configFile());
    } catch {}
  };

  log("hub: listening on http://" + host + ":" + actualPort + " (config: " + configFile() + ")");
  return { port: actualPort, host, token, url: "http://" + host + ":" + actualPort, close };
}
