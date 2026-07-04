# Changelog

All notable changes to Booboo are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Booboo is a pnpm monorepo; **per-package versions live in each package's
`package.json`** (and on npm). This file tracks repo-wide, cross-package notes —
it is not a single version line.

## [Unreleased]

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

### Docs

- REST/MCP surface in `BLUEPRINT.md` split into **Shipped today** vs
  **Target / roadmap** so no route/tool is claimed that isn't built.
- README + `CONTRIBUTING.md` reconciled to **seven published packages**
  (`@booboo-brain/panel` is real, not "imminent").
- `docs/TROUBLESHOOTING.md` install + viewer guidance updated to the shipped
  `npx create-booboo` / `booboo view` flow.
