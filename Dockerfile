# Booboo MCP server — containerized for registry checks (Glama) and quick trials.
# Installs the published CLI from npm and serves the bundled demo snapshot over
# stdio MCP. To use your own brain, mount a snapshot over /data/brain.json:
#   docker run -i -v ./my.booboo.json:/data/brain.json booboo
FROM node:22-slim
WORKDIR /app
RUN npm install -g @booboo-brain/cli
COPY examples/demo.booboo.json /data/brain.json
CMD ["booboo", "mcp", "--snapshot", "/data/brain.json"]
