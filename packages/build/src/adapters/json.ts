import { readFileSync } from "node:fs";
import path from "node:path";
import type { BNode, BLink, BLayer } from "@booboo-brain/spec";

/** Passthrough adapter: merge a Booboo graph JSON file as-is (the universal escape hatch). */
export function jsonAdapter(src: { path: string }, baseDir: string): { nodes: BNode[]; links: BLink[]; layers?: BLayer[] } {
  const p = path.isAbsolute(src.path) ? src.path : path.join(baseDir, src.path);
  const g = JSON.parse(readFileSync(p, "utf8"));
  return { nodes: g.nodes ?? [], links: g.links ?? [], layers: g.meta?.layers };
}
