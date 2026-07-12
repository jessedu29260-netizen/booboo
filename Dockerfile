# Booboo MCP server — containerized for registry checks (Glama) and quick trials.
# Installs the published CLI from npm and serves the bundled demo snapshot over
# stdio MCP. To use your own brain, mount a snapshot over /data/brain.json:
#   docker run -i -v ./my.booboo.json:/data/brain.json booboo
FROM node:22-slim
WORKDIR /app
# Pin the CLI to an exact published version for reproducible builds.
# BUMP THIS on every @booboo-brain/cli release (keep in sync with packages/cli/package.json "version").
RUN npm install -g @booboo-brain/cli@0.4.0
COPY examples/demo.booboo.json /data/brain.json
# Drop root — the node:22-slim base ships a non-root "node" user.
USER node
CMD ["booboo", "mcp", "--snapshot", "/data/brain.json"]
