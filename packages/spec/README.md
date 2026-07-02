# @booboo/spec

The [Booboo](https://github.com/jessedu29260-netizen/booboo) graph contract — the tiny JSON
spec every adapter emits and every consumer reads. Types + a validator, zero runtime deps.

## Install

```bash
npm install @booboo/spec
```

## Use

```ts
import { validate, type BoobooGraph, type BNode, type BLink } from "@booboo/spec";

const graph: BoobooGraph = {
  booboo: "1.0",
  meta: { root: "core", title: "My System", layers: [{ name: "agents", color: "#c9a04a" }] },
  nodes: [{ id: "core", type: "root", layer: "agents", label: "CORE" }],
  links: [],
};

const { ok, errors, warnings } = validate(graph); // never throws
```

`validate` returns errors for missing required fields and warnings for dangling links /
unknown layers (the builder drops those). The full human-readable spec lives in
[SPEC.md](https://github.com/jessedu29260-netizen/booboo/blob/main/SPEC.md).

Part of [Booboo](https://github.com/jessedu29260-netizen/booboo) — the unified operational brain. MIT.
