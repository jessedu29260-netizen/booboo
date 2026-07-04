# MCP directory submissions — booboo

Status of getting `booboo mcp` listed across the MCP ecosystem. Prereq (done): the
README carries a copy-paste **Connect it to Claude / Cursor (MCP)** config block, install
steps, usage, and MIT license — every directory below wants exactly that.

Repo: `https://github.com/jessedu29260-netizen/booboo` · npm: `@booboo-brain/cli` (`booboo mcp`).

Every one of these needs Jesse's logged-in account or a PR under his name — none can be
fired autonomously. Do them in one guided pass (Claude drives Chrome; Jesse authenticates).

| # | Directory | How to submit | Needs | Status |
|---|-----------|---------------|-------|--------|
| 1 | **punkpeye/awesome-mcp-servers** | PR (already open) | GitHub | ✅ [PR #9087](https://github.com/punkpeye/awesome-mcp-servers/pull/9087) — OPEN, awaiting merge |
| 2 | **Glama.ai** | "Add server" form → GitHub OAuth, they verify repo admin + auto-index | GitHub login (repo owner) | ☐ TODO |
| 3 | **Smithery.ai** | `smithery mcp publish` CLI (add a `smithery.yaml` at that point) or web dashboard | Smithery account | ☐ TODO — write `smithery.yaml` when we do this |
| 4 | **mcp.so** | Community submit form (repo URL + description + tags) | Site account (likely) | ☐ TODO |
| 5 | **PulseMCP** | Web submission form | Site account (likely) | ☐ TODO |
| 6 | **modelcontextprotocol/servers** + official Registry | PR adding a YAML entry (name/description/repo/transport); the Registry ingests from there | GitHub | ☐ TODO — confirm current entry file before PR |

Notes:
- No `server.json` needed for any of these — Glama infers the schema from the repo, the
  official Registry uses the YAML PR. Only Smithery wants its own `smithery.yaml`, added
  when we run its CLI (kept out of the repo until then — nothing speculative).
- All six want the same thing that already exists: a clean public repo + README MCP block +
  npm package. The remaining work is purely the authenticated submit step per site.
- **2026-07-04 audit:** booboo is NOT live on Glama (search + direct slug both empty) — the
  Jul-3 submission never indexed; redo it first. PR #9087 carries the `missing-glama`
  label, so **Glama is the gate for the whole chain**. Order of the guided pass:
  Glama → (label clears / re-trigger) → Smithery → mcp.so → PulseMCP → official registry.

## Paste-ready copy (one guided pass — Claude drives, Jesse authenticates)

**Name:** Booboo
**Repo:** `https://github.com/jessedu29260-netizen/booboo`
**npm:** `@booboo-brain/cli` (+ spec/build/serve/viewer/panel, `create-booboo`)
**License:** MIT · TypeScript · runs locally, cross-platform

**One-liner (short fields):**
> Open-source operational brain — fuse your AI system's agents, memory, knowledge and automations into one rooted, privacy-walled graph served over MCP, with a million-node 3D viewer and a drag-drop organigram your agents boot from.

**Description (longer fields):**
> Booboo turns any AI system's data into one queryable brain: adapters (postgres/json) emit a tiny JSON spec; consumers render/serve it — 3D viewer (60fps at a million nodes), REST, MCP (stats · search · node dossiers · neighbors · pathfinding), and an editable org chart with per-agent contracts, memory buckets, reports and health lights. Privacy walls are applied before emit. MIT, local-first, `npx create-booboo` to scaffold.

**Tags:** knowledge-graph · memory · agents · visualization · orchestration

**MCP config (verbatim from README):**
```jsonc
{
  "mcpServers": {
    "booboo": {
      "command": "npx",
      "args": ["-y", "@booboo-brain/cli", "mcp",
               "--snapshot", "my.booboo.json", "--org", "org.booboo.json"]
    }
  }
}
```

**smithery.yaml draft (add to repo only when running the Smithery step):**
```yaml
startCommand:
  type: stdio
  commandFunction: |
    (config) => ({
      command: "npx",
      args: ["-y", "@booboo-brain/cli", "mcp", "--snapshot", config.snapshot, "--org", config.org]
    })
  configSchema:
    type: object
    required: [snapshot]
    properties:
      snapshot: { type: string, description: "Path to the booboo graph snapshot (my.booboo.json)" }
      org: { type: string, description: "Optional path to the org file (org.booboo.json)" }
```
