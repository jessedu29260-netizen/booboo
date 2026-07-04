# Booboo — architecture & requirements blueprint (v1)

Decisions locked: **full framework v1**, **TypeScript-only** (one `npx`/Node toolchain). This is the doc we build against.

> **Naming:** the product is **Booboo** — packages `@booboo-brain/*`, config `booboo.config.yaml`, spec version key `booboo`. "Atlas" refers **only** to the internal Dionisos OS component this was extracted from (see §7) — not the product.

---

## 1 · Packages (pnpm monorepo)

| Package | Responsibility | Key deps |
|---|---|---|
| `@booboo-brain/spec` | The Booboo JSON types + a validator (`validate(g): Result`). Zero deps. The contract. | `zod` |
| `@booboo-brain/build` | Config loader + **adapters** (postgres, json) + the merge/layout/weight/wall engine → emits Booboo JSON. | `pg`, `yaml`, `@booboo-brain/spec` |
| `@booboo-brain/viewer` | The R3F 3D component (`<BoobooView data={} cfg={} />`) — dossier, controls, command palette, kiosk/wallpaper mode. Framework-agnostic React. | `three`, `@react-three/fiber`, `@react-three/drei` |
| `@booboo-brain/serve` | REST API + **MCP server** over a Booboo JSON (static file or a live `@booboo-brain/build` run). | `hono` (or `express`), `@modelcontextprotocol/sdk` |
| `create-booboo` | Scaffolder/CLI: `init` (wizard), `build`, `serve`, `mcp`. Ships a **demo dataset**. | `prompts`, `@booboo-brain/*` |

Flow: `@booboo-brain/build` → Booboo JSON → consumed by `@booboo-brain/viewer` + `@booboo-brain/serve`. `create-booboo` wires them into a one-command experience.

## 2 · The config (`booboo.config.yaml`)

The whole user-facing surface for reusability. Adapters are config-driven; you only write code for an exotic source.

```yaml
title: "My System"
root: { id: core, type: root, label: "MY SYSTEM" }

layers:
  - { name: agents,    color: "#c9a04a" }
  - { name: memory,    color: "#a78bd0" }
  - { name: knowledge, color: "#4ECDC4" }

walls: [private, sealed]          # cluster/namespace values that are NEVER emitted

sources:
  - adapter: postgres
    url: ${DATABASE_URL}
    nodes:
      - { table: agents,        layer: agents,    id: slug, label: name, parent: core, weight: 0.6 }
      - { table: observations,  layer: memory,    id: id,   label: title, cluster: project, where: "kind <> 'noise'" }
      - { table: kg_entities,   layer: knowledge, id: id,   label: name, weight_from: degree }
    links:
      - { table: edges, source: src, target: dst, type: rel }
  - adapter: json
    path: ./data/extra.booboo.json # passthrough: merged in as-is (escape hatch for anything)

output:
  snapshot: ./build/booboo.json    # always written
```

**Layout/weighting** are computed by the builder from `parent`/`cluster`/`weight`/`tier` (sector angles per cluster, radius by tier, gentle deterministic jitter) — the user never hand-places nodes. Fixed `x/y/z` in the spec override it when needed.

## 3 · API + MCP surface (the query layer)

### Shipped today (`@booboo-brain/serve`)

**REST:**
- `GET /graph` → the full graph (Booboo JSON)
- `GET /stats` → node/link/layer counts
- `GET /search?q=…` → ranked node search
- `GET /nodes/:id` → one node + its relations (the dossier payload)
- `GET /neighbors/:id` → a node's immediate neighbours
- `GET /path/:from/:to` → shortest path between two nodes

**MCP** (stdio, same logic): `booboo_stats` · `booboo_search` · `booboo_node` · `booboo_neighbors` · `booboo_path`. Passing `mcp --org <org.booboo.json>` additionally exposes `booboo_boot` (agents boot FROM the org) and `booboo_org`. All read-only.

### Target / roadmap (not yet shipped)

The verb-oriented, agent-native surface below is the direction of travel — the `boot`/`recall`/`resolve` orientation verbs and the opt-in write-backs. **None of these routes/tools exist today**; they are tracked, not built.

**REST (roadmap):**
- `GET  /graph/node/:id` → dossier payload (shipped equivalent: `GET /nodes/:id`)
- `POST /graph/boot` → orientation: root + layer counts + top nodes per layer + recent (a single-call summary for agent boot)
- `POST /graph/recall` `{ q, layer?, limit? }` → ranked node search (shipped equivalent: `GET /search`)
- `GET  /graph/resolve?role=…` → look up a node/edge by a `data.role` key (canonical resolution)

