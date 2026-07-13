import { readFileSync } from "node:fs";
import type { BoobooGraph, BOrg } from "@booboo-brain/spec";
import { validate, validateOrg } from "@booboo-brain/spec";

export { BoobooIndex, type ListOpts, type Neighborhood } from "./graph.js";
export { createRestServer } from "./rest.js";
export { runMcp } from "./mcp.js";
export { journalPathFor, loadJournal, replayJournal, JournalWriter, type JournalEntry, type WriteInput } from "./journal.js";

/** Read + validate a Booboo snapshot JSON from disk. Throws a contextual error on a
 *  missing/corrupt/invalid snapshot (rather than NPE-ing deep inside the index). */
export function loadSnapshot(path: string): BoobooGraph {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`cannot read snapshot ${path}: ${(e as Error).message}`);
  }
  let g: unknown;
  try {
    g = JSON.parse(raw);
  } catch (e) {
    throw new Error(`snapshot ${path} is not valid JSON: ${(e as Error).message}`);
  }
  const v = validate(g);
  if (!v.ok) throw new Error(`invalid snapshot ${path}: ${v.errors.join("; ")}`);
  return g as BoobooGraph;
}

/** Read + validate an organigram JSON from disk. Throws on an invalid org —
 *  agents must never boot from a broken hierarchy. */
export function loadOrg(path: string): BOrg {
  const org = JSON.parse(readFileSync(path, "utf8")) as BOrg;
  const v = validateOrg(org);
  if (!v.ok) throw new Error(`invalid org file ${path}: ${v.errors.join("; ")}`);
  return org;
}
