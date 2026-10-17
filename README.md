# n8n-nodes-openagenthub

Community nodes for controlling [OpenAgentHub](https://github.com/open-agenthub/open-agenthub) from n8n: start sessions, send tasks, read results, pause or resume work, and manage session sharing.

## Installation

Install `n8n-nodes-openagenthub` through **Settings → Community Nodes** in a self-hosted n8n instance. The package is published on npm. Publication does not make it an n8n verified community node.

For local development:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run dev
```

## Credentials

Create an OpenAgentHub personal API token in your instance and store it in the **OpenAgentHub Personal API** n8n credential. Use your instance's base URL, without `/api/remote`. Remote operations use the `/api/remote` endpoints and require an `oah_…` token.

**Node version 3 (default) uses only the AgentHub personal API token. No OIDC token is needed.** Select your saved **OpenAgentHub Personal API** credential. Existing version 1/2 workflows retain their previous authentication behavior. The JWT credential and trigger are legacy compatibility features, not the recommended login.

HTTPS is required. **Allow HTTP for Local Development** permits unencrypted HTTP only for `localhost`, `127.0.0.1`, or `::1`. Leave it disabled for hosted instances. In Docker, localhost refers to the n8n container. Self-hosted private hosts are supported: restrict credential editing and network egress in n8n to trusted administrators and hosts. Keep credentials in n8n's encrypted credential store, and treat transcripts, share links and workflow execution data as sensitive.

## Operations

| Capability in node version 3 | Authentication |
|---|---|
| Create, list, get, stop, resume, delete sessions | AgentHub API token |
| Send messages, read paginated transcript | AgentHub API token |
| Update session, switch provider account | AgentHub API token (requires current backend remote routes) |

Sharing, structured conversations and incoming-message polling are not offered in version 3 until the backend provides secure personal-token endpoints. The legacy JWT trigger remains for existing workflows.

Create Session uses native n8n fields: name, harness, login account, execution mode, prompt, Git credential access, repositories, project, MCP servers, tool permissions, container resources and expiration. Login accounts and stored GitHub/GitLab credentials load from AgentHub with either authentication method. Connected OAuth repositories can also be browsed with an unrestricted personal token when AgentHub provides `/api/remote/git/providers` and `/api/remote/git/projects`. Older AgentHub servers must be updated for this picker. Restricted personal tokens cannot browse OAuth connections. Version 3 accepts manual project and MCP IDs; their catalog endpoints are not yet available with API tokens. Git credential access can include all accounts (including future ones), selected accounts, or none. Custom MCP JSON is optional and hidden until enabled.

Creation explicitly defaults `autoApprove` and `runAsRoot` to false; enabling either is an intentional workflow setting. Update Session retains its JSON input. Deletion requires its own confirmation option.

Version 0.2.0 introduces node version 2. Existing workflows retain node version 1 and its Session Settings JSON. Add a new OpenAgentHub node or select the latest node version to use the native creation dialog. The icons use the GitHub avatar artwork explicitly supplied by the AgentHub maintainer.

Version 0.3.0 introduces API-token-only node version 3. Add a new node or change the existing node to version 3 and select **OpenAgentHub Personal API**. Legacy JWT credentials are not automatically converted.

Version 0.2.1 fixed n8n credential lookup for option menus and execution. In the creation dialog both credential selectors are optional in n8n’s form; fill the one selected under **AgentHub Authentication**. You can reuse existing saved credentials.

To browse GitLab or GitHub repositories, select **Connected Git Accounts**, optionally enter **Repository Search**, then load **Connected Repositories**. Stored Git personal access tokens and connected OAuth accounts are separate lists; **Git Credential Access** controls the tokens placed inside a session, while the connected repository selection supplies its OAuth provider.

## Typical workflow

1. Start a session with a title, agent, execution mode and task prompt. Keep the returned `id` and `url`.
2. Use that ID to send follow-up messages and read session status or transcript pages.
3. Read transcript output and pass a transcript page's `nextOffset` into the next read. A paused session retains its state and can be resumed. Deleting a session is a separate, destructive operation.

Messages are stored in the agent inbox. The running agent must call its `agent_inbox` tool to consume them; posting a message does not guarantee an immediate agent turn.

## API compatibility

Native session creation follows the current upstream `main` snapshot `08647b4`, including the merged integration work. See [CREATE-SESSION-API.md](CREATE-SESSION-API.md) for the UI/API mapping and catalog authentication boundaries. The original operations were checked against these snapshots:

- `main`: `c844067fd0e36233325de8be3a8c9aed56f0d1f8`
- `integrate/2026-10-10`: `6ab1a1af159e6a665cae33d6e39ae7616e15b058`

The integration branch adds structured conversation reads, native provider transcripts and provider account selection. Session Settings JSON supports `systemPrompt` and `credentialId`; version 3 uses the personal-token remote routes for Update Session and Switch Credential. Operations requiring those additions must be used against an instance running that branch or a subsequent release containing it. See [API-NOTES.md](API-NOTES.md) for exact API contracts and authentication boundaries.

### Hidden session / bidirectional messaging

Neither inspected upstream branch exposes an API to register an external or hidden session with its own inbox. Personal API token messages have a null sender session; agents cannot reply directly to that token. This package therefore does not fabricate a hidden session or use internal pod callback credentials.

For incoming agent-to-agent messages, use the message trigger on an existing session with a user credential. The upstream history endpoint returns only the latest 20 messages and does not acknowledge delivery; polling can miss messages when more arrive between polls. It is not a durable external inbox. A proper hidden n8n identity with reliable delivery needs an upstream external-session registration and authenticated inbox API.

## Development and publishing

Development uses Node 24 and n8n-workflow 2.16.0; the n8n peer dependency follows the official community-node packaging convention. 41 automated tests cover request contracts, credential separation, input validation and polling. Version 0.2.1 was additionally tested in a disposable n8n 2.16.0 instance against the live backend: real option fetching, served avatar and a create/get/delete workflow. See [TESTING.md](TESTING.md) for results and remaining backend prerequisites. GitHub Actions runs the checks again on pushes and pull requests.

See [RELEASE.md](RELEASE.md) for the release process and the one-time npm Trusted Publisher setup. Publishing is tied to a GitHub release whose tag matches `package.json`; regular pushes only run CI. No npm publication is performed by installing or building this source tree.

MIT. See [SECURITY.md](SECURITY.md) for vulnerability reporting and the remaining upstream development-tool advisories.
