// Regenerates src/panel-css.ts from app/panel.css (the stated master).
// Run after editing app/panel.css: node scripts/sync-css.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// tokens.css FIRST. panel.css declares its semantic aliases (--ink, --accent…)
// in terms of the generated raw tokens (--wine, --brass…), and the panel ships
// its CSS as ONE injected <style> so a host needs no import — which means the
// raw tokens must travel in that same string. app/index.html never linked
// tokens.css, so the moment panel.css stopped hardcoding hex values the whole
// palette resolved to nothing and the board rendered as a grey wash.
const tokens = readFileSync(path.join(root, "app", "tokens.css"), "utf8");
const panel = readFileSync(path.join(root, "app", "panel.css"), "utf8");
const css = `${tokens}\n${panel}`;
if (css.includes("`") || css.includes("${")) {
  console.error("css contains ` or ${ — String.raw would break; escape first");
  process.exit(1);
}
// Fail loudly rather than ship a colourless board again: every var(--x) that
// panel.css consumes must be DEFINED somewhere in the bundled string.
const defined = new Set([...css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
// --h is the per-bucket hue, set inline by the buckets + reports screens (a
// bucket is a distinct store, so a hue there MEANS something; on the org chart
// it meant nothing but hash(id), which is why it is gone from the plates).
const setInline = new Set(["--h", "--d"]);
const missing = [...new Set([...panel.matchAll(/var\((--[a-zA-Z0-9-]+)\s*(,?)/g)]
  // var(--x, fallback) carries its own default and cannot resolve to nothing
  .filter((m) => m[2] !== ",")
  .map((m) => m[1]))]
  .filter((v) => !defined.has(v) && !setInline.has(v));
if (missing.length) {
  console.error(`panel.css consumes undefined custom properties: ${missing.join(", ")}`);
  process.exit(1);
}
const header =
  "// GENERATED — tokens.css + panel.css concatenated by scripts/sync-css.mjs.\n" +
  "// The panel carries its own styles (and its own tokens) so a host needs no\n" +
  "// separate import. Kept as a plain string constant (no CSS import) so the\n" +
  "// tsup library build stays clean. Edit app/panel.css or design/tokens.json,\n" +
  "// then run scripts/sync-css.mjs to re-sync (manual copies drift — this one did).\n" +
  "export const PANEL_CSS = String.raw`\n";
writeFileSync(path.join(root, "src", "panel-css.ts"), header + css + "`;\n");
console.log(`synced ${tokens.length} tokens + ${panel.length} panel → src/panel-css.ts (${defined.size} custom properties defined)`);
