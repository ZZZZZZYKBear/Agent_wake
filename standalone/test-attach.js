import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "agent-ping-attach-"));
const env = { ...process.env, AGENT_PING_HOME: home };
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "cli.js");
const fixture = path.join(here, "test-mock-agent.mjs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const child = spawn(process.execPath, [cli, "attach", "node", fixture], {
  env,
  stdio: ["pipe", "pipe", "pipe"]
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log("ok " + name);
  } else {
    failures += 1;
    console.error("FAIL " + name + "\n--- output ---\n" + output);
  }
}

async function main() {
  for (let attempt = 0; attempt < 60 && !output.includes("MOCK READY"); attempt += 1) await sleep(100);
  check("agent starts in a pty", output.includes("MOCK READY"));

  const send = spawn(process.execPath, [cli, "send", "attach hello"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let sendOut = "";
  send.stdout.on("data", (chunk) => { sendOut += chunk.toString(); });
  send.stderr.on("data", (chunk) => { sendOut += chunk.toString(); });
  await new Promise((resolve) => send.on("exit", resolve));
  check("signal queued", /sent:/.test(sendOut));

  for (let attempt = 0; attempt < 60 && !output.includes("MOCK GOT: attach hello"); attempt += 1) await sleep(100);
  check("prompt typed into the agent", output.includes("MOCK GOT: attach hello"));

  child.stdin.write("typed by hand\r");
  for (let attempt = 0; attempt < 30 && !output.includes("MOCK GOT: typed by hand"); attempt += 1) await sleep(100);
  check("keystrokes forwarded", output.includes("MOCK GOT: typed by hand"));

  child.stdin.write("quit\r");
  const code = await new Promise((resolve) => child.on("exit", resolve));
  check("agent exit code propagated", code === 0);

  fs.rmSync(home, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  try { child.kill(); } catch {}
  process.exit(1);
});
