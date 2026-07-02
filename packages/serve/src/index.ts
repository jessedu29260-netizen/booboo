import { readFileSync } from "node:fs";
import type { BoobooGraph, BOrg } from "@booboo-brain/spec";
import { validateOrg } from "@booboo-brain/spec";

export { BoobooIndex, type ListOpts, type Neighborhood } from "./graph.js";
export { createRestServer } from "./rest.js";
export { runMcp } from "./mcp.js";

/** Read a Booboo snapshot JSON from disk. */
export function loadSnapshot(path: string): BoobooGraph {
  return JSON.parse(readFileSync(path, "utf8")) as BoobooGraph;
}

/** Read + validate an organigram JSON from disk. Throws on an invalid org —
 *  agents must never boot from a broken hierarchy. */
export function loadOrg(path: string): BOrg {
  const org = JSON.parse(readFileSync(path, "utf8")) as BOrg;
  const v = validateOrg(org);
  if (!v.ok) throw new Error(`invalid org file ${path}: ${v.errors.join("; ")}`);
  return org;
}
