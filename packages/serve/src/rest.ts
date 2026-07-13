import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { BoobooIndex } from "./graph.js";
import type { JournalWriter } from "./journal.js";

/** Constant-time compare — a plain `!==` on the bearer token leaks its length/prefix
 *  via response timing. Buffers must be equal length for timingSafeEqual, so a length
 *  mismatch is rejected first (itself constant-time relative to the token, not the input). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

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
 *    GET /path/:from/:to?maxHops=      → shortest path
 *
 *    POST /remember  ·  /report        → write a memory/report (with a writer; 403 read-only)
 *
 *  Auth: if BOOBOO_TOKEN is set, every request must carry `Authorization: Bearer <token>` (401 otherwise);
 *  unset → open. CORS origin is BOOBOO_CORS_ORIGIN (default `*`). Writes are enabled only when a
 *  `writer` is passed (the CLI omits it under BOOBOO_READONLY / --no-write). */
export function createRestServer(ix: BoobooIndex, writer?: JournalWriter): http.Server {
  const token = process.env.BOOBOO_TOKEN;
  const cors = process.env.BOOBOO_CORS_ORIGIN ?? "*";
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.searchParams;
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": cors });
      res.end(JSON.stringify(body));
    };
    if (token && !safeEqual(req.headers.authorization ?? "", `Bearer ${token}`)) return send(401, { error: "unauthorized" });
    const seg = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    // ── writes (POST /remember · /report) — the live memory system ──────────
    if (req.method === "POST" && (seg[0] === "remember" || seg[0] === "report")) {
      if (!writer) return send(403, { error: "writes disabled (read-only) — unset BOOBOO_READONLY / drop --no-write to enable" });
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 1_000_000) req.destroy(); // guard: cap a runaway body
      });
      req.on("end", () => {
        try {
          const inp = body ? JSON.parse(body) : {};
          send(200, seg[0] === "report" ? writer.report(inp) : writer.remember(inp));
        } catch (e) {
          send(400, { error: String((e as Error)?.message ?? e) });
        }
      });
      return;
    }

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
      if (seg[0] === "path" && seg[1] && seg[2]) return send(200, { path: ix.path(seg[1], seg[2], num(p, "maxHops", 64)) });
      send(404, { error: "unknown route", routes: ["/graph", "/stats", "/search?q=", "/nodes", "/nodes/:id", "/neighbors/:id", "/path/:from/:to"] });
    } catch (e) {
      send(500, { error: String((e as Error)?.message ?? e) });
    }
  });
}
