/* VENDORED — do not edit by hand without syncing the source.
 *
 * BoobooIndex is copied verbatim (TS types stripped) from
 *   packages/serve/src/graph.ts        (@booboo-brain/serve)
 * orgBootSlice is copied verbatim from
 *   packages/spec/src/index.ts         (@booboo-brain/spec)
 *
 * Why vendored: the hosted /api/mcp demo function deploys from web/dist with its
 * own tiny package.json. Depending on @booboo-brain/serve would drag in the REST
 * server (express) and fs/journal code the function never uses, and adds a
 * publish-lag risk between the repo and npm. These ~150 lines are pure
 * (no fs/network) and MUST answer identically to the local CLI — if graph.ts or
 * orgBootSlice change, re-copy them here.
 * Vendored 2026-07-18 from serve@0.4.0, re-synced 2026-07-20 from serve@0.4.1 / spec (ORG_SPEC_VERSION 1.0).
 * Only the methods the read-only MCP tools use are kept:
 * counts, node, search, neighbors, path (+ constructor). */

/* Vendored with graph.ts — the memory→observation WIDENING (GAPS C33). A ledger
   entry is written as `observation` by the generators and asked for as `memory`
   by every client; a node the JournalWriter wrote is literally `memory`. Both
   must answer to type=memory, and type=observation must still select only
   itself. This copy existing at all is why C2 was fixed in panelapi.mjs and
   nowhere else — keep it in step with packages/serve/src/graph.ts. */
const TYPE_ALSO = { memory: ["observation"] };
const typeMatches = (nodeType, want) =>
  !want || nodeType === want || (TYPE_ALSO[want]?.includes(nodeType) ?? false);

/** In-memory query index over a Booboo snapshot. Pure (no Node/fs/network deps). */
export class BoobooIndex {
  graph;
  byId = new Map();
  adj = new Map();

  constructor(graph) {
    this.graph = graph;
    const dupes = [];
    for (const n of graph.nodes) {
      if (this.byId.has(n.id)) dupes.push(n.id);
      this.byId.set(n.id, n);
    }
    if (dupes.length)
      throw new Error(`refusing to index a graph with duplicate node id(s): ${[...new Set(dupes)].slice(0, 10).join(", ")}${dupes.length > 10 ? ", …" : ""}`);
    for (const l of graph.links) {
      if (!this.byId.has(l.source) || !this.byId.has(l.target)) continue; // skip dangling
      this.edge(l.source).push({ link: l, other: l.target, dir: "out" });
      this.edge(l.target).push({ link: l, other: l.source, dir: "in" });
    }
  }
  edge(id) {
    let a = this.adj.get(id);
    if (!a) { a = []; this.adj.set(id, a); }
    return a;
  }

  counts() {
    const byLayer = {};
    for (const n of this.graph.nodes) byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
    // Count only indexed (non-dangling) links — the constructor drops links whose
    // source/target is missing, so graph.links.length would overstate the real count.
    let links = 0;
    for (const l of this.graph.links) if (this.byId.has(l.source) && this.byId.has(l.target)) links++;
    return { nodes: this.graph.nodes.length, links, byLayer };
  }

  meta() { return { ...this.graph.meta, counts: this.counts() }; }

  /** Aggregate: filter, then group and count. Vendored from packages/serve/src/graph.ts. */
  count(o = {}) {
    const get = (n, path) => (path.startsWith("data.") ? (n.data ?? {})[path.slice(5)] : n[path]);
    const inRange = (v) => {
      if (!o.since && !o.until) return true;
      const t = Date.parse(String(v ?? ""));
      if (Number.isNaN(t)) return false;
      if (o.since && t < Date.parse(o.since)) return false;
      if (o.until && t > Date.parse(o.until)) return false;
      return true;
    };
    const hit = (n) =>
      (!o.layer || n.layer === o.layer) &&
      typeMatches(n.type, o.type) &&
      (!o.cluster || n.cluster === o.cluster) &&
      (!o.where || Object.entries(o.where).every(([k, v]) => String(get(n, k) ?? "") === String(v))) &&
      (!(o.since || o.until) || inRange(get(n, o.dateField ?? "data.date")));

    const rows = this.graph.nodes.filter(hit);
    if (!o.groupBy) return { total: rows.length, groups: [], groupBy: null };
    const tally = new Map();
    for (const n of rows) {
      const k = String(get(n, o.groupBy) ?? "—");
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    const groups = [...tally.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, Math.min(200, Math.max(1, o.limit ?? 20)));
    return { total: rows.length, groups, groupBy: o.groupBy };
  }

  clusters(type) {
    const out = {};
    for (const n of this.graph.nodes) {
      if (!typeMatches(n.type, type)) continue;
      if (!n.cluster) continue;
      out[n.cluster] = (out[n.cluster] ?? 0) + 1;
    }
    return out;
  }

  list(o = {}) {
    const q = o.q?.toLowerCase();
    const all = this.graph.nodes.filter(
      (n) =>
        (!o.layer || n.layer === o.layer) &&
        (!o.cluster || n.cluster === o.cluster) &&
        typeMatches(n.type, o.type) &&
        (!q || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)),
    );
    const off = Math.max(0, o.offset ?? 0);
    const lim = Math.min(1000, Math.max(1, o.limit ?? 100));
    return { total: all.length, nodes: all.slice(off, off + lim) };
  }

