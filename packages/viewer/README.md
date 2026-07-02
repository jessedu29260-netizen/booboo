# @booboo/viewer

The [Booboo](https://github.com/jessedu29260-netizen/booboo) 3D renderer — a scale-first
React Three Fiber component that draws any Booboo graph as a rooted, tiered brain. One GPU
point field + tier-LOD, so a million nodes stay at 60fps (see
[SCALE.md](https://github.com/jessedu29260-netizen/booboo/blob/main/SCALE.md)).

## Install

```bash
npm install @booboo/viewer react react-dom
```

## Use

```tsx
import { BoobooView } from "@booboo/viewer";
import type { BoobooGraph } from "@booboo/spec";

export function Brain({ graph }: { graph: BoobooGraph }) {
  return <BoobooView data={graph} />;
}
```

`BoobooView` is the full app shell (controls, node dossier, persisted settings); `Booboo`
is the bare scene if you bring your own chrome. `layout()` exposes the typed-array layout
pass, and `defaultCfg` / `BoobooCfg` type the visual knobs.

## No React app? No problem

```bash
booboo view --snapshot brain.json      # serves the prebuilt standalone app + opens your browser
booboo view --demo --nodes 1000000     # synthetic brain, no data needed
```

The package ships a prebuilt static app (`dist-app/`) that the
[`@booboo/cli`](../cli) `view` command serves directly. For monorepo hacking there's a
playground: `pnpm -F @booboo/viewer dev`, then open with `?n=1000000`.

Part of [Booboo](https://github.com/jessedu29260-netizen/booboo) — the unified operational brain. MIT.
