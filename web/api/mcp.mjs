/* The hosted ASK endpoint — a read-only Streamable-HTTP MCP function serving the
 * Pemberton demo brain at /api/mcp on the demo site.
 *
 * Connector URL:  https://booboo-black.vercel.app/api/mcp  (also rewritten from /mcp)
 *
 * Design notes:
 * - No auth anywhere, ever — claude.ai treats a 401 as "needs OAuth" and the
 *   connector flow dies. Every error path here is 4xx/5xx, never 401.
 * - Stateless MCP (sessionIdGenerator: undefined): each POST is self-contained,
 *   so it works on serverless where consecutive requests may hit different
 *   instances. A fresh McpServer + transport per request keeps concurrent
 *   requests on one warm instance (Vercel fluid compute) from sharing transport
 *   state; the expensive part — parsing the 897KB snapshot and building the
 *   index — happens once per cold start at module scope, read-only thereafter.
 * - enableJsonResponse: plain JSON replies instead of one-shot SSE streams;
 *   simpler + cheaper on serverless, and spec-compliant for Streamable HTTP.
 * - The snapshot + organigram live in ./_data/ (copied there by
 *   scripts/build-web.mjs). readFileSync(new URL(...)) is a pattern @vercel/nft
 *   traces, and web/dist/vercel.json includeFiles doubles the guarantee.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { BoobooIndex } from "./_index.mjs";
import { registerTools } from "./_tools.mjs";

const read = (f) => JSON.parse(readFileSync(new URL(`./_data/${f}`, import.meta.url), "utf8"));
const graph = read("pemberton.booboo.json");
const org = read("org.pemberton.booboo.json");
const ix = new BoobooIndex(graph);

async function handler(request) {
  // GET would open a standalone SSE stream that hangs the invocation until
  // maxDuration; stateless servers have no server-push, so per spec we 405 it
  // (same as mcp-handler without Redis). Never 401 — see above.
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method Not Allowed: POST JSON-RPC to this endpoint (stateless Streamable HTTP; no server-push stream)" }, id: null }),
      { status: 405, headers: { "content-type": "application/json", allow: "POST, DELETE" } },
    );
  }
  // same serverInfo as the local CLI: runMcp(ix, "booboo", …)
  const server = new McpServer({ name: "booboo", version: "1.0.0" });
  registerTools(server, ix, org);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handler as GET, handler as POST, handler as DELETE };
