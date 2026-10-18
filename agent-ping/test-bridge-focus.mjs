import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startBridge } from "./lib/bridge.js";

const home = path.join(os.tmpdir(), "agent-ping-focus-test-" + Date.now().toString(36));
process.env.DSH_HOME = home;
const stop = startBridge();
const configFile = path.join(home, "agent-ping-bridge.json");
let config = null;
for (let i = 0; i < 50; i += 1) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
if (!config) throw new Error("bridge config not written");
const base = `http://127.0.0.1:${config.port}`;
const before = await (await fetch(base + "/health")).json();
const post = await fetch(base + "/focus", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://127.0.0.1:49503" },
  body: JSON.stringify({ focused: true })
});
const after = await (await fetch(base + "/health")).json();
console.log(JSON.stringify({ port: config.port, before: before.dshFocused, postStatus: post.status, post: await post.json(), after: after.dshFocused }, null, 2));
stop();
fs.rmSync(home, { recursive: true, force: true });
