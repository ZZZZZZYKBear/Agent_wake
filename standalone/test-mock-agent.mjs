process.stdout.write("MOCK READY\n");
process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    process.stdout.write("MOCK GOT: " + text + "\n");
    if (text === "quit") process.exit(0);
  }
});
