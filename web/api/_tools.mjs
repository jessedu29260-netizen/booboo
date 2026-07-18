/* The read-only tool set of the hosted demo — names, descriptions, input schemas
 * and result shapes replicate packages/serve/src/mcp.ts exactly, so the hosted
 * endpoint answers identically to `booboo mcp` running locally. The write half
 * (booboo_remember / booboo_report) is deliberately absent: the demo is read-only. */
import { z } from "zod";
import { orgBootSlice } from "./_index.mjs";

const j = (v) => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }] });

/** Register the read-only Booboo tools on an McpServer (or anything with .tool()). */
export function registerTools(server, ix, org) {
  if (org) {
    server.tool(
      "booboo_boot",
      "An agent's boot slice of the organigram: who it is, its authority chain, INHERITED rules (ancestors first), bucket access, skills, and children. Call this first, every session.",
      { agent: z.string().describe("the agent's id in the organigram") },
      async ({ agent }) => {
        const slice = orgBootSlice(org, agent);
        return slice ? j(slice) : j({ error: `no agent '${agent}' in the organigram`, agents: org.agents.map((a) => a.id) });
      },
    );
    server.tool("booboo_org", "The full organigram: every agent, the hierarchy, buckets and rule refs.", {}, async () => j(org));
  }

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
    { from: z.string(), to: z.string(), maxHops: z.number().int().min(1).max(1000).optional().describe("max BFS hops (default 64)") },
    async ({ from, to, maxHops }) => j(ix.path(from, to, maxHops ?? 64)),
  );
}
