/* web/api/_index.mjs is a hand-vendored copy of packages/serve/src/graph.ts.
 * The vendoring is deliberate (the demo's serverless functions must not drag in
 * express + fs/journal, and must not wait on an npm publish) and the file says
 * so — but "re-copy it when graph.ts changes" was a rule with nothing enforcing
 * it, and it silently rotted:
 *
 *   GAPS C2  marked "panel counters read 0" as fixed. The memory→observation
 *            translation went into web/api/panelapi.mjs and nowhere else.
 *   GAPS C33 `booboo panel` — the command an OSS user runs — therefore reported
 *            0 memories over a snapshot holding 2,100, for weeks, while every
 *            check against the deploy looked correct.
 *
 * Two surfaces answering one question differently is the same defect shape as
 * the duplicated relTime (C29). This asserts they agree on the queries that
 * have actually diverged, so the next drift fails CI instead of a demo.
 */
import { BoobooIndex as Vendored } from "../web/api/_index.mjs";
import { BoobooIndex as Packaged } from "../packages/serve/dist/index.js";

// Both stored conventions, in one graph: `memory` is what JournalWriter writes,
// `observation` is what the generators write. A client asks for `memory`.
const graph = {
  booboo: "1.0",
  meta: { root: "core", layers: [{ name: "a" }] },
  nodes: [
    { id: "core", type: "root", layer: "a", label: "Core", weight: 1 },
    { id: "j", type: "memory", layer: "a", label: "journal note", weight: 0.2, cluster: "house" },
    { id: "o", type: "observation", layer: "a", label: "ledger entry", weight: 0.2, cluster: "house" },
    { id: "r", type: "report", layer: "a", label: "a close", weight: 0.2, cluster: "house" },
  ],
  links: [],
};

const probes = [
  ["list type=memory", (ix) => ix.list({ type: "memory" }).total],
  ["list type=observation", (ix) => ix.list({ type: "observation" }).total],
  ["list type=report", (ix) => ix.list({ type: "report" }).total],
  ["list no type", (ix) => ix.list({}).total],
  ["clusters memory", (ix) => JSON.stringify(ix.clusters("memory"))],
  ["clusters all", (ix) => JSON.stringify(ix.clusters())],
  ["count type=memory", (ix) => ix.count({ type: "memory" }).total],
  ["counts", (ix) => JSON.stringify(ix.counts())],
];

const v = new Vendored(graph);
const p = new Packaged(graph);
const drift = [];
for (const [name, probe] of probes) {
  const a = String(probe(v));
  const b = String(probe(p));
  if (a !== b) drift.push(`  ${name}: vendored=${a} packaged=${b}`);
}

// The invariant that actually matters, asserted absolutely rather than only
// relatively — if BOTH copies regress together the comparison above still
// passes, and the bug is back.
const expected = 2; // the journal-written memory AND the generated observation
if (p.list({ type: "memory" }).total !== expected)
  drift.push(`  packaged list type=memory: expected ${expected}, got ${p.list({ type: "memory" }).total}`);
if (v.list({ type: "memory" }).total !== expected)
  drift.push(`  vendored list type=memory: expected ${expected}, got ${v.list({ type: "memory" }).total}`);

if (drift.length) {
  console.error("web/api/_index.mjs has drifted from packages/serve/src/graph.ts:\n" + drift.join("\n"));
  console.error("\nRe-sync the vendored copy (see its header) and re-run.");
  process.exit(1);
}
console.log(`✓ vendored index agrees with @booboo-brain/serve on ${probes.length} probes`);
