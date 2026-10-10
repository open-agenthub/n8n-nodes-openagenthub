# Open AgentHub API audit

Audited local upstream `main` c844067 and `origin/integrate/2026-10-10` 6ab1a1a, 2026-10-10. Sources: backend controllers/models/services and EE Sharing controllers. No upstream files changed.

## Authentication boundaries

- `/api/remote/*` accepts a personal API token via `Authorization: Bearer oah_…`; owner resolution is manual in RemoteController. Tokens expose only their owner's sessions. Invalid/missing token returns 401; foreign/missing session returns 404.
- `/api/sessions/*` and `/api/ee/*` require the configured OIDC JWT bearer authentication. A personal `oah_` token is NOT an OIDC JWT and is not accepted here. Local development auth-disabled mode must not be relied on in production.
- `/internal/sessions/{id}/*` uses per-session `X-Agent-Token`, not personal tokens. SessionInfo never returns that token. Do not ask users for pod callback secrets or attempt to extract them.

## Personal-token remote surface (both branches)

| Method | Path | Input / result |
|---|---|---|
| POST | `/api/remote/sessions` | CreateSessionRequest -> SessionInfo |
| GET | `/api/remote/sessions` | SessionInfo[]; no server-side filters |
| GET | `/api/remote/sessions/{id}` | SessionInfo |
| POST | `/api/remote/sessions/{id}/pause` | no body -> SessionInfo; pauses, archives state, keeps resumable session |
| POST | `/api/remote/sessions/{id}/resume` | no body -> SessionInfo |
| DELETE | `/api/remote/sessions/{id}` | 204; deletes session; do not confuse with pause |
| POST | `/api/remote/sessions/{id}/messages` | `{ "body": "message" }` -> `{ "id": "…", "to": "…" }` |
| GET | `/api/remote/sessions/{id}/transcript?offset=0&maxChars=100000` | paginated JSON below |
| GET | `/api/remote/sessions/{id}/state` | gzip binary archive (`application/gzip`) |
| PUT | `/api/remote/sessions/{id}/state` | raw binary archive; session must be stopped; 204 or 503 if object storage absent |

Message normalization trims input and accepts 1..4000 UTF-16 characters. Remote messages have null sender session: receiving agent sees an external owner message. Sending stores inbox data; it is not immediate CLI prompt injection. Agents receive it through their `agent_inbox` tool.

Transcript JSON: `{sessionId, phase, running, offset, nextOffset, length, truncated, text}`. Offset is a character cursor, maxChars defaults 100000, bounded 1..1000000. Return nextOffset on next request. Only Succeeded/Failed cause running=false; Paused still reports true. Scrollback is a sliding window, so reset offset on shrink; callers should account for source changes after upgrades. Integration uses readable native transcript preferentially with scrollback fallback, preserving this response shape.

## Create payload

Typical safe interactive request:

```json
{"title":"n8n task","mode":"Interactive","agent":"Claude","authMode":"Subscription","prompt":"Task","systemPrompt":"Standing instructions","autoApprove":false,"runAsRoot":false}
```

Additional supported fields: description, uiMode, repos (`[{url,branch}]`), legacy repoUrl/repoBranch, projectId, parentSessionId, schedule, mcpConfigJson, mcpServerIds, ephemeralApiSources, openClawApiKeySource, policy, allowedTools (deprecated), image, cpu, memory. Modes Interactive/Autonomous/Scheduled. Prompt required for unattended modes; schedule for Scheduled. IMPORTANT: upstream defaults autoApprove=true for Autonomous/Scheduled when omitted; a security-conscious node should offer explicit false by default. Integration adds `credentialId` for selecting a stored provider account; do not send provider login secrets in creation JSON.

## JWT-only features

Existing main routes include PATCH `/api/sessions/{id}`, POST `/{id}/duplicate`, GET `/{id}/messages` (latest 20, read-only, does not mark delivered), GET `/{id}/permissions`, POST `/{id}/permissions/{reqId}` `{decision:"allow"|"allowAlways"|"deny"}`. JWT transcript `/api/sessions/{id}/transcript` is plain text, unlike Remote transcript JSON.

Integration adds:

- GET `/api/sessions/{id}/conversation?offset=0&max=500`: `{sessionId,phase,running,source,offset,nextOffset,length,truncated,entries,text}`. `source=native` means cursor counts entries (default max 500, cap 5000), `source=scrollback` counts characters and entries is empty. Treat cursor as opaque; reset on source change/shrink.
- PATCH `/api/sessions/{id}/credential` `{credentialId:"…"}` switches a running Subscription session live (409 if not running, 502 pod refusal).
- PATCH regular session accepts systemPrompt (next start/resume) and credentialId (empty resets to default; null unchanged).
- Duplicate payload adds systemPrompt and credentialId.

There is no corresponding Remote conversation/update/duplicate/credential/messages-list route. Nodes should label JWT requirements clearly instead of calling invented remote paths.

## Enterprise sharing (JWT + active enterprise license)

Base `/api/ee/sessions/{sessionId}`:

| Method | Suffix | Input |
|---|---|---|
| GET | `/shares` | none; list direct shares/links/policy |
| POST | `/shares/users` | `{recipient,role}` |
| PATCH | `/shares/users/{recipient}` | `{role}` |
| DELETE | `/shares/users/{recipient}` | none |
| POST | `/shares/links` | `{role,expiresAt}` |
| PATCH | `/shares/links/{linkId}` | `{role,expiresAt}` |
| DELETE | `/shares/links/{linkId}` | none |
| PUT | `/mcp-policy` | `{blockedServers,blockedTools}` |

Roles are strings Viewer/Collaborator (case-insensitive), no Owner role. expiresAt is nullable ISO datetime. Create link returns `{link,url}`; url is a relative secret-bearing `/shared/{token}` URL and must be treated as credential-like data. Missing license -> 402. Owner-only modifications; missing/foreign -> 404. Link/user delete -> 204. Never fetch user-supplied share URLs with the API token; only return them.

## Hidden external session limitation

Neither audited branch implements external/hidden session registration or a personal-token inbox. This is explicitly deferred by `docs/superpowers/specs/2026-09-20-project-agent-fleet-design.md` (external token is not a session and has no inbox). Do not invent a registration operation, set undocumented hidden flags, or deploy a regular expensive pod pretending it is hidden.

Internal session agents can POST `/internal/sessions/{id}/messages` `{to,body}` and GET same route `?wait=0..60` (up to 4 messages, destructive delivery marking), authenticated with the unavailable pod callback token. Peers must share owner and either a non-null project or ancestry. This is unsuitable as public n8n authentication.

A future proper extension needs authenticated owner-scoped external participant registration, discoverability in agent fleet, bidirectional sender identity, bounded inbox with delivery/ack/retry semantics, lifecycle/expiry, and authorization separation from runtime sessions. Keep this documented as unavailable until backend support exists.

## Existing n8n callback integration

The backend has a global configured `N8n:WebhookUrl` notifier posting `{event,sessionId,title,owner,mode,message,url,timestamp}`. Events include question/finished/failed and agent-message. No per-node callback registration API exists. The notifier itself does not sign or authenticate the payload, so it must not be presented as a secure authenticated trigger without deployment-layer protections. Prefer JWT message polling with owner isolation for a package-local trigger; recent message polling is capped at 20 and can miss bursts.
