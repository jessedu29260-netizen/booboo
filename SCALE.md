# Booboo at scale — the million-node flex

The flagship demo isn't a toy dataset — it's a **fake-but-coherent industrial brain** generated on the fly, big enough to prove Booboo handles real-world memory volume. It's also the **forcing function**: the engine can't fake this, so building it makes the LOD/rendering genuinely industrial-grade (not deferred polish).

## The synthetic generator (`@booboo/demo`)

`booboo demo --nodes 1000000 [--seed 42]` procedurally builds a *plausible* mega-system, not random noise:

- **Org spine:** 1 root → ~12 divisions → ~120 teams → ~1,200 agents (the AGENTS layer).
- **Memory layer:** each agent accrues episodic observations — the bulk of the nodes (e.g. ~800k memories), clustered under their agent, Zipf-distributed in recency/weight, so the cloud looks *lived-in*.
- **Knowledge layer:** a power-law knowledge graph (~150k entities, hub-and-spoke) the agents reference.
- **Automations layer:** ~2k crons/jobs wired to their teams.
- Deterministic from `--seed` → reproducible screenshots; tunable `--nodes` from 10k to 5M.

Coherent hierarchy + clustering means it *reads* like a real system at scale, not a particle demo.

## Rendering it at 60fps (the honest engineering)

"Industrial grade" = smart LOD, **not** brute-forcing a million objects. The architecture (already proven in the Dionisos prototype, lifted into `@booboo/viewer`):

1. **One instanced GPU field.** The 99% of nodes that are small are a *single* `InstancedMesh` / point cloud — one draw call for the whole cloud. GPUs eat millions of instances; the CPU/React never touches per-node.
2. **Typed-array data path.** Positions/colors/weights live in flat `Float32Array`s, computed once. No per-node React components, no object-per-node.
3. **Tier-LOD.** Only top-tier nodes (hundreds) ever get labels, icons, or their own meshes. Everything else is field. Labels are culled by screen-space collision + distance.
4. **Frustum + distance culling** and **chunked/streamed generation** (generate in web-worker batches, or stream from the builder) so we never materialize a 500 MB JSON in one go.
5. **GPU picking** for clicks (read back the instance id under the cursor) instead of CPU hit-testing a million nodes.
6. **Weak-GPU fallback:** cap the field + drop to 2D when WebGL is thin, so it degrades instead of dying.

## Targets

| Nodes | Experience |
|---|---|
| 10k | instant, the default `--demo` |
| 250k | smooth, "this is big" |
| 1M | the headline — **a million-node brain at 60fps** |
| 5M | stress ceiling (instancing + streaming; for the brave) |

## The virtuous loop

This same LOD engine back-solves the Dionisos Atlas's own "full-118k live LOD" item — build it once here, bring it home. The mega-demo isn't a side quest; it's how the core renderer earns the word *industrial*.
