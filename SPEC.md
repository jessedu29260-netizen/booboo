# Booboo JSON — the spec (v1)

> **Naming:** the product is **Booboo**. "Atlas" refers only to the internal Dionisos component this was extracted from — not the product.

The entire contract. Every adapter emits this; every consumer reads it. Keep it small.

```jsonc
{
  "booboo": "1.0",                      // spec version
  "meta": {
    "root": "core",                     // node id everything roots to
    "title": "My System",
    "layers": [                         // the stacked planes (Z-order = array order)
      { "name": "agents",    "color": "#c9a04a", "label": "AGENTS" },
      { "name": "memory",    "color": "#a78bd0" },
      { "name": "knowledge", "color": "#4ECDC4" }
    ],
    "generated": "2026-06-23T09:00:00Z",
    "counts": { "nodes": 0, "links": 0 }
  },
  "nodes": [
    {
      "id":     "agent:writer",         // unique string — REQUIRED
      "type":   "agent",                // your taxonomy (root|agent|memory|entity|…) — REQUIRED
      "layer":  "agents",               // must match a meta.layers[].name — REQUIRED
      "label":  "Writer",               // display name — REQUIRED
      "weight": 0.6,                    // 0..1 importance → drives size + opacity (default 0.3)
      "tier":   1,                      // optional discrete importance band (0 = apex)
      "parent": "core",                 // optional — draws a spine edge + sets hierarchy
      "cluster":"writer",               // optional — grouping key (nodes sharing it column together)
      "color":  null,                   // optional hex override (else inherits layer color)
      "icon":   "✍",                    // optional emoji or asset key
      "x": null, "y": null, "z": null,  // optional fixed coords (else the builder lays them out)
      "data":   { "role": "drafts content", "last": "shipped v1" }  // arbitrary — rendered in the dossier
    }
  ],
  "links": [
    { "source": "core", "target": "agent:writer", "type": "spine", "weight": 1.0, "color": null }
  ]
}
```

## Rules

1. **`id` is unique.** Convention: `type:slug` (e.g. `agent:writer`, `mem:1832`). The root id has no prefix.
2. **Every `node.layer` exists in `meta.layers`.** Layer order = Z-plane order (first = back, last = front).
3. **`parent`/`link.source`/`link.target` reference real node ids.** Dangling refs are dropped by the builder (logged, never silently rendered).
4. **`weight` ∈ [0,1]** → node size + opacity. **`tier`** is an optional coarse band for LOD/labeling (smaller = more important).
5. **`type` is free-form** — your own taxonomy. Consumers render generically by `layer`/`weight`/`tier`; they only special-case types you opt into (icons, dossier templates).
6. **`data` is opaque** to the builder/viewer — it's surfaced verbatim in the node dossier. Put metrics, reports, links, anything here.
7. **`link.type` is free-form.** `spine` is the one reserved type (parent→child structural edges; rendered dim). Everything else is a "real" relation.
8. **Privacy walls** are applied *before* emit: nodes whose `cluster` (or a configured field) is in `walls` are never written to the JSON. Sealed data never leaves the builder.

## Why this shape

- **Layers + `parent`** give you the rooted, stacked-plane brain without prescribing *what* the layers are — that's your call.
- **`weight`/`tier`** let the viewer do tier-based sizing + LOD on any dataset.
- **`cluster`** drives the "columns" (e.g. group memory under its project).
- **`data` blob** means the dossier works for any domain with zero viewer changes.

A valid minimal Booboo graph: a `root` node + `meta.root` pointing at it. Everything else is optional. See `examples/demo.booboo.json`.
