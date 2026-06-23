# Booboo troubleshooting

Symptom → cause → fix. Grounded in how the build/serve/MCP layers actually behave.

## Install & setup

**`npm install` fails — `@booboo/build` / `@booboo/serve` not found (404).**
The packages aren't on the public npm registry yet (pre-release). Until they're published, run from the cloned monorepo (`pnpm install` at the repo root) rather than a scaffolded project, or link the local packages. A scaffolded `create-booboo` project becomes installable once the registry publish lands.

**`booboo: command not found` after install.**
The CLIs are package bins: `booboo` (from `@booboo/build`) and `booboo-serve` (from `@booboo/serve`). Run them via your project's npm scripts (`npm run build` / `npm run serve`) or with `npx booboo` / `npx booboo-serve`.

## Build (`booboo build`)

**`invalid graph: meta.root is required`.**
Your config has no `root.id` (or a typo). Every config needs `root: { id: <something> }`.

**It printed counts but wrote no file.**
`output.snapshot` isn't set. Add `output: { snapshot: ./brain.json }`. Paths are relative to the **config file's** directory, not your shell's cwd.

**`output.db_table` did nothing.**
That option is declared in the config type but **not implemented yet** — the builder only writes `output.snapshot`. Serve from the snapshot file.

**Some links are missing / fewer links than rows in my edge table.**
Dangling links (an endpoint id that doesn't match any node id) are dropped silently. The usual cause: you set `prefix:` on nodes (e.g. `agent:`) but the links table stores raw ids. Link `source`/`target` must equal the **final, prefixed** node id. Either prefix the link columns too, or drop the node `prefix`.

**Nodes show up with no colour / on the wrong plane in the viewer.**
Their `layer` isn't declared in `layers[]`. Declare every layer your nodes use. (When you provide a JSON source *and* declare your own `layers`, the source's extra layers are **not** auto-merged.)

**Rows vanished from the output.**
Privacy `walls`: any node whose `cluster` value is in `walls:` is filtered before emit (by design). Also note dedup — duplicate ids collapse to the first occurrence.

## Postgres source

**Connection / SSL errors against Supabase or Neon.**
Use the pooled `postgres://…` URL; URL-encode special characters in the password. Remote connections use `ssl: { rejectUnauthorized: false }` (works with managed poolers); strict cert validation isn't configurable yet.

**`relation "x" does not exist`.**
Use the schema-qualified table name (e.g. `public.my_table`). `table` and `where` are interpolated as raw SQL — they must be valid as written.

**`weight_from` produced weird sizes.**
That column must be numeric; values are normalised 0..1 across the returned rows (max → 1). Non-numeric values read as 0.

## Serve — REST (`booboo-serve rest`)

**`EADDRINUSE`.** The port is taken. Pass `--port <n>` (default 8787).

**Browser fetch is blocked by CORS.** It shouldn't be — the server sends `access-control-allow-origin: *`. If you proxy it, preserve that header.

**404 with a `routes` list.** You hit an unknown path. Valid: `/graph`, `/stats`, `/search?q=`, `/nodes`, `/nodes/:id`, `/neighbors/:id`, `/path/:from/:to`.

## Serve — MCP (`booboo-serve mcp`)

**The MCP client sees nothing / "not valid JSON".**
MCP speaks JSON-RPC on **stdout**; only stderr may carry human logs (the server already follows this). Don't pipe other output into stdout. Make sure you launched `mcp` mode, not `rest`. Tools exposed: `booboo_stats`, `booboo_search`, `booboo_node`, `booboo_neighbors`, `booboo_path`.

## Viewer (the 3D brain)

**How do I actually see it today?**
The viewer is the `@booboo/viewer` React component (`<BoobooView data={graph} />`). In the repo, run the playground: `pnpm -F @booboo/viewer dev`, then open the local Vite URL. Load data with `?file=<url-to-a-snapshot>` or a synthetic graph with `?n=100000`. A standalone, scaffold-included viewer command is on the roadmap (see `LAUNCH_CHECKLIST.md`).

**Slow / janky on a big graph.** Drop the node count or use a machine with a real GPU; a weak-GPU 2D fallback is planned.

## Misc

**Git: "LF will be replaced by CRLF" on Windows.** Harmless line-ending normalisation.
