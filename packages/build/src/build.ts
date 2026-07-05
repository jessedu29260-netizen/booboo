import type { BoobooGraph, BNode, BLink, BLayer } from "@booboo-brain/spec";
import { validate } from "@booboo-brain/spec";
import type { BoobooConfig } from "./config.js";
import { postgresAdapter } from "./adapters/postgres.js";
import { jsonAdapter } from "./adapters/json.js";

/** Run every source through its adapter, merge, apply privacy WALLS (sealed clusters are never
 *  emitted), auto-wire a spine edge for every parent, drop dangling links, validate → a Booboo
 *  graph. Layout is the viewer's job, so positions stay optional. */
export async function build(config: BoobooConfig, baseDir = process.cwd()): Promise<BoobooGraph> {
  const nodes: BNode[] = [];
  const links: BLink[] = [];
  let layers: BLayer[] = [...(config.layers ?? [])]; // copy — never mutate the caller's config.layers (deterministic across repeated build() calls)

  nodes.push({
    id: config.root.id,
    type: config.root.type ?? "root",
    layer: config.root.layer ?? layers[0]?.name ?? "root",
    label: config.root.label ?? config.root.id,
    weight: 1,
    tier: 0,
    parent: null,
  });

  for (const src of config.sources ?? []) {
    if (src.adapter === "postgres") {
      const r = await postgresAdapter(src);
      nodes.push(...r.nodes);
      links.push(...r.links);
    } else if (src.adapter === "json") {
      const r = jsonAdapter(src, baseDir);
      nodes.push(...r.nodes);
      links.push(...r.links);
      if (r.layers && !config.layers?.length) layers = r.layers;
    }
  }

  // privacy walls: a node is NEVER emitted if its cluster OR its per-source wall_field value (carried
  // as the build-time-only data.__wall marker) is walled — sealed data never leaves here
  const walls = new Set(config.walls ?? []);
  const walled = (n: BNode) =>
    (n.cluster != null && walls.has(String(n.cluster))) || (n.data?.__wall != null && walls.has(String(n.data.__wall)));
  const kept = walls.size ? nodes.filter((n) => !walled(n)) : nodes;
  // strip the internal marker so it never leaks into emitted node.data for kept nodes
  for (const n of kept) if (n.data && "__wall" in n.data) delete n.data.__wall;

  // dedup by id (first wins)
  const seen = new Set<string>();
  const finalNodes: BNode[] = [];
  for (const n of kept) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      finalNodes.push(n);
    }
  }

  // auto-wire a spine edge for every parent relationship (the rooted tree)
  for (const n of finalNodes) {
    if (n.parent && n.parent !== n.id && seen.has(n.parent)) links.push({ source: n.parent, target: n.id, type: "spine" });
  }

  // AUTHORED links: [[refs]] a writer chose while understanding the source —
  // higher signal than any harvested relation, so they carry full weight.
  // A ref resolves by node id first, then by exact label (deduped per pair).
  if (config.wikilinks) {
    const byLabel = new Map<string, string>();
    for (const n of finalNodes) if (!byLabel.has(n.label)) byLabel.set(n.label, n.id);
    const emitted = new Set<string>();
    for (const n of finalNodes) {
      const texts: string[] = [n.label];
      for (const v of Object.values(n.data ?? {})) if (typeof v === "string") texts.push(v);
      for (const t of texts) {
        for (const m of t.matchAll(/\[\[([^[\]|]+?)(?:\|[^[\]]*)?\]\]/g)) {
          const ref = m[1].trim();
          const target = seen.has(ref) ? ref : byLabel.get(ref);
          const key = target && `${n.id}→${target}`;
          if (target && target !== n.id && key && !emitted.has(key)) {
            emitted.add(key);
            links.push({ source: n.id, target, type: "authored", weight: 1 });
          }
        }
      }
    }
  }

  // drop dangling links (endpoints that don't resolve to a kept node)
  const finalLinks = links.filter((l) => seen.has(l.source) && seen.has(l.target));

  // warn on silently-dropped dangling links (the #1 config foot-gun: node id prefix vs link endpoints)
  const droppedLinks = links.length - finalLinks.length;
  if (droppedLinks > 0)
    console.warn(`booboo: dropped ${droppedLinks} dangling link(s) — endpoint id not found (check node id prefixes; see docs/TROUBLESHOOTING.md).`);

  // union: ensure meta.layers covers every layer the nodes actually use (not just the declared ones)
  const declared = new Set(layers.map((l) => l.name));
  const addedLayers: string[] = [];
  for (const n of finalNodes) {
    if (!declared.has(n.layer)) {
      declared.add(n.layer);
      layers.push({ name: n.layer, label: n.layer.toUpperCase() });
      addedLayers.push(n.layer);
    }
  }
  if (addedLayers.length)
    console.warn(`booboo: added ${addedLayers.length} layer(s) used by nodes but absent from config.layers: ${addedLayers.join(", ")}.`);

  // ingestion-quality stats — curation needs a number, not a vibe.
  // orphans: nothing deliberate or derived touches them (spine alone ≠ connected).
  // dumps: a text blob that big is a transcript, not an atomic note.
  const DUMP_CHARS = 4000;
  const linked = new Set<string>();
  for (const l of finalLinks) if (l.type !== "spine") { linked.add(l.source); linked.add(l.target); }
  const quality = {
    orphans: finalNodes.filter((n) => n.id !== config.root.id && !linked.has(n.id)).length,
    authored: finalLinks.filter((l) => l.type === "authored").length,
    dumps: finalNodes.filter((n) => Object.values(n.data ?? {}).some((v) => typeof v === "string" && v.length > DUMP_CHARS)).length,
  };

  const graph: BoobooGraph = {
    booboo: "1.0",
    meta: { root: config.root.id, title: config.title, layers, counts: { nodes: finalNodes.length, links: finalLinks.length }, quality },
    nodes: finalNodes,
    links: finalLinks,
  };
  const v = validate(graph);
  if (!v.ok) throw new Error("invalid graph: " + v.errors.join("; "));
  return graph;
}
