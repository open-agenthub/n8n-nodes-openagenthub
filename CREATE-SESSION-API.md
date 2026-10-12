# Session creation API audit

Reviewed 2026-10-10 against local AgentHub `origin/main` (`08647b4`) and compared with `origin/integrate/2026-10-10`. Sources: `frontend/src/components/NewSessionDialog.vue`, `frontend/src/lib/agent.js`, `frontend/src/lib/expiry.js`, `backend/Controllers/RemoteController.cs`, `backend/Models/SessionModels.cs`, `backend/Services/CredentialScope.cs`, `backend/Program.cs`.

## Authentication and discovery

| Endpoint | Authentication | Data / intended use |
| --- | --- | --- |
| `POST /api/remote/sessions` | Personal API token `oah_…`, Bearer header | Full `CreateSessionRequest`, same service as browser UI |
| `GET /api/remote/credentials` | Personal API token | `{accounts,gitPats,apiKeys}` narrowed to token credential scope; no secrets |
| `GET /api/credentials/accounts` | Interactive OIDC JWT | Provider accounts keyed by agent name |
| `GET /api/credentials` | Interactive OIDC JWT | Readiness booleans and Git PAT metadata |
| `GET /api/agents/allowed` | Interactive OIDC JWT | `{agents:["Claude",…]}` effective instance allowlist |
| `GET /api/git/providers` | Interactive OIDC JWT | Configured providers and connection status |
| `GET /api/git/projects?provider=ID&q=TEXT` | Interactive OIDC JWT | Search repositories of connected provider |
| `GET /api/projects` | Interactive OIDC JWT | Personal projects |
| `GET /api/mcp-servers` | Interactive OIDC JWT | Own, organization and shared MCP catalog |

`[Authorize]` routes use the OIDC JwtBearer scheme when configured, not the personal API-token resolver. They cannot be used with an `oah_` token. Authentication-disabled development mode is a special dev scheme, not a production PAT workaround. Remote MCP OAuth tokens are another distinct scheme and do not authenticate ordinary UI routes either.

Remote account entries contain `id`, `label`, `email`, `organization`, `isDefault`, creation/usage timestamps and optional exhaustion metadata (`isExhausted`, `exhaustedUntil`, `exhaustedReason`). Identity strings are display metadata, not verified provider identity. Git PAT entries are `{id,kind,host}`, where kind is `github` or `gitlab`. Remote `apiKeys` currently reports `anthropic`, `openai`, `cursor`; it omits OpenCode presence despite OpenCode support in the create DTO.

## Native fields and payload

| UI field | Payload | Default / conditions |
| --- | --- | --- |
| Name | `title` | UI fallback `Session` |
| Description | `description` | Trimmed, null if empty, max 500 characters |
| Session mode | `mode` | `Interactive`, `Autonomous`, `Scheduled` |
| Session harness | `agent` | `Claude`, `Codex`, `Cursor`, `OpenClaw`, `OpenCode` |
| Billing/login mode | `authMode` | `Subscription` or `ApiKey`; new creates must not use legacy `Auto` |
| OpenClaw key source | `openClawApiKeySource` | Required only OpenClaw + ApiKey: `Anthropic`, `OpenAI`, `Cursor`; omit elsewhere |
| Login account | `credentialId` | Null = default resolved at every start; explicit ID pins account; only Subscription |
| GitHub/GitLab accounts | `gitPatIds` | Null or `["*"]` = all PATs, including future additions; `[]` = none; explicit IDs = selection |
| Interface | `uiMode` | `terminal`; `chat` only interactive Claude |
| Task | `prompt` | Required nonblank for Autonomous/Scheduled; optional initial task also works for Interactive |
| Standing instructions | `systemPrompt` | Trimmed, null empty, max 20,000; appended to runtime's own system prompt |
| Schedule | `schedule` | Cron string for Scheduled; UI example `0 6 * * 1-5` UTC |
| Project | `projectId` | Optional existing personal project ID |
| Repositories | `repos` | Repeated `{url,branch?,providerId?}`; optional connected OAuth provider per repo |
| Saved MCP servers | `mcpServerIds` | List of accessible catalog IDs |
| API sources | `ephemeralApiSources` | Repeated `{name,specUrl,specType:"auto",saveToLibrary}` |
| Extra MCP configuration | `mcpConfigJson` | Optional `.mcp.json` string; inline names override catalog names |
| Tool policy | `policy.allowedTools` | List of built-in tool names/patterns |
| MCP policy | `policy.allowedMcpTools` | List of full MCP tool names/patterns |
| Shell policy | `policy.allowedCommands` | List of commands/prefixes; Cursor UI forces empty |
| Container | `image`, `runAsRoot` | Default image, false; instance may forbid custom images/root |
| Automatic approval | `autoApprove` | UI sends explicit false initially; API omission defaults true for Autonomous/Scheduled, false Interactive |
| Resources | `cpu`, `memory` | `500m`, `1Gi`, Kubernetes quantities |
| Auto deletion | `autoDeleteAfterSeconds`, `autoDeleteFrom` | Disabled null/0; duration 300..31,536,000 seconds; basis `start` or `lastActivity` |
| Account failover | `accountFailover` | API also supports `auto` (default) or `off`; not exposed in current create dialog |
| Parent session | `parentSessionId` | API orchestration field; not exposed in current create dialog |

