/* Assembles the public site: the landing at /, the real viewer app at /viewer/,
   and the hosted ASK endpoint (/api/mcp — a read-only Streamable-HTTP MCP function).
   Run after `pnpm -F @booboo-brain/viewer build`, which produces dist-app/.
   The viewer's vite config uses base:"./" so it works from a subpath untouched.
   web/dist is the DEPLOY ROOT (`vercel deploy web/dist`), so the function's
   package.json + vercel.json must live in web/dist, not the repo root. */

import { cp, rm, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "web", "dist");
const viewerApp = path.join(root, "packages", "viewer", "dist-app");

if (!existsSync(viewerApp)) {
  console.error(`✗ ${viewerApp} missing — run: pnpm -F @booboo-brain/viewer build`);
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const f of ["index.html", "styles.css", "main.js"]) {
  await cp(path.join(root, "web", f), path.join(out, f));
}
await cp(viewerApp, path.join(out, "viewer"), { recursive: true });
// the Pemberton demo brain — the default thing the site shows
await cp(path.join(root, "examples", "pemberton", "pemberton.booboo.json"), path.join(out, "pemberton.booboo.json"));

// ── the hosted ASK endpoint: /api/mcp (Vercel builds functions from api/ at the deploy root)
await cp(path.join(root, "web", "api"), path.join(out, "api"), { recursive: true });
await mkdir(path.join(out, "api", "_data"), { recursive: true });
for (const f of ["pemberton.booboo.json", "org.pemberton.booboo.json"]) {
  await cp(path.join(root, "examples", "pemberton", f), path.join(out, "api", "_data", f));
}
// deps for the function only — no "build" script, so Vercel skips the build step
// and just installs, serves the static files, and traces api/ into functions.
await writeFile(
  path.join(out, "package.json"),
  JSON.stringify(
    {
      name: "booboo-demo-site",
      private: true,
      type: "module",
      engines: { node: "22.x" },
      dependencies: { "@modelcontextprotocol/sdk": "1.29.0", zod: "3.25.76" },
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  path.join(out, "vercel.json"),
  JSON.stringify(
    {
      functions: { "api/mcp.mjs": { maxDuration: 60, includeFiles: "api/_data/**" } },
      rewrites: [{ source: "/mcp", destination: "/api/mcp" }],
    },
    null,
    2,
  ) + "\n",
);

const listed = await readdir(out);
console.log(`✓ web/dist ready → ${listed.join(", ")}`);
