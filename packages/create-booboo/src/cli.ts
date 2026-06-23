#!/usr/bin/env node
// create-booboo — scaffold a runnable Booboo brain (config + sample data + wired scripts).
// Zero dependencies; pure stdlib. `npx create-booboo my-brain [--force]`.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const BOOBOO_VERSION = "^0.1.0"; // @booboo/* range the scaffolded project depends on

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const dirArg = args.find((a) => !a.startsWith("--")) ?? "my-brain";
const force = flags.has("--force");

if (flags.has("--help") || flags.has("-h")) {
  console.log("usage: npx create-booboo <dir> [--force]\n  scaffolds a runnable Booboo brain (json starter + postgres upgrade path)");
  process.exit(0);
}

const dir = path.resolve(process.cwd(), dirArg);
const name = path.basename(dir);
const TITLE = name.replace(/[-_]/g, " ").toUpperCase();

if (existsSync(dir) && readdirSync(dir).length && !force) {
  console.error(`✗ "${dirArg}" exists and is not empty — pass --force to scaffold anyway.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const configYaml = `# ${name} — Booboo build config. Docs: SPEC.md + CONFIG.md in the booboo repo.
title: "${TITLE}"
root: { id: core, type: root, label: "${TITLE}" }

# The stacked planes (Z-order = array order). Use whatever layers fit YOUR system.
layers:
  - { name: agents,    color: "#c9a04a", label: "AGENTS" }
  - { name: knowledge, color: "#4ECDC4", label: "KNOWLEDGE" }
  - { name: memory,    color: "#a78bd0", label: "MEMORY" }

# Namespaces that must NEVER be emitted (filtered in the builder, before JSON/API/MCP).
walls: [private, sealed]

sources:
  # 1) JSON starter — works immediately, no database. Edit data.booboo.json.
  - adapter: json
    path: ./data.booboo.json

  # 2) Your real data — uncomment and point at a Postgres/Supabase DB.
  #    Each \`nodes\` entry maps a table → a layer; \`weight_from\` reads a numeric column.
  # - adapter: postgres
  #   url: \${DATABASE_URL}            # postgres://… (read from the environment)
  #   nodes:
  #     - { table: agents,       layer: agents,    id: slug, label: name, parent: core, weight: 0.6 }
  #     - { table: observations, layer: memory,    id: id,   label: title, cluster: project }
  #     - { table: kg_entities,  layer: knowledge, id: id,   label: name, weight_from: degree }
  #   links:
  #     - { table: edges, source: src, target: dst, type: rel }

output:
  snapshot: ./brain.json
`;

const dataJson = JSON.stringify(
  {
    booboo: "1.0",
    meta: {
      root: "core",
      title: "Sample Brain",
      layers: [
        { name: "agents", color: "#c9a04a", label: "AGENTS" },
        { name: "knowledge", color: "#4ECDC4", label: "KNOWLEDGE" },
        { name: "memory", color: "#a78bd0", label: "MEMORY" },
      ],
    },
    nodes: [
      { id: "agent:writer", type: "agent", layer: "agents", label: "Writer", weight: 0.6, tier: 1, parent: "core", icon: "✍", data: { role: "drafts content" } },
      { id: "agent:researcher", type: "agent", layer: "agents", label: "Researcher", weight: 0.6, tier: 1, parent: "core", icon: "🔎", data: { role: "gathers sources" } },
      { id: "kb:spec", type: "entity", layer: "knowledge", label: "Spec", weight: 0.4, tier: 2, parent: "core" },
      { id: "kb:brand", type: "entity", layer: "knowledge", label: "Brand", weight: 0.4, tier: 2, parent: "core" },
      { id: "mem:1", type: "memory", layer: "memory", label: "shipped v1", weight: 0.2, tier: 3, parent: "agent:writer" },
      { id: "mem:2", type: "memory", layer: "memory", label: "found source", weight: 0.2, tier: 3, parent: "agent:researcher" },
    ],
    links: [
      { source: "agent:writer", target: "kb:spec", type: "uses" },
      { source: "agent:researcher", target: "kb:brand", type: "uses" },
    ],
  },
  null,
  2,
);

const pkgJson = JSON.stringify(
  {
    name,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      build: "booboo build",
      serve: "booboo-serve rest --snapshot brain.json --port 8787",
      mcp: "booboo-serve mcp --snapshot brain.json",
    },
    dependencies: {
      "@booboo/build": BOOBOO_VERSION,
      "@booboo/serve": BOOBOO_VERSION,
    },
  },
  null,
  2,
);

const readme = `# ${name} — a Booboo brain

A rooted, queryable graph of your system, built with [Booboo](https://github.com/) (the unified operational brain).

## Quickstart

\`\`\`bash
npm install
npm run build      # booboo.config.yaml → brain.json (the snapshot)
npm run serve      # REST API at http://localhost:8787  (/graph /stats /search /nodes/:id /neighbors/:id /path/:a/:b)
npm run mcp        # MCP over stdio — point Claude / Cursor / Claude Code at it
\`\`\`

## Make it yours

1. Edit **booboo.config.yaml** — declare your \`layers\`, then add \`sources\`.
2. Start from the JSON file (**data.booboo.json**), or uncomment the **postgres** source
   to build straight from your own database. Set \`DATABASE_URL\` in your environment.
3. \`npm run build\` again. The snapshot \`brain.json\` is what gets served.

> **Privacy:** anything whose \`cluster\` is in \`walls:\` is filtered *before* emit — sealed data never reaches the snapshot, API, or MCP.

## MCP

\`npm run mcp\` exposes \`booboo_stats · booboo_search · booboo_node · booboo_neighbors · booboo_path\`
so an AI client can query the brain. See the Booboo repo for client config.
`;

const gitignore = `node_modules/
# the built snapshot can contain real/private data — don't commit it
brain.json
*.log
`;

const files: Record<string, string> = {
  "booboo.config.yaml": configYaml,
  "data.booboo.json": dataJson,
  "package.json": pkgJson,
  "README.md": readme,
  ".gitignore": gitignore,
};
for (const [f, content] of Object.entries(files)) writeFileSync(path.join(dir, f), content, "utf8");

console.log(`\n🐾 Booboo brain scaffolded → ${dirArg}/\n`);
console.log("Next steps:");
console.log(`  cd ${dirArg}`);
console.log("  npm install");
console.log("  npm run build      # build the graph snapshot");
console.log("  npm run serve      # REST API on http://localhost:8787");
console.log("  npm run mcp        # MCP over stdio (Claude / Cursor / Claude Code)\n");
console.log("Then edit booboo.config.yaml to point at your own data — a postgres example is included.\n");
