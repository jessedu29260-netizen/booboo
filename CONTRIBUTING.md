# Contributing to Booboo

Thanks for helping the brain grow. Booboo is a pnpm monorepo of six small packages — the
fastest way to contribute is to keep changes small and verified.

## Dev setup

```bash
git clone https://github.com/jessedu29260-netizen/booboo.git
cd booboo
pnpm install
pnpm build          # builds all packages (tsup + the viewer's static app)
pnpm test           # vitest across the workspace
```

Requires Node >= 18 and [pnpm](https://pnpm.io) (version pinned in `package.json`).

Useful during development:

```bash
pnpm -F @booboo/build test          # test one package
pnpm -F @booboo/viewer dev          # viewer playground (open with ?n=100000)
node packages/cli/dist/cli.js view --demo   # run the built CLI locally
```

## Project shape

| Package | What it is |
|---|---|
| `@booboo/spec` | the JSON graph contract + validator (zero deps) |
| `@booboo/build` | config-driven adapters (postgres, json) → snapshot |
| `@booboo/serve` | REST + MCP query layer over a snapshot |
| `@booboo/viewer` | the R3F 3D renderer + standalone app |
| `@booboo/cli` | the unified `booboo` bin: build / serve / mcp / view |
| `create-booboo` | project scaffolder (zero deps) |

`SPEC.md` is the contract; `BLUEPRINT.md` is the architecture; `docs/CONFIG.md` is the
config reference.

## Pull requests

- Keep PRs focused — one change per PR.
- `pnpm build` and `pnpm test` must pass (CI runs both plus a scaffold smoke test).
- New behaviour needs a test; changed behaviour needs the docs updated in the same PR
  (README, package README, or `docs/` — whichever describes it).
- No claims the code can't back up: if it isn't shipped, it's labelled *Roadmap*.

## Code style

Match what's already there:

- TypeScript, ESM only (`"type": "module"`), built with tsup, tested with vitest.
- Standard library before dependencies — `@booboo/spec` and `create-booboo` are zero-dep
  on purpose; keep them that way.
- Small files, comment the *why* at the top, not the what.
- The spec stays tiny. Additions to the graph contract need a strong reason.

## Reporting issues

Use the issue templates — a config + snapshot that reproduces the problem is worth a
thousand words. Never include real credentials or private snapshot data in an issue.
