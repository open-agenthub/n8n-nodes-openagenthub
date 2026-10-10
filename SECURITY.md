# Security policy

Report vulnerabilities privately using [GitHub private vulnerability reporting](https://github.com/open-agenthub/n8n-nodes-openagenthub/security/advisories/new). Do not include API tokens, session messages, or other secrets in public issues. The latest published version receives security fixes.

Store API credentials in n8n credentials. Use a dedicated OpenAgentHub identity with only the access the workflow needs. Session messages and results can contain sensitive information: configure n8n execution retention and access accordingly. Sharing a session grants access according to the upstream OpenAgentHub sharing rules.

Use HTTPS outside local development. Only administrators should configure the OpenAgentHub server URL; it intentionally supports private, self-hosted servers. Restrict outbound network access from your n8n deployment to trusted OpenAgentHub hosts.

The release workflow uses short-lived npm OIDC credentials, pinned GitHub Actions, and a dedicated `npm` environment. No npm token belongs in this repository. Build tools and tests run before publishing.

## Development dependency audit (2026-10-10)

The installed development toolchain has 13 npm audit findings (4 high, 9 moderate; no critical), including transitive reports. The direct advisory causes remaining are `braces` (pattern stack exhaustion through the official CLI's `fast-glob`), `stream-json` (nested input/parser denial of service and prototype pollution in upstream n8n development utilities), and `uuid` 10 (buffer bounds checks in UUID generation). `braces` has no patched release available; the other fixes require upstream major dependency changes. Do not run scaffolding or development tools on untrusted templates, glob patterns, or network payloads. CI uses reviewed repository sources and installs without lifecycle scripts.

Compatible development-only overrides patch `handlebars` (template injection), `axios`, `form-data`, `lodash`, and `qs`. These overrides are deliberately retained with a scoped n8n lint exception until upstream tooling updates. They do not change the n8n host's runtime dependencies. The package declares no runtime dependencies; `npm audit --omit=dev` reports zero findings for this package, but the n8n installation must be updated and audited separately because it supplies `n8n-workflow` and the HTTP transport.
