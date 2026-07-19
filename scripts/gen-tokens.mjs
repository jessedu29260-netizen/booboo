/* design/tokens.json is the single source (CRAFT rule zero). This generates the
   three consumers so a palette change is one edit, not three:

     design/tokens.json
       → packages/viewer/src/tokens.ts   (TS constants for the scene)
       → web/tokens.css                  (CSS custom properties for the site)
       → packages/panel/app/tokens.css   (same, for the staff board)

   Run: node scripts/gen-tokens.mjs   (also runs inside scripts/build-web.mjs)
   Generated files carry a banner and must never be hand-edited. */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const t = JSON.parse(await readFile(path.join(root, "design", "tokens.json"), "utf8"));

const BANNER = "GENERATED from design/tokens.json by scripts/gen-tokens.mjs — DO NOT EDIT";
const hex = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, typeof v === "string" ? v : v.value]));

const color = hex(t.color);
const verb = hex(t.verb);
const band = Object.fromEntries(Object.entries(t.band).filter(([k]) => !k.startsWith("$")));

// ── viewer: TS constants ───────────────────────────────────────────────────
const ts = `// ${BANNER}
export const COLOR = ${JSON.stringify(color, null, 2)} as const;

/** Verb → colour. One relation, one hue, on every surface. */
export const VERB_COLOR: Record<string, string> = ${JSON.stringify({ ...verb, tether: verb.spine }, null, 2)};

/** Ranked alarm states — luminance rank 1 (CRAFT §1). Worst first. */
export const FLAG_ORDER = ${JSON.stringify(["critical", "overdue", "stale", "orphan"])} as const;
export type FlagKind = (typeof FLAG_ORDER)[number];
export const FLAG_COLOR: Record<FlagKind, string> = {
  critical: "${color.red}",
  overdue: "${color.amber}",
  stale: "${color.gold}",
  orphan: "${color.dim}",
};

/** Per-band rim/disc/label, keyed by the Pemberton band names. */
export const BAND = ${JSON.stringify(band, null, 2)} as const;

export const EASING = ${JSON.stringify(t.motion.easing, null, 2)} as const;
export const DURATION = ${JSON.stringify(t.motion.duration, null, 2)} as const;
export const Z = ${JSON.stringify(t.z, null, 2)} as const;
`;
await writeFile(path.join(root, "packages", "viewer", "src", "tokens.ts"), ts);

// ── site + panel: CSS custom properties ────────────────────────────────────
const css = `/* ${BANNER} */
:root {
${Object.entries(color).map(([k, v]) => `  --${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}: ${v};`).join("\n")}
${Object.entries(verb).map(([k, v]) => `  --verb-${k.replace(/_/g, "-")}: ${v};`).join("\n")}
  --display: ${t.type.display};
  --ui: ${t.type.ui};
  --mono: ${t.type.mono};
  --ease-swift: ${t.motion.easing.swift};
  --ease-settle: ${t.motion.easing.settle};
${Object.entries(t.z).map(([k, v]) => `  --z-${k}: ${v};`).join("\n")}
}
`;
await writeFile(path.join(root, "web", "tokens.css"), css);
await writeFile(path.join(root, "packages", "panel", "app", "tokens.css"), css);

console.log(`✓ tokens → viewer/src/tokens.ts · web/tokens.css · panel/app/tokens.css`);