**MCP (roadmap):**
- `boot(scope?)` · `recall(q, scope?)` · `resolve(role)` — read-only orientation verbs.
- `remember(text, kind?)` · `report(text)` — **opt-in write-backs** (need a writable source + a configured sink) — off by default.

## 4 · Requirements

**Functional**
1. Ingest from pluggable, config-driven sources (postgres + json in v1; neo4j + mcp-source as adapters later).
2. Merge into one rooted, layered graph; compute layout + weights; drop dangling refs (logged).
3. **Privacy walls**: configured namespaces are filtered *before* emit — sealed data never reaches the JSON, API, viewer, or MCP.
4. Serve REST + MCP (read verbs always; write verbs opt-in).
5. Render 3D: embeddable `<BoobooView/>`, a standalone `booboo serve` app, and a chrome-less **wallpaper/kiosk** mode (the exact dual-use we proved with Dionisos).
6. Node dossier renders `data` generically; optional per-type templates.
7. Rebuild on demand / schedule / webhook; the API serves the latest snapshot.
8. LOD: tier-gated rendering + label culling so 100k-node graphs stay smooth.

**Non-functional**
- **Install simplicity is priority #1**: one config, one command; JSON-first so the demo needs no DB.
- Read-only by default; secrets via env only; auth on the REST API (token / allowlist); MCP local by default.
- No lock-in: Postgres-native (Supabase/Neon/local) + JSON fallback. No proprietary services required.
- Deterministic builds (same input → same layout) so snapshots diff cleanly.
- Degrades on weak GPUs (2D fallback / reduced node cap).
- MIT, typed end-to-end, each package independently usable.

## 5 · Privacy walls (called out because it's load-bearing)

Walls aren't a filter on the way *out* — they're applied in the builder so sealed data is **never serialized**. A node is walled if its `cluster` (or a per-source `wall_field`) is in `config.walls`. This is how a personal/work brain keeps private namespaces out of a shared wallpaper or a public MCP. Ships on by default with an empty list; documented prominently.

## 6 · Roadmap (full v1)

- **P0 — Spec & demo** *(this commit)*: `SPEC.md`, `examples/demo.booboo.json`, monorepo skeleton. ✅
- **P1 — `@booboo-brain/spec` + `@booboo-brain/viewer`**: types/validator; port `AtlasView`/`OperationalAtlas` out of the Dionisos app into a standalone package driven purely by Booboo JSON. Demo renders.
- **P2 — `@booboo-brain/build`**: config loader + json & postgres adapters + layout/weight/wall engine. `booboo build` produces the snapshot.
- **P3 — `@booboo-brain/serve`**: REST + MCP over a snapshot/live build. Read verbs first.
- **P4 — `create-booboo`**: `init` wizard, `serve`, `mcp`, bundled demo, wallpaper route. The two-command UX.
- **P5 — polish & dispatch**: docs site, write-back verbs (opt-in), neo4j + mcp-source adapters, LOD/label-collision, weak-GPU fallback, examples gallery, `npx` publish.

## 7 · Current → OSS extraction map (what we already have)

> Left column = the existing **Dionisos** components (correctly named "Atlas" — the internal origin). Right column = the OSS Booboo packages they become.

| Have (Dionisos) | Becomes (OSS) | Work |
|---|---|---|
| `OperationalAtlas.tsx` + `AtlasView.tsx` | `@booboo-brain/viewer` | decouple from Next/OS; data via prop only; strip Dionisos types → generic |
| `atlas_gen_v4.py` (Python, hardcoded tables) | `@booboo-brain/build` (TS, config-driven) | **port ~400 lines to TS**, replace hardcoded reads with adapters + config |
| `atlas_mcp/server.py` + `/api/atlas` | `@booboo-brain/serve` | generalize verbs; drop Dionisos tables; TS rewrite |
| `atlas_snapshot` table + walls (aegis/personal) | `config.walls` (live DB-table output is roadmap) | generalize the snapshot + wall mechanism |
| `/ambient` wallpaper + kiosk mode | viewer `kiosk` prop + a `serve` route | already generic in the component — lift as-is |

~80% of the value is in code we've already written and proven; the OSS work is **generalization + TS port + packaging**, not green-field.

## 8 · Stack

TypeScript everywhere · pnpm workspaces · `tsup` builds · `zod` validation · `vitest` tests · `hono` server · `@modelcontextprotocol/sdk` MCP · React 19 + R3F viewer · Vite for the standalone app. Node 18+. MIT.
