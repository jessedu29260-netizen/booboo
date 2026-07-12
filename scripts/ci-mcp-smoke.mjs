#!/usr/bin/env node
// CI smoke check for `booboo mcp`: boot the server, send a real MCP `initialize`
// handshake over stdio, and assert a well-formed JSON-RPC response comes back.
// Run standalone too: node scripts/ci-mcp-smoke.mjs <snapshot.json>
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const snapshot = process.argv[2];
if (!snapshot) {
  console.error("usage: node scripts/ci-mcp-smoke.mjs <snapshot.json>");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "packages/cli/dist/cli.js");
const child = spawn("node", [cli, "mcp", "--snapshot", snapshot]);

const TIMEOUT_MS = 15_000;
let settled = false;
const finish = (ok, msg) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  child.kill();
  if (ok) console.log("mcp smoke ok:", msg);
  else console.error("mcp smoke FAILED:", msg);
  process.exit(ok ? 0 : 1);
};

const timer = setTimeout(() => finish(false, `no response to initialize within ${TIMEOUT_MS}ms`), TIMEOUT_MS);

let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // not every line on stdout need be JSON-RPC; ignore and keep waiting
    }
    if (msg.id === 1) {
      if (msg.result?.serverInfo) finish(true, JSON.stringify(msg.result.serverInfo));
      else finish(false, `initialize response missing result.serverInfo: ${line}`);
      return;
    }
  }
});

child.stderr.on("data", (chunk) => process.stderr.write(chunk)); // human logs go to stderr — surface them on failure
child.on("exit", (code) => { if (!settled) finish(false, `process exited (code ${code}) before responding to initialize`); });
child.on("error", (e) => finish(false, `failed to spawn: ${e.message}`));

child.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "ci-smoke", version: "0.0.0" } },
  }) + "\n",
);
