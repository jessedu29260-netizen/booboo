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
