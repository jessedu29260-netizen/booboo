# @booboo/build

Turn any database into a [Booboo](../../README.md) graph with a YAML config — no glue code.

## Use

```bash
booboo build --config booboo.config.yaml
```

Each source is read through an adapter, then the engine merges them, applies privacy
**walls**, auto-wires a spine edge for every `parent`, drops dangling links, validates
against `@booboo/spec`, and writes the snapshot.

## Config

```yaml
title: "My System"
root: { id: core, type: root, label: CORE, layer: agents }
layers:
  - { name: agents, color: "#c9a04a" }
  - { name: memory, color: "#a78bd0" }
walls: [secret, private]            # a node whose `cluster` is listed here is NEVER emitted
sources:
  - adapter: postgres
    url: ${DATABASE_URL}            # ${ENV_VAR} is substituted from the environment
    nodes:
      - { table: agents, layer: agents, id: slug, label: name, parent: core, weight: 0.6, icon: emoji, cluster: team }
      - { table: notes,  layer: memory, id: id,   label: title, cluster: project, where: "archived = false" }
    links:
      - { table: edges, source: src, target: dst, type: rel }
  - adapter: json                   # merge an existing Booboo file as-is
    path: ./extra.booboo.json
output:
  snapshot: ./my.booboo.json
```

**Node mapping** — `id` `label` `cluster` `icon` `color` `weight_from` are **column names**;
`weight` `tier` `parent` `type` `prefix` are literals. `weight_from` is min-max normalised
to `0..1`. `where` is raw SQL (trusted config).

**Adapters** — `postgres` (read-only; Supabase / Neon / local; SSL auto-on for remote hosts)
and `json` (passthrough merge). Add one by exporting `(src) => { nodes, links }` and wiring
it into `build.ts`.

## API

```ts
import { buildFromConfig, build, loadConfig } from "@booboo/build";
const { graph, snapshotPath } = await buildFromConfig("booboo.config.yaml");
```

Layout is the viewer's job, so the emitted graph carries no positions — it stays small and
portable. Feed the snapshot to `@booboo/viewer`, serve it over the REST/MCP layer, or commit
it as a fixture.
