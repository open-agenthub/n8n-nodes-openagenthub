# Validation of 0.2.1

- 41 automated tests pass. Typecheck, lint (zero errors), build and package validation pass. Production dependency audit reports zero findings.
- A disposable n8n 2.16.0 instance loaded the compiled versioned node and credentials. Its real `/rest/dynamic-node-parameters/options` endpoint successfully fetched harnesses, saved login accounts and scoped Git credential metadata using the provided personal token.
- The actual n8n icon URL served bytes identical to the maintainer-supplied GitHub avatar.
- The missing PAT Git backend endpoint produced the actionable upgrade hint through n8n. This is not a successful live GitLab repository listing; that requires [AgentHub PR #94](https://github.com/open-agenthub/open-agenthub/pull/94) in the deployed backend.
- A saved workflow executed through `n8n execute --id`: Manual Trigger → Create → Get → Delete. It created a temporary Codex session, verified its ID on retrieval and deleted it. A subsequent independent request returned HTTP 404.

The supplied public AgentHub hostname resolved to an unreachable internal HTTPS address from the test pod. Tests instead used a localhost-only HTTP proxy to the same `agenthub-backend.agenthub.svc.cluster.local` service. The node's HTTPS requirement was preserved; the explicit local-development HTTP setting was enabled only in the disposable credential.

The latest n8n npm installation (2.42.7) failed on an unavailable AWS dependency. The tested 2.16.0 npm installation needed compatible transitive LangGraph versions: checkpoint 1.0.1 and nested LangGraph 1.1.2; a stale checkpoint 1.1.6 directory contradicted npm's own override and was removed. These are test-environment details, not changes to the published node's runtime dependencies.

## Reproducing the live test

`scripts/test-n8n-live.mjs` targets a fresh, disposable n8n instance on localhost. It creates a test owner, credential and workflow, verifies actual option loading and the served avatar, and prints the workflow ID for execution with n8n's CLI using the same user folder and custom extension directory. It reads the API token from a private JSON file via `OAH_TEST_CREDENTIAL_FILE`; no token is embedded in the script. `OAH_TEST_API_URL` optionally selects a localhost proxy to that same backend. Run only against a disposable local n8n instance. On failed workflow execution, remove any temporary session before disposing of the test instance.

Backend PR #94 separately passed 57 targeted tests (including MVC activation and credential scope checks) and the complete executable backend suite: 1606 passed, 128 PostgreSQL-dependent tests skipped, zero failed. All GitHub PR checks passed. The PR has not been merged or deployed as part of these checks.

## Credential connection regression (0.3.1)

48 automated tests pass, including an independently bounded deadline for a helper that never settles, scoped metadata routing, rejection of redirects/HTML/invalid responses and legacy JWT compatibility.

Real HTTP proof with n8n-core 2.16.1 CredentialTestContext (synthetic token only):

```sh
npm install --prefix /tmp/oah-auth-proof --ignore-scripts --legacy-peer-deps n8n-core@2.16.1 n8n-workflow@2.16.0
npm run build
OAH_N8N_CORE_PATH=/tmp/oah-auth-proof/node_modules/n8n-core node scripts/test-credential-http.cjs
```

Valid metadata, HTTP 401, login HTML, redirect and stalled response all passed. The stall ended at 10000 ms and the redirect target received no request. This tests the real n8n HTTP helper; it does not inspect the user’s n8n deployment or prove its network configuration.
