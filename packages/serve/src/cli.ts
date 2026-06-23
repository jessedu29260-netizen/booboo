#!/usr/bin/env node
import { loadSnapshot } from "./index.js";
import { BoobooIndex } from "./graph.js";
import { createRestServer } from "./rest.js";
import { runMcp } from "./mcp.js";

const args = process.argv.slice(2);
const mode = args[0];
const arg = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const snap = arg("--snapshot");
const port = parseInt(arg("--port") ?? "8787", 10);

if ((mode !== "rest" && mode !== "mcp") || !snap) {
  console.error("usage: booboo-serve <rest|mcp> --snapshot graph.json [--port 8787]");
  process.exit(mode ? 1 : 0);
}

const ix = new BoobooIndex(loadSnapshot(snap));
if (mode === "rest") {
  createRestServer(ix).listen(port, () => console.error(`🐾 booboo REST · ${ix.counts().nodes.toLocaleString()} nodes · http://localhost:${port}`));
} else {
  // MCP speaks JSON-RPC on stdout — every human log MUST go to stderr.
  runMcp(ix).catch((e) => {
    console.error("mcp failed:", e);
    process.exit(1);
  });
}
