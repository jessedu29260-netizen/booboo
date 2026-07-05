# Booboo config reference (`booboo.config.yaml`)

The whole user-facing surface. `booboo build` reads this file, runs each source through its adapter, merges into one rooted graph, applies privacy walls, and writes the snapshot. `${ENV_VAR}` anywhere is substituted from the environment at load time.

```yaml
title: "My System"                    # optional — shown in the viewer/meta
root: { id: core, type: root, label: "MY SYSTEM" }   # the node everything roots to
layers:                               # the stacked planes (Z-order = array order)
  - { name: agents,    color: "#c9a04a", label: "AGENTS" }
  - { name: knowledge, color: "#4ECDC4" }
walls: [private, sealed]              # cluster values filtered BEFORE emit (never serialized)
sources: [ ... ]                      # one or more adapters (below)
output:
  snapshot: ./brain.json             # written on every build (relative to the config file)
```

## Top-level keys

| Key | Required | Notes |
|---|---|---|
| `root` | ✅ | `{ id, type?, label?, layer? }`. The builder creates this node (weight 1, tier 0). `layer` defaults to the first `layers[]` entry. |
| `layers` | ✅* | `{ name, color?, label? }[]`. *If omitted and a JSON source provides layers, those are adopted. **Declare every layer your nodes use** (see Gotchas). |
| `walls` | — | List of `cluster` values that are dropped before emit. Sealed data never reaches the snapshot, API, or MCP. |
| `sources` | ✅ | Array of `json` and/or `postgres` sources, merged in order. |
| `output.snapshot` | — | Path to write the graph JSON. Relative paths resolve against the config file's directory. |

## Source: `json` (the starter / escape hatch)

```yaml
sources:
  - adapter: json
    path: ./data.booboo.json   # a file already in Booboo graph shape — merged as-is
```
Passthrough: its `nodes`, `links`, and (if `layers` is unset above) `meta.layers` are merged in. Use it to seed, to hand-author, or to bolt on anything an adapter can't reach.

## Source: `postgres` (build from your database)

Works with any Postgres (Supabase / Neon / local). **Read-only.**

```yaml
sources:
  - adapter: postgres
    url: ${DATABASE_URL}                 # postgres://… from the environment
    nodes:
      - { table: agents, layer: agents, id: slug, label: name, parent: core, weight: 0.6, prefix: "agent:" }
      - { table: kg_entities, layer: knowledge, id: id, label: name, weight_from: degree, cluster: domain }
    links:
      - { table: edges, source: src, target: dst, type: rel }
```

**`nodes[]` (NodeSpec)** — one block per table, each row → a node:

| Field | Meaning |
|---|---|
| `table` | source table (interpolated raw — trusted config only) |
| `layer` | which plane the nodes land on (must exist in `layers`) |
| `id` | column → node id |
| `label` | column → display label (falls back to the id) |
| `type` | node type (default = `layer`) |
| `prefix` | string prepended to every id (e.g. `"agent:"`) — **see the links gotcha** |
| `weight` | constant 0..1 importance (default 0.3) |
| `weight_from` | OR a numeric column, normalised 0..1 across the rows |
| `tier` | discrete importance band (0 = apex) for LOD/labels |
| `cluster` | column → grouping key (also the field `walls` matches on) |
| `icon` / `color` | column → emoji / hex override |
| `parent` | a **literal** node id (e.g. `core`) — all rows from this table share it |
| `where` | raw SQL `WHERE` (interpolated — trusted config only) |

**`links[]` (LinkSpec)** — one block per edge table:

| Field | Meaning |
|---|---|
| `table` | edge table |
| `source` / `target` | columns holding the endpoint ids |
| `type` | column → relation type (default `"link"`) |
| `where` | raw SQL `WHERE` |

## Gotchas (read before you build)

1. **Links must use the *prefixed* id.** If your nodes set `prefix: "agent:"`, the `source`/`target` values in your links table must also be `agent:<id>` — the adapter does **not** re-apply the prefix to link endpoints. Mismatched endpoints are **silently dropped** as dangling links. If links go missing, this is almost always why.
2. **Declare every layer.** Nodes whose `layer` isn't in `layers[]` still build, but the viewer has no colour/plane for them. The builder does not auto-union source layers when you've declared your own.
3. **`parent` is table-level, not per-row.** For per-row hierarchy, model it as `links` instead.
4. **`where` and `table` are raw SQL**, interpolated, not parameterised. The config is trusted (you write it) — never build it from untrusted input.
5. **Non-local SSL.** For remote URLs the adapter connects with `rejectUnauthorized: false` (works out-of-the-box with Supabase/Neon poolers). If you need strict cert validation, that's a planned option.
6. **Privacy walls** match a node's `cluster` value. To seal a namespace, make sure those rows carry a `cluster` you list in `walls`.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for symptoms → fixes.

## `wikilinks: true` — authored edges

Set `wikilinks: true` at the top level and the builder scans every node's `label` and
string `data` fields for `[[refs]]`, emitting them as first-class `authored` edges
(weight 1). A ref resolves against a node **id** first, then an **exact label**; the
alias form `[[target|shown text]]` works. Unresolvable refs are skipped silently.
Authored links are the ones a writer *chose* — rank them above harvested relations in
your consumers (the vault lists them first; the viewer weights them fully).

Every build also emits `meta.quality` — `{ authored, orphans, dumps }`:
`orphans` = non-root nodes with no non-spine link · `dumps` = nodes carrying a text
field over ~4000 chars (a transcript, not an atomic note). Watch the numbers: authored
should grow, orphans and dumps should not.
