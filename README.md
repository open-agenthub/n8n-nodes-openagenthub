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

Session sharing, message history and the new structured conversation API use the logged-in user API, which currently requires a separate **OpenAgentHub User Access Token API** credential containing a user bearer JWT. A personal API token does not authenticate these routes. JWTs expire and must be renewed; this package does not silently exchange personal API tokens for user permissions. Sharing additionally requires an active OpenAgentHub Enterprise license.

HTTPS is required. **Allow HTTP for Local Development** permits unencrypted HTTP only for `localhost`, `127.0.0.1`, or `::1`. Leave it disabled for hosted instances. In Docker, localhost refers to the n8n container. Self-hosted private hosts are supported: restrict credential editing and network egress in n8n to trusted administrators and hosts. Keep credentials in n8n's encrypted credential store, and treat transcripts, share links and workflow execution data as sensitive.

## Operations

| Capability | Authentication |
|---|---|
| Create sessions | Personal API token or user access token |
| List, get, stop (pause), resume, delete sessions | Personal API token |
| Send message, read paginated transcript | Personal API token |
| Read recent messages, update session | User access token |
| Structured conversation, live provider credential switch (integration) | User access token |
| List shares, share with user, create link, revoke user/link sharing | User access token + Enterprise license |
| Poll incoming messages for an existing session | User access token |

Create Session uses native n8n fields: name, harness, login account, execution mode, prompt, Git credential access, repositories, project, MCP servers, tool permissions, container resources and expiration. Login accounts and stored GitHub/GitLab credentials load from AgentHub with either authentication method. The connected OAuth repository, project and MCP catalogs require **User Access Token** authentication; personal tokens support manually entered repositories and IDs. Git credential access can include all accounts (including future ones), selected accounts, or none. Custom MCP JSON is optional and hidden until enabled.

Creation explicitly defaults `autoApprove` and `runAsRoot` to false; enabling either is an intentional workflow setting. Update Session retains its JSON input. Deletion requires its own confirmation option.

Version 0.2.0 introduces node version 2. Existing workflows retain node version 1 and its Session Settings JSON. Add a new OpenAgentHub node or select the latest node version to use the native creation dialog. The icons use AgentHub’s official favicon artwork.

## Typical workflow

1. Start a session with a title, agent, execution mode and task prompt. Keep the returned `id` and `url`.
2. Use that ID to send follow-up messages and read session status or transcript pages. Forward the returned `url` to someone with access, or create an Enterprise share link when broader access is needed.
3. Use the trigger for messages addressed to an existing session, or read transcript output and pass a transcript page's `nextOffset` into the next read. A paused session retains its state and can be resumed. Deleting a session is a separate, destructive operation.

Messages are stored in the agent inbox. The running agent must call its `agent_inbox` tool to consume them; posting a message does not guarantee an immediate agent turn.

## API compatibility

Native session creation follows the current upstream `main` snapshot `08647b4`, including the merged integration work. See [CREATE-SESSION-API.md](CREATE-SESSION-API.md) for the UI/API mapping and catalog authentication boundaries. The original operations were checked against these snapshots:

- `main`: `c844067fd0e36233325de8be3a8c9aed56f0d1f8`
- `integrate/2026-10-10`: `6ab1a1af159e6a665cae33d6e39ae7616e15b058`

The integration branch adds structured conversation reads, native provider transcripts and provider account selection. Session Settings JSON supports `systemPrompt` and `credentialId`; the Update Session and Switch Credential operations use a user access token. Operations requiring those additions must be used against an instance running that branch or a subsequent release containing it. See [API-NOTES.md](API-NOTES.md) for exact API contracts and authentication boundaries.

### Hidden session / bidirectional messaging

Neither inspected upstream branch exposes an API to register an external or hidden session with its own inbox. Personal API token messages have a null sender session; agents cannot reply directly to that token. This package therefore does not fabricate a hidden session or use internal pod callback credentials.

For incoming agent-to-agent messages, use the message trigger on an existing session with a user credential. The upstream history endpoint returns only the latest 20 messages and does not acknowledge delivery; polling can miss messages when more arrive between polls. It is not a durable external inbox. A proper hidden n8n identity with reliable delivery needs an upstream external-session registration and authenticated inbox API.

## Development and publishing

Development uses Node 24 and n8n-workflow 2.16.0; the n8n peer dependency follows the official community-node packaging convention. Tests mock the n8n request context and cover request contracts, credential separation, input validation and polling. They do not start a live OpenAgentHub deployment. GitHub Actions runs the checks again on pushes and pull requests.

See [RELEASE.md](RELEASE.md) for the release process and the one-time npm Trusted Publisher setup. Publishing is tied to a GitHub release whose tag matches `package.json`; regular pushes only run CI. No npm publication is performed by installing or building this source tree.

MIT. See [SECURITY.md](SECURITY.md) for vulnerability reporting and the remaining upstream development-tool advisories.
