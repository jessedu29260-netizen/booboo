/* Assembles the public site: the landing at /, the real viewer app at /viewer/.
   Run after `pnpm -F @booboo-brain/viewer build`, which produces dist-app/.
   The viewer's vite config uses base:"./" so it works from a subpath untouched. */

import { cp, rm, mkdir, readdir } from "node:fs/promises";
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

const listed = await readdir(out);
console.log(`✓ web/dist ready → ${listed.join(", ")}`);
