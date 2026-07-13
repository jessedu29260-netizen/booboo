# Changelog

All notable changes to Booboo are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Booboo is a pnpm monorepo; **per-package versions live in each package's
`package.json`** (and on npm). This file tracks repo-wide, cross-package notes —
it is not a single version line.

## [Unreleased]

### Added — the live memory system (write-back)

- **`booboo_remember` / `booboo_report`** MCP tools + **`POST /remember` · `/report`**
  REST routes: agents now WRITE durable memories and reports mid-session, not just
  read. (`@booboo-brain/serve` 0.4.0, `@booboo-brain/cli` 0.5.0, `create-booboo` 0.4.0.)
- **The journal** — writes append to `brain.journal.jsonl` beside the snapshot but
  *outside* it: `booboo build` rewrites `brain.json` and never touches the journal,
  so live memories **survive every rebuild**. `serve`/`mcp`/`panel` replay it at load,
  so a written memory is queryable the same session and shows on the panel's
  Reports/Buckets tabs next load. Append-only JSONL — atomic appends, a torn line is
  skipped not fatal.
- **Read-only posture** — `--no-write` / `BOOBOO_READONLY=1` omits the write tools
  and 403s the REST write routes (public/locked-down deployments); reads unaffected.
- **Scaffold cascade** — `create-booboo`'s `AGENTS.md` now teaches the live
  remember/report loop, and `.gitignore` protects the durable journal.

### Fixed / Hardened (audit pass)

- **Validation guards** — the spec validator errors on the hard requirements
  (`id`, `layer`, `meta.root`) and warns (rather than silently accepting) when
  the expected `type` / `label` fields are absent.
- **Weight normalization** — `weight_from` values are normalized to `0..1`
  correctly across the returned rows.
- **CLI `--version`** — `booboo --version` reports the CLI version.
- **Health timestamp** — the serve health/status output reports an accurate
  timestamp.
- **`publishConfig`** — packages carry `publishConfig` so scoped publishes go
  out public.
- **`wall_field`** — per-source privacy-wall field is honored by the build
  engine (walls applied before emit).
- **Viewer validation** — the viewer validates incoming graph data before
  rendering.
- **Serve auth** — `BOOBOO_TOKEN` bearer-token compare is now constant-time
  (was a plain `!==`, which leaks token length/prefix via timing).
- **Duplicate node ids** — `BoobooIndex` now throws when constructed
  directly with a graph containing duplicate node ids, instead of silently
  keeping the last one. `loadSnapshot()` already rejected these via
  `validate()`; this closes the same gap for direct construction.
- **Postgres TLS** — non-local connections now verify the server
  certificate by default (`rejectUnauthorized: true`); `BOOBOO_PG_INSECURE_TLS=1`
  is the explicit opt-in for self-signed/internal Postgres.
- **Viewer label length** — a single pathological node label (a multi-KB
  string with no whitespace) is now truncated before it reaches the DOM,
  instead of only capping how many labels render.
- **CI** — the smoke test now boots `serve`/`view`/`panel`/`mcp` and hits a
  real endpoint on each, not just the build pipeline.
- **Dockerfile** — pinned CLI version bumped to match the published `cli`
  package (was drifted one release behind).

### Docs

- REST/MCP surface in `BLUEPRINT.md` split into **Shipped today** vs
  **Target / roadmap** so no route/tool is claimed that isn't built.
- README + `CONTRIBUTING.md` reconciled to **seven published packages**
  (`@booboo-brain/panel` is real, not "imminent"). *(Superseded below —
  `@booboo-brain/vault` shipped after this note was written.)*
- `docs/TROUBLESHOOTING.md` install + viewer guidance updated to the shipped
  `npx create-booboo` / `booboo view` flow.
- README/CONTRIBUTING/BLUEPRINT package counts reconciled again to **eight
  published packages** — `@booboo-brain/vault` had shipped but wasn't
  reflected in the status line or `BLUEPRINT.md`'s package table (which was
  still listing only five, missing `cli`/`panel`/`vault` entirely).
