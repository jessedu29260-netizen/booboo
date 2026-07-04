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

  const graph: BoobooGraph = {
    booboo: "1.0",
    meta: { root: config.root.id, title: config.title, layers, counts: { nodes: finalNodes.length, links: finalLinks.length } },
    nodes: finalNodes,
    links: finalLinks,
  };
  const v = validate(graph);
  if (!v.ok) throw new Error("invalid graph: " + v.errors.join("; "));
  return graph;
}
