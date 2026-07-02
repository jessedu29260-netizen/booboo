import type { BoobooGraph, BNode, BLink } from "@booboo-brain/spec";

type Edge = { link: BLink; other: string; dir: "out" | "in" };

export type ListOpts = { layer?: string; cluster?: string; type?: string; q?: string; limit?: number; offset?: number };
export type Neighborhood = { center: BNode | null; nodes: BNode[]; links: BLink[] };

/** In-memory query index over a Booboo snapshot — the shared core behind REST + MCP.
 *  Pure (no Node/fs/network deps) so it also runs in a browser. */
export class BoobooIndex {
  readonly graph: BoobooGraph;
  private byId = new Map<string, BNode>();
  private adj = new Map<string, Edge[]>();

  constructor(graph: BoobooGraph) {
    this.graph = graph;
    for (const n of graph.nodes) this.byId.set(n.id, n);
    for (const l of graph.links) {
      if (!this.byId.has(l.source) || !this.byId.has(l.target)) continue; // skip dangling
      this.edge(l.source).push({ link: l, other: l.target, dir: "out" });
      this.edge(l.target).push({ link: l, other: l.source, dir: "in" });
    }
  }
  private edge(id: string): Edge[] {
    let a = this.adj.get(id);
    if (!a) { a = []; this.adj.set(id, a); }
    return a;
  }

  meta() { return { ...this.graph.meta, counts: this.counts() }; }

  counts() {
    const byLayer: Record<string, number> = {};
    for (const n of this.graph.nodes) byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
    return { nodes: this.graph.nodes.length, links: this.graph.links.length, byLayer };
  }

  node(id: string): BNode | null { return this.byId.get(id) ?? null; }

  list(o: ListOpts = {}): { total: number; nodes: BNode[] } {
    const q = o.q?.toLowerCase();
    const all = this.graph.nodes.filter(
      (n) =>
        (!o.layer || n.layer === o.layer) &&
        (!o.cluster || n.cluster === o.cluster) &&
        (!o.type || n.type === o.type) &&
        (!q || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)),
    );
    const off = Math.max(0, o.offset ?? 0);
    const lim = Math.min(1000, Math.max(1, o.limit ?? 100));
    return { total: all.length, nodes: all.slice(off, off + lim) };
  }

  /** Ranked label/id search: exact > prefix > substring, weight as tiebreak. */
  search(query: string, limit = 20): BNode[] {
    const s = (query ?? "").trim().toLowerCase();
    if (!s) return [];
    const scored: { n: BNode; sc: number }[] = [];
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
  neighbors(id: string, depth = 1, limit = 200): Neighborhood {
    const center = this.byId.get(id);
    if (!center) return { center: null, nodes: [], links: [] };
    const seen = new Set<string>([id]);
    const linkSeen = new Set<BLink>();
    const nodes: BNode[] = [];
    const links: BLink[] = [];
    let frontier = [id];
    const d = Math.min(6, Math.max(1, depth));
    const lim = Math.min(2000, Math.max(1, limit));
    for (let step = 0; step < d && nodes.length < lim; step++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const e of this.adj.get(cur) ?? []) {
          if (!linkSeen.has(e.link)) { linkSeen.add(e.link); links.push(e.link); }
          if (!seen.has(e.other)) {
            seen.add(e.other);
            nodes.push(this.byId.get(e.other)!);
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
  path(from: string, to: string, maxHops = 8): BNode[] | null {
    if (!this.byId.has(from) || !this.byId.has(to)) return null;
    if (from === to) return [this.byId.get(from)!];
    const prev = new Map<string, string>();
    const seen = new Set<string>([from]);
    let frontier = [from];
    const cap = Math.min(20, Math.max(1, maxHops));
    for (let h = 0; h < cap; h++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const e of this.adj.get(cur) ?? []) {
          if (seen.has(e.other)) continue;
          seen.add(e.other);
          prev.set(e.other, cur);
          if (e.other === to) {
            const chain: string[] = [to];
            let c = to;
            while (prev.has(c)) { c = prev.get(c)!; chain.push(c); }
            return chain.reverse().map((x) => this.byId.get(x)!);
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
