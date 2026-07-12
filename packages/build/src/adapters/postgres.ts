import pg from "pg";
import type { BNode, BLink } from "@booboo-brain/spec";
import type { NodeSpec, LinkSpec } from "../config.js";

const q = (c: string) => `"${c.replace(/"/g, '""')}"`; // quote an identifier

/** Strong DB passwords often contain URL-unsafe characters ($ # ! …) that make the
 *  WHATWG URL parser inside pg reject the DSN with "Invalid URL". If the raw string
 *  doesn't parse, percent-encode the password segment so users can paste their
 *  connection string exactly as Supabase/Neon hand it out. (Found dogfooding on the
 *  real Dionisos brain, 2026-07-02.) */
function normalizeDsn(url: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    const m = url.match(/^(postgres(?:ql)?:\/\/)([^:/]+):(.*)@([^@]+)$/s);
    if (!m) return url; // unexpected shape — let pg raise its own error
    console.error("booboo: percent-encoding special characters in the connection-string password");
    return m[1] + m[2] + ":" + encodeURIComponent(m[3]) + "@" + m[4];
  }
}

/** Config-driven Postgres adapter. Each NodeSpec → a SELECT → BNodes; each LinkSpec → BLinks.
 *  Works with any Postgres (Supabase / Neon / local). Read-only. */
export async function postgresAdapter(src: { url: string; nodes?: NodeSpec[]; links?: LinkSpec[] }): Promise<{ nodes: BNode[]; links: BLink[] }> {
  const url = normalizeDsn(src.url);
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  // Remote connections verify the server cert by default (managed providers like Supabase/Neon
  // present publicly-trusted certs, so this just works). Self-signed/internal Postgres needs an
  // explicit opt-out — never silent, since disabling cert verification defeats TLS entirely.
  const insecureTls = process.env.BOOBOO_PG_INSECURE_TLS === "1";
  if (insecureTls && !isLocal) console.error("booboo: BOOBOO_PG_INSECURE_TLS=1 — skipping Postgres certificate verification (TLS provides encryption only, no server identity check).");
  const ssl = isLocal ? undefined : { rejectUnauthorized: !insecureTls };
  const client = new pg.Client({ connectionString: url, ssl });
  await client.connect();
  const nodes: BNode[] = [];
  const links: BLink[] = [];
  try {
    for (const ns of src.nodes ?? []) {
      const cols = new Set<string>([ns.id, ns.label]);
      for (const c of [ns.cluster, ns.icon, ns.color, ns.weight_from, ns.wall_field]) if (c) cols.add(c);
      for (const c of ns.data ?? []) cols.add(c);
      const sel = [...cols].map(q).join(", ");
      const sql = `SELECT ${sel} FROM ${ns.table}${ns.where ? ` WHERE ${ns.where}` : ""}`;
      const { rows } = await client.query(sql);

      let maxW = 0; // start at 0 so a source whose max value is < 1 still normalizes up to 1.0
      if (ns.weight_from) for (const r of rows) maxW = Math.max(maxW, Number(r[ns.weight_from]) || 0);

      for (const r of rows) {
        const rawId = String(r[ns.id]);
        const id = (ns.prefix ?? "") + rawId;
        const weight = ns.weight_from
          ? (maxW > 0 ? Math.min(1, (Number(r[ns.weight_from]) || 0) / maxW) : 0.3) // guard divide-by-zero (all-zero column)
          : ns.weight ?? 0.3;
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
        // stamp the build-time-only wall marker (stripped after the walls filter, never emitted)
        if (ns.wall_field) {
          const wv = (r as Record<string, unknown>)[ns.wall_field];
          if (wv != null) {
            const last = nodes[nodes.length - 1];
            (last.data ??= {}).__wall = String(wv);
          }
        }
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
