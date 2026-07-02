import pg from "pg";
import type { BNode, BLink } from "@booboo-brain/spec";
import type { NodeSpec, LinkSpec } from "../config.js";

const q = (c: string) => `"${c.replace(/"/g, '""')}"`; // quote an identifier

/** Config-driven Postgres adapter. Each NodeSpec → a SELECT → BNodes; each LinkSpec → BLinks.
 *  Works with any Postgres (Supabase / Neon / local). Read-only. */
export async function postgresAdapter(src: { url: string; nodes?: NodeSpec[]; links?: LinkSpec[] }): Promise<{ nodes: BNode[]; links: BLink[] }> {
  const isLocal = /localhost|127\.0\.0\.1/.test(src.url);
  const client = new pg.Client({ connectionString: src.url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  const nodes: BNode[] = [];
  const links: BLink[] = [];
  try {
    for (const ns of src.nodes ?? []) {
      const cols = new Set<string>([ns.id, ns.label]);
      for (const c of [ns.cluster, ns.icon, ns.color, ns.weight_from]) if (c) cols.add(c);
      for (const c of ns.data ?? []) cols.add(c);
      const sel = [...cols].map(q).join(", ");
      const sql = `SELECT ${sel} FROM ${ns.table}${ns.where ? ` WHERE ${ns.where}` : ""}`;
      const { rows } = await client.query(sql);

      let maxW = 1;
      if (ns.weight_from) for (const r of rows) maxW = Math.max(maxW, Number(r[ns.weight_from]) || 0);

      for (const r of rows) {
        const rawId = String(r[ns.id]);
        const id = (ns.prefix ?? "") + rawId;
        const weight = ns.weight_from ? Math.min(1, (Number(r[ns.weight_from]) || 0) / maxW) : ns.weight ?? 0.3;
        nodes.push({
          id,
          type: ns.type ?? ns.layer,
          layer: ns.layer,
          label: String(r[ns.label] ?? rawId),
          weight,
          tier: ns.tier,
          cluster: ns.cluster ? (r[ns.cluster] == null ? null : String(r[ns.cluster])) : undefined,
          icon: ns.icon ? (r[ns.icon] ?? undefined) : undefined,
          color: ns.color ? (r[ns.color] ?? undefined) : undefined,
          parent: ns.parent ?? null,
          data: ns.data ? Object.fromEntries(ns.data.map((c) => [c, (r as Record<string, unknown>)[c] ?? null])) : (r as Record<string, unknown>),
        });
      }
    }

    for (const ls of src.links ?? []) {
      const cols = new Set<string>([ls.source, ls.target]);
      if (ls.type) cols.add(ls.type);
      const sel = [...cols].map(q).join(", ");
      const sql = `SELECT ${sel} FROM ${ls.table}${ls.where ? ` WHERE ${ls.where}` : ""}`;
      const { rows } = await client.query(sql);
      for (const r of rows) {
        links.push({
          source: String(r[ls.source]),
          target: String(r[ls.target]),
          type: ls.type ? String(r[ls.type] ?? "link") : "link",
        });
      }
    }
  } finally {
    await client.end();
  }
  return { nodes, links };
}
