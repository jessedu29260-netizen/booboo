# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for a
vulnerability.

- Preferred: open a **GitHub Security Advisory** on this repository
  (Security → Advisories → *Report a vulnerability*).
- Alternatively: **security contact — see repo owner / GitHub Security
  Advisories** on the repository.

Please include a minimal reproduction (a config + snapshot that triggers the
issue) and the affected package(s) and version(s). We aim to acknowledge a
report and confirm next steps as soon as we can.

## Scope

In scope: the packages in this monorepo — `@booboo-brain/spec`,
`@booboo-brain/build`, `@booboo-brain/serve`, `@booboo-brain/viewer`,
`@booboo-brain/panel`, `@booboo-brain/cli`, and `create-booboo`.

Particular areas of interest:

- The **REST + MCP serve layer** (`@booboo-brain/serve`) — request handling,
  path traversal, auth/allowlist behavior.
- **Privacy walls** — walled (`cluster` / `wall_field`) data must never be
  serialized into the JSON, API, viewer, or MCP output. A wall bypass is a
  security issue.
- The **build adapters** (`@booboo-brain/build`) — SQL/connection handling for
  the postgres source.

Out of scope: vulnerabilities in third-party dependencies (report those
upstream), and issues that require a machine already fully compromised.

## Secrets

Secrets are **never committed** to this repository. Connection strings and
credentials are supplied via environment variables only (e.g. `${DATABASE_URL}`);
example configs contain placeholders, not real values. If you believe a secret
was committed, report it privately via the channel above rather than opening a
public issue.
