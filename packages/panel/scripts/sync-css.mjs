// Regenerates src/panel-css.ts from app/panel.css (the stated master).
// Run after editing app/panel.css: node scripts/sync-css.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(path.join(root, "app", "panel.css"), "utf8");
if (css.includes("`") || css.includes("${")) {
  console.error("panel.css contains ` or ${ — String.raw would break; escape first");
  process.exit(1);
}
const header =
  "// GENERATED from app/panel.css — the panel carries its own styles so a host\n" +
  "// needs no separate import. Kept as a plain string constant (no CSS import) so\n" +
  "// the tsup library build stays clean. Edit app/panel.css, then run\n" +
  "// scripts/sync-css.mjs to re-sync (manual copies drift — this one did).\n" +
  "export const PANEL_CSS = String.raw`\n";
writeFileSync(path.join(root, "src", "panel-css.ts"), header + css + "`;\n");
console.log(`synced ${css.length} chars app/panel.css → src/panel-css.ts`);
