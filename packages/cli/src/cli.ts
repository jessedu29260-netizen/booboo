#!/usr/bin/env node
// Booboo — one CLI, lazy-loaded subcommands.  booboo <build|serve|mcp|view> [options]
// Each subcommand dynamically imports only the package it needs, so `booboo build`
// never loads the server (and, once it lands, `view` never loads it for a build).

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);

const flag = (name: string, fallback?: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};

const intFlag = (name: string, fallback: number): number => {
  const v = flag(name);
  const n = v != null ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback; // reject NaN from a non-numeric --port/--nodes
};

async function build(): Promise<void> {
  const { buildFromConfig } = await import("@booboo-brain/build");
  const { graph, snapshotPath } = await buildFromConfig(flag("--config", "booboo.config.yaml")!);
  const by: Record<string, number> = {};
  for (const n of graph.nodes) by[n.layer] = (by[n.layer] ?? 0) + 1;
  console.log(`🐾 built ${graph.nodes.length.toLocaleString()} nodes · ${graph.links.length.toLocaleString()} links · ${graph.meta.layers.length} layers`);
  console.log("   " + Object.entries(by).map(([l, c]) => `${l}:${c}`).join(" · "));
  if (snapshotPath) console.log("   → " + snapshotPath);
}

async function serve(kind: "rest" | "mcp"): Promise<void> {
  const snap = flag("--snapshot");
  if (!snap) {
    const verb = kind === "rest" ? "serve" : "mcp";
    console.error(`usage: booboo ${verb} --snapshot graph.json${kind === "rest" ? " [--port 8787]" : ""}`);
    process.exit(1);
  }
  const { loadSnapshot, loadOrg, BoobooIndex, createRestServer, runMcp } = await import("@booboo-brain/serve");
  const ix = new BoobooIndex(loadSnapshot(snap!));
  if (kind === "rest") {
    const port = intFlag("--port", 8787);
    createRestServer(ix).listen(port, () =>
      console.error(`🐾 booboo REST · ${ix.counts().nodes.toLocaleString()} nodes · http://localhost:${port}`),
    );
  } else {
    // MCP speaks JSON-RPC on stdout — every human log MUST go to stderr.
    // With --org, agents boot from the organigram (booboo_boot / booboo_org).
    const orgPath = flag("--org");
    await runMcp(ix, "booboo", orgPath ? loadOrg(orgPath) : undefined);
  }
}

function usage(): void {
  console.log(`booboo — the unified operational brain

usage: booboo <command> [options]

  build  --config booboo.config.yaml          build the graph snapshot
  serve  --snapshot graph.json [--port 8787]  REST API
  mcp    --snapshot graph.json [--org org.booboo.json]  MCP server (stdio; --org adds booboo_boot)
  view   --snapshot graph.json [--port 8989]  3D viewer in your browser
         --demo [--nodes 100000]              a synthetic brain, no data needed
  panel  --org org.booboo.json [--snapshot graph.json] [--port 8990]
                                              the organigram — drag-drop your agent
                                              hierarchy; apply rewrites the org file`);
}

async function main(): Promise<void> {
  switch (cmd) {
    case "build":
      return build();
    case "serve":
      return serve("rest");
    case "mcp":
      return serve("mcp");
    case "view": {
      const { view } = await import("./view.js");
      const nodesArg = flag("--nodes");
      const parsedNodes = nodesArg ? parseInt(nodesArg, 10) : NaN;
      await view({
        snapshot: flag("--snapshot"),
        demo: rest.includes("--demo"),
        nodes: Number.isFinite(parsedNodes) ? parsedNodes : undefined,
        port: intFlag("--port", 8989),
        open: !rest.includes("--no-open"),
      });
      return;
    }
    case "panel": {
      const { panel } = await import("./panel.js");
      await panel({
        org: flag("--org"),
        snapshot: flag("--snapshot"),
        port: intFlag("--port", 8990),
        open: !rest.includes("--no-open"),
      });
      return;
    }
    case undefined:
    case "--help":
    case "-h":
      usage();
      return;
    case "--version":
    case "-v": {
      const v = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
      console.log(v);
      return;
    }
    default:
      console.error(`booboo: unknown command "${cmd}"\n`);
      usage();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("booboo:", (e as Error)?.message ?? e);
  process.exit(1);
});
