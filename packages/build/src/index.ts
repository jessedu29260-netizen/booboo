import { writeFileSync } from "node:fs";
import path from "node:path";
import type { BoobooGraph } from "@booboo/spec";
import { loadConfig, type BoobooConfig } from "./config.js";
import { build } from "./build.js";

export { loadConfig, type BoobooConfig, type NodeSpec, type LinkSpec, type Source } from "./config.js";
export { build } from "./build.js";

/** Load a config, build the graph, and write the snapshot file (if configured). */
export async function buildFromConfig(configPath: string): Promise<{ graph: BoobooGraph; snapshotPath?: string }> {
  const cfg: BoobooConfig = loadConfig(configPath);
  const baseDir = path.dirname(path.resolve(configPath));
  const graph = await build(cfg, baseDir);
  let snapshotPath: string | undefined;
  if (cfg.output?.snapshot) {
    snapshotPath = path.isAbsolute(cfg.output.snapshot) ? cfg.output.snapshot : path.join(baseDir, cfg.output.snapshot);
    writeFileSync(snapshotPath, JSON.stringify(graph));
  }
  return { graph, snapshotPath };
}
