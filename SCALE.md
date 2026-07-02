# Booboo at scale — the million-node story

The claim: **Booboo renders a million-node brain at 60fps in your browser.** This page covers what ships today to prove it, how the renderer does it, and what the scale story grows into.

## Try it today

Two shipping paths put a synthetic mega-brain on your screen — no data required:

```bash
# 1) The CLI — serves the prebuilt viewer app and opens your browser
booboo view --demo --nodes 1000000

# 2) The viewer playground (from a monorepo clone)
pnpm -F @booboo-brain/viewer dev      # then open with ?n=1000000
```

Both generate the nodes client-side (`--nodes` / `?n=` is tunable from 10k up), so you can feel the LOD engine at any size before pointing Booboo at real data. The same renderer has also been proven on a real 4,469-node production brain built straight from Postgres by config alone.

## Rendering it at 60fps (the honest engineering)

"Industrial grade" = smart LOD, **not** brute-forcing a million objects. The architecture, as shipped in `@booboo-brain/viewer`:

1. **One GPU point field.** The whole node cloud is a *single* `<points>` geometry — one draw call for a million nodes. The CPU/React never touches per-node objects.
2. **Typed-array data path.** Positions/colors/sizes live in flat `Float32Array`s, computed once at layout. No per-node React components, no object-per-node.
3. **Tier-LOD labels.** Only nodes in sparse tiers (the structural hundreds, plus the root) ever get labels; dense tiers stay unlabelled field. Layer platforms, rings, and fog are a handful of meshes regardless of node count.
4. **Index-based picking.** Clicks resolve to a point index on the single geometry — no per-node hit targets to build or test.

## Targets

| Nodes | Experience |
|---|---|
| 10k | instant |
| 250k | smooth, "this is big" |
| 1M | the headline — **a million-node brain at 60fps** |

## Roadmap — the coherent synthetic generator

Today's `--demo` cloud is synthetic but simple. The planned `booboo demo` generator (tracked in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)) builds a *plausible* mega-system instead of noise:

- **Org spine:** 1 root → divisions → teams → agents (the AGENTS layer).
- **Memory layer:** each agent accrues episodic observations — the bulk of the nodes, clustered under their agent, Zipf-distributed in recency/weight, so the cloud looks *lived-in*.
- **Knowledge layer:** a power-law knowledge graph the agents reference.
- **Automations layer:** crons/jobs wired to their teams.
- Deterministic from a `--seed` → reproducible screenshots.

Also on the roadmap: chunked/streamed generation (web-worker batches or streaming from the builder, so a 500 MB JSON is never materialized in one go), GPU picking (read back the instance id under the cursor), screen-space label collision culling, and a weak-GPU fallback that caps the field and degrades gracefully instead of dying.
