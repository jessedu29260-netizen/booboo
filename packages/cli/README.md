# @booboo/cli

The one command. `booboo` dispatches to four subcommands, each lazy-loaded so a
build-only run never pulls the server or the viewer.

```bash
booboo build  --config booboo.config.yaml          # any postgres/json → one graph snapshot
booboo serve  --snapshot brain.json --port 8787    # REST: /graph /stats /search /nodes /neighbors /path
booboo mcp    --snapshot brain.json                # MCP over stdio (Claude / Cursor / Claude Code)
booboo view   --snapshot brain.json                # 3D viewer in your browser
booboo view   --demo --nodes 100000                # a synthetic brain, no data needed
```

`build` runs [`@booboo/build`](../build); `serve` and `mcp` run [`@booboo/serve`](../serve);
`view` serves the prebuilt [`@booboo/viewer`](../viewer) app. Install this one package to
get the `booboo` command — it brings all of them in.

Part of [Booboo](https://github.com/jessedu29260-netizen/booboo) — the unified operational brain. MIT.
