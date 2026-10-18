#!/usr/bin/env node
/**
 * agent-ping — standalone CLI.
 *
 *   agent-ping hub [--port 47660]      run the loopback signal hub
 *   agent-ping send <text...>          post a signal (label/emoji/source flags)
 *   agent-ping next [--timeout 30]     claim the next signal for this agent
 *   agent-ping status                  hub health
 */
import { startHub, readHubConfig, configFile, VERSION } from "./hub.js";

const USAGE = `agent-ping ${VERSION}

Usage:
  agent-ping hub [--port <port>]           run the loopback signal hub
  agent-ping send <text...> [--label L] [--emoji E] [--source S] [--json]
                                           post a signal to the hub
  agent-ping next [--timeout 30] [--json]  claim the next signal (exit 2 on timeout)
  agent-ping status [--json]               show hub health
  agent-ping version

Signals are JSON objects with at least { prompt, label, emoji, source }.
Agents can either long-poll "next" or register a webhook with the hub.
`;

function parse(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        options[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) {
        options[body] = argv[index + 1];
        index += 1;
      } else {
        options[body] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

function hubUrl(config) {
  return "http://" + (config.host || "127.0.0.1") + ":" + config.port;
}

async function requireHub() {
  const config = readHubConfig();
  if (!config || !config.port || !config.token) {
    console.error("agent-ping: hub is not running. Start it with `agent-ping hub` first.");
    console.error("config: " + configFile());
    process.exit(1);
  }
  return config;
}

async function commandHub(options) {
  const port = Number(options.port) || undefined;
  const hub = await startHub({
    ...(port ? { port } : {}),
    log: (message) => console.log(message)
  });
  console.log("agent-ping hub: " + hub.url);
  console.log("token file: " + configFile());
  const stop = () => {
    hub.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // Keep the process alive.
  await new Promise(() => {});
}

async function commandSend(positional, options) {
  const prompt = positional.join(" ").trim();
  if (!prompt) {
    console.error("agent-ping: nothing to send. Usage: agent-ping send <text...>");
    process.exit(1);
  }
  const config = await requireHub();
  const body = {
    prompt,
    label: typeof options.label === "string" ? options.label : "CLI",
    emoji: typeof options.emoji === "string" ? options.emoji : "🔔",
    source: typeof options.source === "string" ? options.source : "cli"
  };
  const response = await fetch(hubUrl(config) + "/signal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-ping-token": config.token
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) {
    console.error("agent-ping: " + (result.error || response.status));
    process.exit(1);
  }
  if (options.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log("sent: " + result.delivered + (result.queued ? " (" + result.queued + " queued)" : ""));
  }
}

async function commandNext(options) {
  const config = await requireHub();
  const timeout = Math.max(0.5, Number(options.timeout) || 25);
  const response = await fetch(hubUrl(config) + "/next?timeout=" + timeout, {
    headers: { "x-agent-ping-token": config.token }
  });
  if (response.status === 204) {
    if (options.json) console.log(JSON.stringify({ ok: true, signal: null }));
    else console.error("agent-ping: no signal within " + timeout + "s");
    process.exit(2);
  }
  const signal = await response.json();
  if (!response.ok) {
    console.error("agent-ping: " + (signal.error || response.status));
    process.exit(1);
  }
  if (options.json) console.log(JSON.stringify(signal));
  else console.log(signal.prompt);
}

async function commandStatus(options) {
  const config = await requireHub();
  const response = await fetch(hubUrl(config) + "/health");
  const health = await response.json();
  if (options.json) console.log(JSON.stringify(health));
  else {
    console.log("service: " + health.service + " " + health.version);
    console.log("url:     " + hubUrl(config));
    console.log("clients: " + health.clients + " · waiters: " + health.waiters + " · queued: " + health.queued + " · webhooks: " + health.webhooks);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { options, positional } = parse(rest);
  switch (command) {
    case "hub":
      await commandHub(options);
      break;
    case "send":
      await commandSend(positional, options);
      break;
    case "next":
      await commandNext(options);
      break;
    case "status":
      await commandStatus(options);
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error("agent-ping: unknown command '" + command + "'\n");
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("agent-ping: " + (error && error.message ? error.message : String(error)));
  process.exit(1);
});
