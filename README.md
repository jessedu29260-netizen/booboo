# 🐾 Booboo — the unified operational brain

> Turn any AI system's data into one living, rooted 3D brain — **structure + knowledge + memory + agents + automations** fused into a single graph. Query it by **REST or MCP**, view it in your **browser or as a desktop wallpaper**, and **boot your agents from it in one call**.

Named after a dachshund who never forgets where the treats are buried. Fitting, because Booboo is about exactly that: **memory and recall** — seeing the whole system at once, fetching what's buried, never losing the thread.

Most tools show you *one* slice: a knowledge graph, an agent flow chart, a memory store, a trace viewer. Booboo fuses all of them into **one graph rooted at a single point**, so you can see — and query — how the whole system actually hangs together.

> **Status:** alpha — four packages build green and are tested: `@booboo/spec` (the contract), `@booboo/viewer` (million-node 3D render), `@booboo/build` (config-driven postgres/json adapters), `@booboo/serve` (REST + MCP query layer). The `create-booboo` wizard and published npm releases are next (see `BLUEPRINT.md` → Roadmap). MIT.

---

## The one idea

Booboo is a tiny **JSON spec** at the center, with **adapters** that feed it and **consumers** that render/serve/query it:

```
  your data ──▶  ADAPTERS  ──▶  GRAPH JSON ──▶  CONSUMERS
  (postgres,     (config-       (the spec,       (3D viewer ·
   json, neo4j,   driven,        ~1 KB            REST API ·
   mcp, …)        ~50 lines)     contract)        MCP server · wallpaper)
```

Emit the JSON → get the viewer, the API, and the MCP server **for free**. Weird data → a ~50-line adapter, not a fork. See `SPEC.md`.

## Quickstart (target UX)

```bash
npx create-booboo my-brain       # wizard: pick a source (json / postgres / supabase), map layers
cd my-brain
booboo serve                     # builds the graph → 3D viewer :3000 + REST /api + MCP endpoint
```

Point any MCP client (Claude Desktop, Cursor, Claude Code) at `booboo mcp` and your agents can `boot · recall · resolve` the brain.

**Zero-setup demo** (no database, no signup):

```bash
npx create-booboo --demo                 # the sample brain
npx create-booboo --demo --nodes 1000000 # ...or a MILLION-node industrial brain at 60fps
```

> The headline flex: **Booboo renders a million-node brain at 60fps in your browser.** See `SCALE.md` for how (instanced GPU field + tier-LOD), and why a fake-but-coherent mega-graph is the forcing function that keeps the engine honest.

## What works today

```bash
booboo build --config booboo.config.yaml    # any postgres/json → one graph snapshot (privacy walls + parent spines)
booboo-serve rest --snapshot my.booboo.json --port 8787   # REST: /graph /stats /search /nodes/:id /neighbors/:id /path/:a/:b
booboo-serve mcp  --snapshot my.booboo.json               # MCP over stdio: booboo_stats/search/node/neighbors/path
```

`@booboo/viewer` renders any snapshot (or `?n=1000000` synthetic) in React. The build engine was
proven on a real **4,469-node production brain** assembled straight from Supabase by config alone —
privacy-walled, validated, served. See each package's README for the details.

## Why it's different

The closest things on GitHub each do *one* layer: `3d-force-graph` (rendering), Obsidian/Logseq (note graphs), LangGraph (agent flows), Graphiti/Cognee (agent memory). None fuse **wiring + knowledge + episodic memory + agents + crons** into one rooted, live, **bootable** brain that's simultaneously a view, a wallpaper, an API, and an MCP source. That operational fusion is the novel part.

## License

MIT — built to be forked, adapted, and shipped.
