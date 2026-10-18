import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "..", "..", "agent-ping", "lib", "client.js");
const target = path.resolve(here, "..", "renderer", "agent-ping-client.js");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[agent-ping] synced ${source} -> ${target}`);
