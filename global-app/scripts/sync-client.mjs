import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "..", "..", "agent-ping", "lib", "client.js");
const target = path.resolve(here, "..", "renderer", "agent-ping-client.js");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[agent-ping] synced ${source} -> ${target}`);

// The tray app embeds the hub. It is ESM, so it carries an .mjs extension in a
// CommonJS package.
const hubSource = path.resolve(here, "..", "..", "standalone", "hub.js");
const hubTarget = path.resolve(here, "..", "hub.mjs");
fs.copyFileSync(hubSource, hubTarget);
console.log(`[agent-ping] synced ${hubSource} -> ${hubTarget}`);
