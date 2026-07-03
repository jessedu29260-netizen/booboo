import http from "node:http";
import type { BoobooIndex } from "./graph.js";

const num = (u: URLSearchParams, k: string, d: number) => {
  const v = parseInt(u.get(k) ?? "", 10);
  return Number.isFinite(v) ? v : d;
};
const str = (u: URLSearchParams, k: string) => u.get(k) ?? undefined;

/** A tiny stdlib HTTP server exposing the query index as JSON. CORS-open so a browser viewer
 *  can fetch it directly. Read-only, no deps. Routes:
 *    GET /  ·  /graph                 → meta + counts
 *    GET /stats                        → counts by layer
 *    GET /search?q=&limit=             → ranked search
 *    GET /nodes?layer=&cluster=&type=&q=&limit=&offset= → filtered list
 *    GET /nodes/:id                    → one node
 *    GET /neighbors/:id?depth=&limit=  → neighbourhood
 *    GET /path/:from/:to               → shortest path */
export function createRestServer(ix: BoobooIndex): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.searchParams;
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify(body));
    };
    const seg = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (seg.length === 0 || seg[0] === "graph") return send(200, ix.meta());
      if (seg[0] === "stats") return send(200, ix.counts());
      if (seg[0] === "clusters") return send(200, { clusters: ix.clusters(str(p, "type")) });
      if (seg[0] === "search") return send(200, { nodes: ix.search(p.get("q") ?? "", num(p, "limit", 20)) });
      if (seg[0] === "nodes" && seg[1]) {
        const n = ix.node(seg[1]);
        return n ? send(200, n) : send(404, { error: `no node '${seg[1]}'` });
      }
      if (seg[0] === "nodes")
        return send(200, ix.list({ layer: str(p, "layer"), cluster: str(p, "cluster"), type: str(p, "type"), q: str(p, "q"), limit: num(p, "limit", 100), offset: num(p, "offset", 0) }));
      if (seg[0] === "neighbors" && seg[1]) return send(200, ix.neighbors(seg[1], num(p, "depth", 1), num(p, "limit", 200)));
      if (seg[0] === "path" && seg[1] && seg[2]) return send(200, { path: ix.path(seg[1], seg[2]) });
      send(404, { error: "unknown route", routes: ["/graph", "/stats", "/search?q=", "/nodes", "/nodes/:id", "/neighbors/:id", "/path/:from/:to"] });
    } catch (e) {
      send(500, { error: String((e as Error)?.message ?? e) });
    }
  });
}
