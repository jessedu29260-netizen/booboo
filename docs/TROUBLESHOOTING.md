# Booboo troubleshooting

Symptom → cause → fix. Grounded in how the build/serve/MCP layers actually behave.

## Install & setup

**`npm install` fails — `@booboo-brain/build` / `@booboo-brain/serve` not found (404).**
The packages are published under the `@booboo-brain` scope — check for a typo (e.g. the old `@booboo/…` scope, which doesn't exist). Scaffold a fresh project with `npx create-booboo my-brain` (`create-booboo` is unscoped), then `cd my-brain && npm install`. To add a package directly: `npm i @booboo-brain/serve`. A brand-new scope can take a few minutes to propagate on first publish — if a `GET` 404s right after a release, wait and retry rather than assuming it's unpublished.

**`booboo: command not found` after install.**
The CLI is one bin — `booboo` (from `@booboo-brain/cli`) — with subcommands `build` / `serve` / `mcp` / `view`. Run them via your project's npm scripts (`npm run build` / `npm run serve`) or with `npx booboo serve …`.

## Build (`booboo build`)

**`invalid graph: meta.root is required`.**
Your config has no `root.id` (or a typo). Every config needs `root: { id: <something> }`.

**It printed counts but wrote no file.**
`output.snapshot` isn't set. Add `output: { snapshot: ./brain.json }`. Paths are relative to the **config file's** directory, not your shell's cwd.

**Where's the DB output (`output.db_table`)?**
There isn't one — `output.snapshot` (a JSON file) is the only output target. A live single-row DB output is on the roadmap; serve from the snapshot for now.

**Some links are missing / fewer links than rows in my edge table.**
Dangling links (an endpoint id that doesn't match any node id) are dropped silently. The usual cause: you set `prefix:` on nodes (e.g. `agent:`) but the links table stores raw ids. Link `source`/`target` must equal the **final, prefixed** node id. Either prefix the link columns too, or drop the node `prefix`.

**Nodes show up with no colour / on the wrong plane in the viewer.**
Their `layer` isn't declared in `layers[]`. Declare every layer your nodes use. (When you provide a JSON source *and* declare your own `layers`, the source's extra layers are **not** auto-merged.)

**Rows vanished from the output.**
Privacy `walls`: any node whose `cluster` value is in `walls:` is filtered before emit (by design). Also note dedup — duplicate ids collapse to the first occurrence.

## Postgres source

**Connection / SSL errors against Supabase or Neon.**
Use the pooled `postgres://…` URL; URL-encode special characters in the password. Remote connections verify the server certificate by default (`rejectUnauthorized: true`) — managed providers like Supabase/Neon present publicly-trusted certs, so this works out of the box. If you're connecting to a self-signed/internal Postgres and hit a cert error, set `BOOBOO_PG_INSECURE_TLS=1` to skip verification — this only disables identity checking (TLS still encrypts the connection), so only use it on a network you trust.

**`relation "x" does not exist`.**
Use the schema-qualified table name (e.g. `public.my_table`). `table` and `where` are interpolated as raw SQL — they must be valid as written.

**`weight_from` produced weird sizes.**
That column must be numeric; values are normalised 0..1 across the returned rows (max → 1). Non-numeric values read as 0.

## Serve — REST (`booboo serve`)

**`EADDRINUSE`.** The port is taken. Pass `--port <n>` (default 8787).

**Browser fetch is blocked by CORS.** It shouldn't be — the server sends `access-control-allow-origin: *`. If you proxy it, preserve that header.

**404 with a `routes` list.** You hit an unknown path. Valid: `/graph`, `/stats`, `/search?q=`, `/nodes`, `/nodes/:id`, `/neighbors/:id`, `/path/:from/:to`.

## Serve — MCP (`booboo mcp`)

**The MCP client sees nothing / "not valid JSON".**
MCP speaks JSON-RPC on **stdout**; only stderr may carry human logs (the server already follows this). Don't pipe other output into stdout. Make sure you launched `mcp` mode, not `rest`. Tools exposed: `booboo_stats`, `booboo_search`, `booboo_node`, `booboo_neighbors`, `booboo_path`.

## Viewer (the 3D brain)

**How do I actually see it today?**
`booboo view --snapshot my.booboo.json` serves the `@booboo-brain/viewer` static app + your snapshot locally and opens the browser — no monorepo, no build step. Use `--demo [--nodes N]` for a no-data synthetic brain (e.g. `booboo view --demo --nodes 50000`). The scaffold wires it as `npm run view`. You can also embed the `<BoobooView data={graph} />` React component directly, or run the viewer playground in the repo: `pnpm -F @booboo-brain/viewer dev`, then open with `?file=<url-to-a-snapshot>` or `?n=100000`.

**Slow / janky on a big graph.** Drop the node count or use a machine with a real GPU; a weak-GPU 2D fallback is planned.

## Misc

**Git: "LF will be replaced by CRLF" on Windows.** Harmless line-ending normalisation.

## `booboo: Invalid URL` on a postgres source

Your database password probably contains URL-special characters (`$ # ! @ &`…).
Since v0.1.1 the build auto-percent-encodes the password segment for you (you'll
see a one-line notice on stderr). On older versions, encode the password yourself:
`encodeURIComponent("p@ss#word")` → paste the result into the connection string.
