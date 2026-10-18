import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { startHub, configFile } from "./hub.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "agent-ping-test-"));
process.env.AGENT_PING_HOME = home;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readSseEvent(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.includes("data: ")) break;
  }
  reader.cancel().catch(() => {});
  return text;
}

async function main() {
  const hub = await startHub({ port: 0 });
  const base = "http://127.0.0.1:" + hub.port;
  const auth = { "x-agent-ping-token": hub.token };

  const health = await fetch(base + "/health").then((r) => r.json());
  assert.equal(health.service, "agent-ping-hub");
  assert.equal(health.queued, 0);
  console.log("ok health");

  const unauthorized = await fetch(base + "/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "nope" })
  });
  assert.equal(unauthorized.status, 401);
  console.log("ok auth");

  const queued = await fetch(base + "/signal", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ prompt: "hello agent", label: "test" })
  }).then((r) => r.json());
  assert.equal(queued.ok, true);
  assert.equal(queued.delivered, "queued");

  const claimed = await fetch(base + "/next?timeout=5", { headers: auth }).then((r) => r.json());
  assert.equal(claimed.prompt, "hello agent");
  assert.equal(claimed.label, "test");
  console.log("ok queue + next");

  const timeout = await fetch(base + "/next?timeout=0.6", { headers: auth });
  assert.equal(timeout.status, 204);
  console.log("ok long-poll timeout");

  const sse = await fetch(base + "/events");
  assert.equal(sse.status, 200);
  await sleep(80);
  const pending = readSseEvent(sse);
  await fetch(base + "/signal", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ prompt: "sse hello" })
  });
  const frame = await pending;
  assert.match(frame, /sse hello/);
  console.log("ok sse feed");

  let webhookBody = null;
  const receiver = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      webhookBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const receiverPort = receiver.address().port;

  const subscribed = await fetch(base + "/subscribe", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ url: "http://127.0.0.1:" + receiverPort + "/hook" })
  }).then((r) => r.json());
  assert.equal(subscribed.ok, true);

  await fetch(base + "/signal", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ prompt: "webhook hello" })
  });
  for (let attempt = 0; attempt < 30 && !webhookBody; attempt += 1) await sleep(50);
  assert.equal(webhookBody && webhookBody.prompt, "webhook hello");
  console.log("ok webhook");
  receiver.close();

  assert.ok(fs.existsSync(configFile()), "hub.json should exist while running");
  hub.close();
  await sleep(50);
  assert.ok(!fs.existsSync(configFile()), "hub.json should be removed on close");
  console.log("ok config lifecycle");

  fs.rmSync(home, { recursive: true, force: true });
  console.log("all hub tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
