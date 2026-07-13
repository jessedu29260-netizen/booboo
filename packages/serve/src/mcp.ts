import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { BOrg } from "@booboo-brain/spec";
import { orgBootSlice } from "@booboo-brain/spec";
import type { BoobooIndex } from "./graph.js";
import type { JournalWriter } from "./journal.js";

const j = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });

/** Expose the query index as an MCP server over stdio, so any AI client (Claude, etc.) can
 *  query the brain: stats → search → node → neighbours → path. With an org loaded,
 *  agents also BOOT from here (booboo_boot) — the organigram is the authority. With a
 *  `writer`, agents also WRITE (remember/report) — the live half of the memory system. */
export async function runMcp(ix: BoobooIndex, name = "booboo", org?: BOrg, writer?: JournalWriter): Promise<void> {
  const server = new McpServer({ name, version: "1.0.0" });

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

  // The WRITE half — the live memory system. Present unless the server is
  // read-only (BOOBOO_READONLY / --no-write). Writes append to the durable
  // journal beside the snapshot and are queryable the same session.
  if (writer) {
    server.tool(
      "booboo_remember",
      "Persist a memory to the brain — one durable, atomic fact/decision worth recalling later. Written to the append-only journal beside the snapshot; immediately queryable and survives every rebuild. Author `[[node-id]]` links inside the text where you know a connection.",
      {
        text: z.string().describe("the fact to remember — one atomic note, written for the next reader"),
        agent: z.string().optional().describe("the agent id this memory belongs to (roots it under that agent)"),
        kind: z.string().optional().describe("decision|bugfix|pattern|config|discovery|context… (free text)"),
        bucket: z.string().optional().describe("memory bucket — groups the note under an agent/topic (the node's cluster)"),
        title: z.string().optional().describe("short label; derived from the text if omitted"),
      },
      async (a) => {
        try {
          return j(writer.remember(a));
        } catch (e) {
          return j({ error: String((e as Error).message) });
        }
      },
    );
    server.tool(
      "booboo_report",
      "File a report — a plain-English summary of what an agent just closed. Lands on the panel's Reports timeline; durable and immediately queryable. Call this as the last act of a session.",
      {
        text: z.string().describe("plain-English summary of what was done"),
        agent: z.string().optional().describe("the agent id filing the report"),
        status: z.string().optional().describe("ok|warn|fail (default ok)"),
      },
      async (a) => {
        try {
          return j(writer.report(a));
        } catch (e) {
          return j({ error: String((e as Error).message) });
        }
      },
    );
  }

  await server.connect(new StdioServerTransport());
}
