import { readFileSync } from "node:fs";
import type { BoobooGraph } from "@booboo-brain/spec";

export { BoobooIndex, type ListOpts, type Neighborhood } from "./graph.js";
export { createRestServer } from "./rest.js";
export { runMcp } from "./mcp.js";

/** Read a Booboo snapshot JSON from disk. */
export function loadSnapshot(path: string): BoobooGraph {
  return JSON.parse(readFileSync(path, "utf8")) as BoobooGraph;
}
