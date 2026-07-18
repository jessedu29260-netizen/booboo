/* The GOVERN face's backend — the panel app at /chart/ calls same-origin
   /api/org, /api/nodes, /api/boot/:id … exactly as it does against the
   `booboo panel` CLI server (packages/cli/src/panel.ts). Rewrites in the
   deploy's vercel.json funnel those paths here as ?r=<route>. Read-only:
   apply (PUT /api/org) answers a friendly 405 — never 401 (the claude.ai
   authless lesson applies to every function on this origin). */

import { readFileSync } from "node:fs";
import { BoobooIndex, orgBootSlice } from "./_index.mjs";

const snapshot = JSON.parse(readFileSync(new URL("./_data/pemberton.booboo.json", import.meta.url), "utf8"));
const org = JSON.parse(readFileSync(new URL("./_data/org.pemberton.booboo.json", import.meta.url), "utf8"));
const ix = new BoobooIndex(snapshot);

const J = (code, body) =>
  new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json; charset=utf-8" } });
const num = (p, k, d) => {
  const v = parseInt(p.get(k) ?? "", 10);
  return Number.isFinite(v) ? v : d;
};
const s = (p, k) => p.get(k) ?? undefined;

export function GET(request) {
  const p = new URL(request.url).searchParams;
  const r = p.get("r");
  try {
    if (r === "org") return J(200, org);
    if (r === "boot") {
      const slice = orgBootSlice(org, p.get("id") ?? "");
      return slice ? J(200, slice) : J(404, { error: `no agent '${p.get("id")}'` });
    }
    if (r === "graph") return J(200, ix.meta());
    if (r === "stats") return J(200, ix.counts());
    if (r === "clusters") return J(200, { clusters: ix.clusters(s(p, "type")) });
    if (r === "search") return J(200, { nodes: ix.search(p.get("q") ?? "", num(p, "limit", 20)) });
    if (r === "node") {
      const n = ix.node(p.get("id") ?? "");
      return n ? J(200, n) : J(404, { error: `no node '${p.get("id")}'` });
    }
    if (r === "nodes")
      return J(200, ix.list({ layer: s(p, "layer"), cluster: s(p, "cluster"), type: s(p, "type"), q: s(p, "q"), limit: num(p, "limit", 100), offset: num(p, "offset", 0) }));
    if (r === "neighbors") return J(200, ix.neighbors(p.get("id") ?? "", num(p, "depth", 1), num(p, "limit", 200)));
    return J(404, { error: "unknown route" });
  } catch (e) {
    return J(500, { error: String(e?.message ?? e) });
  }
}

// APPLY is a trust boundary the demo deliberately doesn't cross: the org file
// on a static deploy is immutable, and a stranger shouldn't reorganise the
// house anyway. Friendly refusal, never a 401.
const READONLY = () => J(405, { ok: false, errors: ["read-only demo — run `booboo panel` locally to reorganise the house"] });
export const PUT = READONLY;
export const POST = READONLY;
export const DELETE = READONLY;
