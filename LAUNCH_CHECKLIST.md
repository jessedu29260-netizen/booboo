# Booboo — public launch checklist

> The gate. Booboo does **not** go public (GitHub public / npm publish / any marketing) until every **P0** below is resolved and the Go-live gate passes. Grounded in a real audit + run of the code on 2026-06-23. Status: ☐ todo · ◐ in progress · ☑ done.

## Status at a glance
- **What works (verified):** `booboo build` (json + config), `booboo-serve rest` (all routes), MCP server compiles + tests pass, `create-booboo` scaffolds a project that builds + serves. `pnpm build` + `pnpm test` (9/9) green.
- **What blocks public:** nothing is published to npm, so the advertised `npx` flow can't install; the README/SCALE promise UX that doesn't exist yet; the 3D viewer (the headline) isn't reachable by an end user; repo isn't public.

---

## P0 — blockers (must clear before public)

- ☐ **P0.1 · npm publish chain.** All packages are `version: 0.0.0`; `create-booboo` depends on `@booboo/* ^0.1.0` which isn't published → a scaffolded project's `npm install` 404s. **Do:** claim the `@booboo` npm org, bump every package to `0.1.0`, publish in order `spec → build → serve → viewer → create-booboo`, then re-test the npx flow from a clean machine.
- ☐ **P0.2 · Docs match reality (no vaporware).** README/SCALE advertise a unified `booboo serve` (3D viewer :3000 + `/api` + MCP in one command), `npx create-booboo --demo --nodes 1000000`, and a `booboo demo` generator — **none exist**. ◐ README reconciled this pass; SCALE.md still needs it. **Do:** finish reconciling SCALE.md; either build the unified UX or keep it labelled Roadmap.
- ☐ **P0.3 · End-user viewer path.** The 3D render — the entire selling point — is only reachable via the repo's Vite playground. A `create-booboo` project has no way to see its brain in 3D. **Do:** ship a viewer story end users can run (a `booboo view`/static-host command, or a documented hosted viewer), and wire it into the scaffold.
- ☐ **P0.4 · Repo public + pushed.** No GitHub remote yet (Jesse-gated). **Do:** create the public repo, push `main`. *(BOOBOO-PIVOT-06 step d.)*
- ☐ **P0.5 · Final pre-publish secret/scan.** Confirm no secrets in history (examples use `${DATABASE_URL}` ✅ — verified clean) and decide on the `examples/dionisos.config.yaml` real-schema exposure (keep as a "proven on a real system" demo, or genericise).

## P1 — correctness issues found in the audit

- ☑ **P1.1 · Layer union — fixed (2026-06-23).** `build` now unions every node's layer into `meta.layers` (auto-adds any missing layer + warns on stderr).
- ☑ **P1.2 · `output.db_table` removed (2026-06-23).** Was declared-but-unimplemented; dropped from the config type + docs. A live single-row DB output is now a P5/roadmap feature (needs a proper `output.db_url` + schema).
- ☑ **P1.3 · Dangling-link drops now warned (2026-06-23).** `build` logs `dropped N dangling link(s)` to stderr (TROUBLESHOOTING covers the prefix foot-gun).
- ☑ **P1.4 · Postgres adapter verified live (2026-06-23).** Ran `examples/dionisos.config.yaml` against the real Dionisos Supabase (pooler `:6543`) → built 4,507 nodes (agents:11 · families:11 · memory:4,485) + 21 links, walls applied, clean. (A CI integration test against a throwaway DB is still nice-to-have — see P2.4.)
- ☐ **P1.5 · CLI shape decision.** Today: `booboo` (build) + `booboo-serve` (rest/mcp). README implies one `booboo` CLI. **Decide (Jesse):** unify under one `booboo <build|serve|mcp|view>` bin, or keep split + document. Lock it before publish (renaming bins post-publish is painful).

## P2 — packaging / OSS hygiene

- ☐ **P2.1 · Version bump** 0.0.0 → 0.1.0 across all 5 packages (paired with P0.1).
- ☐ **P2.2 · README status line** says "four packages" — now five (add `create-booboo`).
- ☐ **P2.3 · Per-package READMEs** present for every published package (build ✅, serve ✅; verify spec, viewer, create-booboo have one — npm shows it on the package page).
- ☐ **P2.4 · CI** — a GitHub Action running `pnpm build` + `pnpm test` on PRs (no `.github/` yet).
- ☐ **P2.5 · `create-booboo` smoke test** in CI (scaffold → build → assert snapshot).
- ☐ **P2.6 · Repo URL** — fill the placeholder `https://github.com/` links in README/scaffold once the repo exists.
- ☐ **P2.7 · `ssl: rejectUnauthorized:false`** — document the trade-off (done) and consider a `sslmode`/strict opt-in.
- ☐ **P2.8 · CONTRIBUTING.md + issue templates** (nice-to-have for an OSS launch).

## Deliverables — documentation

- ☑ **CONFIG reference** → `docs/CONFIG.md`
- ☑ **Troubleshooting** → `docs/TROUBLESHOOTING.md`
- ☑ **Spec** → `SPEC.md` · **Architecture/blueprint** → `BLUEPRINT.md` · **Scale story** → `SCALE.md` (needs P0.2 reconcile)
- ◐ **README** — install/usage reconciled to reality this pass; finish after P1.5 (CLI) + P0.3 (viewer) land
- ☐ **HOW_IT_WORKS** — covered by README "the one idea" + BLUEPRINT; expand to a standalone page only if needed
- ☐ **MCP client setup** — copy-paste config for Claude Desktop / Cursor / Claude Code

## "Config we sell" — parity

- ☐ The £29 AI Core Drop config + the done-for-you/hosted config must be the **same `booboo.config.yaml` schema** end users get from `create-booboo`. Keep one schema; the drop is a filled-in config + master prompt, not a fork. (Tracked with BOOBOO-PIVOT-04.)
- ☐ Troubleshooting + CONFIG docs are written against the **shipping** schema (done) and must be updated in lockstep if the schema changes.

---

## Go-live gate (all must be true)
1. Every **P0** ☑ and every **P1** ☑ (or consciously deferred with a written reason).
2. `npx create-booboo my-brain` on a **clean machine** → `npm install && npm run build && npm run serve` works from the **published** registry.
3. The postgres path is proven against a real database.
4. An end user can **see the 3D brain** without cloning the monorepo.
5. CI is green; docs contain no claim the code can't back up.
6. Jesse's explicit go on making the repo public.

## Order of operations
P1 fixes → docs reconcile (P0.2) → viewer path (P0.3) → CLI lock (P1.5) → version bump + CI (P2) → npm publish (P0.1) → clean-machine re-verify → **repo public (P0.4)** → marketing / the £29 drop.