  node(id) { return this.byId.get(id) ?? null; }

  /** Ranked label/id search: exact > prefix > substring, weight as tiebreak. */
  search(query, limit = 20) {
    const s = (query ?? "").trim().toLowerCase();
    if (!s) return [];
    const scored = [];
    for (const n of this.graph.nodes) {
      const lbl = n.label.toLowerCase();
      const id = n.id.toLowerCase();
      let sc = 0;
      if (lbl === s || id === s) sc = 3;
      else if (lbl.startsWith(s) || id.startsWith(s)) sc = 2;
      else if (lbl.includes(s) || id.includes(s)) sc = 1;
      if (sc) scored.push({ n, sc: sc + Math.min(0.9, n.weight ?? 0) });
    }
    scored.sort((a, b) => b.sc - a.sc);
    return scored.slice(0, Math.min(100, Math.max(1, limit))).map((x) => x.n);
  }

  /** BFS neighbourhood out to `depth`, capped at `limit` nodes. Links are deduped. */
  neighbors(id, depth = 1, limit = 200) {
    const center = this.byId.get(id);
    if (!center) return { center: null, nodes: [], links: [] };
    const seen = new Set([id]);
    const linkSeen = new Set();
    const nodes = [];
    const links = [];
    let frontier = [id];
    const d = Math.min(6, Math.max(1, depth));
    const lim = Math.min(2000, Math.max(1, limit));
    for (let step = 0; step < d && nodes.length < lim; step++) {
      const next = [];
      for (const cur of frontier) {
        for (const e of this.adj.get(cur) ?? []) {
          if (!linkSeen.has(e.link)) { linkSeen.add(e.link); links.push(e.link); }
          if (!seen.has(e.other)) {
            seen.add(e.other);
            nodes.push(this.byId.get(e.other));
            next.push(e.other);
            if (nodes.length >= lim) break;
          }
        }
        if (nodes.length >= lim) break;
      }
      frontier = next;
    }
    return { center, nodes, links };
  }

  /** Shortest path (unweighted BFS) between two node ids; null if unreachable. */
  path(from, to, maxHops = 64) {
    if (!this.byId.has(from) || !this.byId.has(to)) return null;
    if (from === to) return [this.byId.get(from)];
    const prev = new Map();
    const seen = new Set([from]);
    let frontier = [from];
    const cap = Math.min(1000, Math.max(1, maxHops));
    for (let h = 0; h < cap; h++) {
      const next = [];
      for (const cur of frontier) {
        for (const e of this.adj.get(cur) ?? []) {
          if (seen.has(e.other)) continue;
          seen.add(e.other);
          prev.set(e.other, cur);
          if (e.other === to) {
            const chain = [to];
            let c = to;
            while (prev.has(c)) { c = prev.get(c); chain.push(c); }
            return chain.reverse().map((x) => this.byId.get(x));
          }
          next.push(e.other);
        }
      }
      if (!next.length) break;
      frontier = next;
    }
    return null;
  }
}

/** An agent's boot-time view of the organigram: who it is, what it inherits,
 *  who it commands. Pure — same shape the local booboo_boot verb returns. */
export function orgBootSlice(org, agentId) {
  const byId = new Map(org.agents.map((a) => [a.id, a]));
  const agent = byId.get(agentId);
  if (!agent) return null;
  const chain = [];
  let cur = agent;
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  const dedup = (xs) => [...new Set(xs)];
  return {
    agent,
    chain,
    rules: dedup(chain.flatMap((a) => a.rules ?? [])),
    buckets: dedup(chain.flatMap((a) => a.buckets ?? [])),
    skills: dedup(agent.skills ?? []),
    children: org.agents.filter((a) => a.parent === agentId),
  };
}
