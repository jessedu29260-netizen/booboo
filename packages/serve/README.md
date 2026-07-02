# @booboo/serve

Query a [Booboo](../../README.md) snapshot over **REST** and **MCP**. One in-memory index
(`BoobooIndex`) powers both: search, neighbours, shortest-path, layer stats. Read-only.

## REST

```bash
booboo serve --snapshot my.booboo.json --port 8787
```

| Route | Returns |
|-------|---------|
| `GET /graph` | meta + counts |
| `GET /stats` | `{ nodes, links, byLayer }` |
| `GET /search?q=&limit=` | ranked nodes (exact > prefix > substring) |
| `GET /nodes?layer=&cluster=&type=&q=&limit=&offset=` | `{ total, nodes }` |
| `GET /nodes/:id` | one node (404 if missing) |
| `GET /neighbors/:id?depth=&limit=` | `{ center, nodes, links }` |
| `GET /path/:from/:to` | `{ path }` (chain of nodes, or `null`) |

CORS is open, so a browser viewer can fetch a live graph directly.

## MCP

```bash
booboo mcp --snapshot my.booboo.json
```

Speaks MCP over stdio. Point any client at it (Claude Desktop / Claude Code):

```json
{ "mcpServers": { "booboo": { "command": "booboo", "args": ["mcp", "--snapshot", "/abs/path/my.booboo.json"] } } }
```

Tools: `booboo_stats` · `booboo_search` · `booboo_node` · `booboo_neighbors` · `booboo_path`.

## API

```ts
import { BoobooIndex, loadSnapshot, createRestServer, runMcp } from "@booboo/serve";

const ix = new BoobooIndex(loadSnapshot("my.booboo.json"));
ix.search("invoice");           // ranked nodes
ix.neighbors("dionisos", 2);    // 2-hop neighbourhood
ix.path("a", "b");              // shortest path or null
createRestServer(ix).listen(8787);
```

`BoobooIndex` is pure (no Node/network deps), so it also runs in the browser.