Git OAuth connections and stored Git PATs are different concepts. A PAT multiselect only supplies the manual tokens mounted into the session. OAuth provider authentication is selected through each repository's `providerId`; there is no top-level OAuth-account multiselect in the backend DTO.

## Security and semantics

Remote credential discovery and creation enforce API-token scopes. Do not try to recover filtered entries through UI routes. A restricted token with omitted Git IDs gets only its allowed PATs; `["*"]` is also narrowed server-side. Omitted login account follows the default only when allowed; a sole allowed account can be auto-selected, otherwise the service returns `credential_required`. Scope failures are 403 (`credential_not_allowed`, `agent_not_allowed`, `api_keys_not_allowed`, `git_pat_not_allowed`). Existing-session operations are owner scoped rather than creator-token scoped.

Repository maximum is 16, URL maximum 2,048 characters, branch maximum 256 characters. Backend permits HTTPS/HTTP/SSH/git and scp-style remotes, rejects leading dashes and unsafe file/ext transports. SSH requires both stored private key and known_hosts. Explicit OAuth provider IDs must be configured and connected. Prefer HTTPS in node validation and never put tokens in URLs.

Empty structured policy means default-deny and supersedes legacy `allowedTools`; do not silently insert permissive wildcard policy. Frontend defaults differ per harness. Claude shell commands are exact native Bash rules and reject metacharacters/globs/compound commands; deliberate Bash patterns belong in built-in tools. Codex/OpenCode shell policy uses prefixes. Cursor encodes shell permission in tool patterns and uses empty command list. Automatic approval is a separate bypass of permission prompts and must be an explicit visible choice.

Auto-deletion with `lastActivity` measures owner use (including incoming owner messages), not arbitrary agent output; scheduled sessions permit only `start`. It deletes the session, not merely its pod. On creation null/0 disables it. On update null means unchanged and 0 disables it.

## Implementation recommendation without backend changes

Use native n8n fields for session creation plus fixed collections for repositories, ephemeral API sources and policy lists. Keep the JSON block only as an optional explicit legacy/advanced mode. Load login options and Git PAT multi-options from `GET /api/remote/credentials`, with harness as a `loadOptionsDependsOn` dependency. Include a clear default-account choice and preserve `none` versus `all` PAT semantics with a separate selection mode. Labels can include account identity/default/exhausted status; values must be IDs only. Use n8n's stored credential request helper and existing safe URL/error handling for discovery.

With a PAT credential, use the static known harness catalog and let the server enforce its allowlist. Offer normal ID/text fields for project/catalog IDs and repository URLs/provider IDs, with clear descriptions. Do not call JWT-only discovery routes with PATs or imply OAuth providers are PAT entries. Fully dynamic parity for projects, OAuth repositories, allowed harnesses and MCP catalog requires either a distinct interactive OAuth/JWT credential implementation or new read-only PAT discovery endpoints in AgentHub. Neither is needed to implement dynamic login/PAT selectors now.

## Main versus integration

Main contains the newer PAT selection, scoped remote credential listing, auto-deletion, account exhaustion/failover and mode-conversion features beyond the named integration branch. Main's create dialog adds Git PAT picker and auto-delete controls. Use main as the canonical create contract rather than dropping those features to match the older integration branch.

## Personal-token Git discovery extension

The node also supports `GET /api/remote/git/providers` and `GET /api/remote/git/projects?provider=ID&q=TEXT`. These routes need an AgentHub backend containing the separate RemoteGitController change. They resolve the owner from the personal token and reuse the owner's connected Git service. Restricted tokens fail closed with 403 because current token scopes cannot grant OAuth connection access. Missing routes (404) produce an explicit upgrade/user-authentication hint in n8n. The existing `/api/git/*` routes continue to require a user token.

Git PAT access and Git OAuth repository discovery are separate: the former selects credentials made available in a session; the latter browses repositories and retains the selected `providerId` in `repos`. n8n never fetches clone URLs with AgentHub credentials.
