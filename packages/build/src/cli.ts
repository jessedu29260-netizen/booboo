#!/usr/bin/env node
import { buildFromConfig } from "./index.js";

const args = process.argv.slice(2);
const cmd = args[0];
const ci = args.indexOf("--config");
const cfgPath = ci >= 0 ? args[ci + 1] : "booboo.config.yaml";

if (cmd === "build") {
  buildFromConfig(cfgPath)
    .then(({ graph, snapshotPath }) => {
      const by: Record<string, number> = {};
      for (const n of graph.nodes) by[n.layer] = (by[n.layer] ?? 0) + 1;
      console.log(`🐾 built ${graph.nodes.length.toLocaleString()} nodes · ${graph.links.length.toLocaleString()} links · ${graph.meta.layers.length} layers`);
      console.log("   " + Object.entries(by).map(([l, c]) => `${l}:${c}`).join(" · "));
      if (snapshotPath) console.log("   → " + snapshotPath);
    })
    .catch((e) => {
      console.error("build failed:", e?.message ?? e);
      process.exit(1);
    });
} else {
  console.log("usage: booboo build [--config booboo.config.yaml]");
}
