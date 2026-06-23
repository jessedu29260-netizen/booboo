import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { BoobooIndex } from "./graph.js";

const j = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });

/** Expose the query index as an MCP server over stdio, so any AI client (Claude, etc.) can
 *  query the brain: stats → search → node → neighbours → path. */
export async function runMcp(ix: BoobooIndex, name = "booboo"): Promise<void> {
  const server = new McpServer({ name, version: "1.0.0" });

  server.tool("booboo_stats", "Node/link counts for the whole graph, broken down by layer.", {}, async () => j(ix.counts()));

  server.tool(
    "booboo_search",
    "Search nodes by label or id (ranked: exact > prefix > substring). Use this first to find a node's id.",
    { query: z.string().describe("text to match in a node's label or id"), limit: z.number().optional() },
    async ({ query, limit }) => j(ix.search(query, limit ?? 20)),
  );

  server.tool("booboo_node", "Fetch a single node (all fields + data) by its exact id.", { id: z.string() }, async ({ id }) => j(ix.node(id)));

  server.tool(
    "booboo_neighbors",
    "The neighbourhood around a node: connected nodes + links out to `depth` hops.",
    { id: z.string(), depth: z.number().optional(), limit: z.number().optional() },
    async ({ id, depth, limit }) => j(ix.neighbors(id, depth ?? 1, limit ?? 200)),
  );

  server.tool(
    "booboo_path",
    "Shortest path (chain of nodes) between two node ids; null if unreachable.",
    { from: z.string(), to: z.string() },
    async ({ from, to }) => j(ix.path(from, to)),
  );

  await server.connect(new StdioServerTransport());
}
