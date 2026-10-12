import assert from "node:assert/strict";
import test from "node:test";
import type { IExecuteFunctions } from "n8n-workflow";
import { buildSessionPayload } from "../nodes/OpenAgentHub/sessionPayload";
import { sessionFields } from "../nodes/OpenAgentHub/sessionFields";

function build(input: Record<string, unknown> = {}) {
  const values = { title: "Session", agent: "Claude", ...input };
  return buildSessionPayload(
    {
      getNode: () => ({
        id: "test",
        name: "Test",
        type: "openAgentHub",
        typeVersion: 2,
        position: [0, 0],
        parameters: {},
      }),
      getNodeParameter: (name: string, _index: number, fallback: unknown) =>
        name in values ? values[name] : fallback,
    } as unknown as IExecuteFunctions,
    0,
  );
}
test("native create defaults preserve UI credential scope and explicit safe execution settings", () => {
  const payload = build();
  assert.equal(payload.title, "Session");
  assert.equal(payload.gitPatIds, null);
  assert.equal(payload.autoApprove, false);
  assert.equal(payload.runAsRoot, false);
  assert.deepEqual(payload.policy, {
    allowedTools: ["Edit", "Bash(git*)", "Read"],
    allowedMcpTools: [],
    allowedCommands: [],
  });
  assert.equal(payload.autoDeleteAfterSeconds, null);
});
test("Git access distinguishes all, none and selected without broadening explicit selections", () => {
  assert.deepEqual(
    build({ gitPatScope: "none", gitPatIds: ["ignored"] }).gitPatIds,
    [],
  );
  assert.deepEqual(
    build({ gitPatScope: "selected", gitPatIds: ["a", "a", "b"] }).gitPatIds,
    ["a", "b"],
  );
  assert.deepEqual(build({ gitPatScope: "selected" }).gitPatIds, []);
  assert.throws(() => build({ gitPatScope: "invalid" }));
  assert.throws(
    () => build({ gitPatScope: "selected", gitPatIds: ["*"] }),
    /wildcard/,
  );
});
test("connected and manually supplied repositories preserve provider and branch", () => {
  assert.deepEqual(
    build({
      creationAuthentication: "user",
      connectedRepos: [
        JSON.stringify({
          url: "https://github.com/org/repo.git",
          providerId: "github-id",
        }),
      ],
      repos: {
        repo: [{ url: "git@gitlab.example:org/repo.git", branch: "main" }],
      },
    }).repos,
    [
      {
        url: "https://github.com/org/repo.git",
        branch: null,
        providerId: "github-id",
      },
      {
        url: "git@gitlab.example:org/repo.git",
        branch: "main",
        providerId: null,
      },
    ],
  );
  for (const url of ["file:///secret", "ext::sh command", "--upload-pack=evil"])
    assert.throws(() => build({ repos: { repo: [{ url }] } }));
});
test("authentication ignores stale hidden account/source values", () => {
  assert.equal(
    build({ authMode: "ApiKey", credentialId: "hidden" }).credentialId,
    null,
  );
  assert.equal(
    build({ agent: "Claude", openClawApiKeySource: "OpenAI" })
      .openClawApiKeySource,
    undefined,
  );
  assert.equal(
    build({
      agent: "OpenClaw",
      authMode: "ApiKey",
      openClawApiKeySource: "OpenAI",
    }).openClawApiKeySource,
    "OpenAI",
  );
  assert.throws(() => build({ authMode: "Auto" }));
});
test("scheduled sessions require prompt and schedule and valid expiration basis", () => {
  assert.throws(() => build({ mode: "Autonomous" }));
  assert.throws(() => build({ mode: "Scheduled", prompt: "work" }));
  const values = {
    mode: "Scheduled",
    prompt: "work",
    schedule: "0 6 * * *",
    autoDeleteEnabled: true,
    autoDeleteAmount: 2,
    autoDeleteUnit: "days",
  };
  assert.equal(build(values).autoDeleteAfterSeconds, 172800);
  assert.equal(
    build({ ...values, autoDeleteFrom: "lastActivity" }).autoDeleteFrom,
    "start",
  );
  assert.throws(() => build({ ...values, autoDeleteAmount: 366 }));
});
test("policy deduplicates lines and cursor suppresses command prefixes", () => {
  assert.deepEqual(
    build({
      policyMode: "custom",
      policyTools: "Read\nRead\r\nEdit",
      policyCommands: "git status\nnpm test",
    }).policy,
    {
      allowedTools: ["Read", "Edit"],
      allowedMcpTools: [],
      allowedCommands: ["git status", "npm test"],
    },
  );
  assert.deepEqual(
    (
      build({
        policyMode: "custom",
        agent: "Cursor",
        policyCommands: "git status",
      }).policy as Record<string, unknown>
    ).allowedCommands,
    [],
  );
});
test("special MCP configuration is validated without a general session JSON input", () => {
  assert.throws(() => build({ customMcpEnabled: true, mcpConfigJson: "[]" }));
  assert.throws(() =>
    build({ customMcpEnabled: true, mcpConfigJson: "{invalid" }),
  );
  assert.equal(
    build({ customMcpEnabled: true, mcpConfigJson: '{"mcpServers":{}}' })
      .mcpConfigJson,
    '{"mcpServers":{}}',
  );
  assert.ok(
    sessionFields.every((field) =>
      field.displayOptions?.show?.["@version"]?.includes(2),
    ),
  );
  assert.equal(
    sessionFields.filter((field) => field.type === "json").length,
    1,
  );
});
test("ephemeral API source requires HTTP(S) without inline credentials", () => {
  assert.throws(() => build({ ephemeralSpecUrl: "file:///secret" }));
  assert.throws(() =>
    build({ ephemeralSpecUrl: "https://user:secret@example.org/api" }),
  );
  assert.deepEqual(
    build({ ephemeralSpecUrl: "https://api.example.org/spec" })
      .ephemeralApiSources,
    [
      {
        name: "api-example-org",
        specUrl: "https://api.example.org/spec",
        specType: "auto",
        saveToLibrary: false,
      },
    ],
  );
});

test("requires explicit harness and nonempty title", () => {
  assert.throws(() => build({ agent: "" }), /harness/);
  assert.throws(() => build({ title: "   " }), /name/);
});
test("container collection maps resources and explicit execution permissions", () => {
  const payload = build({
    container: {
      image: "custom:1",
      cpu: "1",
      memory: "2Gi",
      runAsRoot: true,
      autoApprove: true,
      parentSessionId: "parent",
    },
  });
  assert.equal(payload.image, "custom:1");
  assert.equal(payload.cpu, "1");
  assert.equal(payload.memory, "2Gi");
  assert.equal(payload.runAsRoot, true);
  assert.equal(payload.autoApprove, true);
  assert.equal(payload.parentSessionId, "parent");
});

test("default policy follows harness defaults and custom empty grants no permissions", () => {
  for (const [agent, allowedTools, allowedCommands] of [
    ["Claude", ["Edit", "Bash(git*)", "Read"], []],
    ["Codex", ["Read", "Edit"], ["git status", "npm test", "dotnet test"]],
    ["OpenCode", ["Read", "Edit", "Glob", "Grep"], ["git status", "npm test"]],
    ["Cursor", ["Shell(git status)", "Read(**)", "Write(**)"], []],
  ]) {
    assert.deepEqual(build({ agent }).policy, {
      allowedTools,
      allowedMcpTools: [],
      allowedCommands,
    });
    assert.deepEqual(build({ agent, policyMode: "custom" }).policy, {
      allowedTools: [],
      allowedMcpTools: [],
      allowedCommands: [],
    });
  }
});
test("repository HTTP URLs reject inline credentials", () => {
  assert.throws(() =>
    build({
      repos: { repo: [{ url: "https://user:secret@example.org/repo.git" }] },
    }),
  );
});

test("manual MCP IDs are native fields and stale user catalog selections are ignored", () => {
  assert.deepEqual(
    build({
      manualMcpServers: {
        server: [{ id: "one" }, { id: "one" }, { id: "two" }],
      },
      mcpServerIds: ["stale"],
    }).mcpServerIds,
    ["one", "two"],
  );
  assert.deepEqual(
    build({
      creationAuthentication: "user",
      mcpServerIds: ["user-id"],
      manualMcpServers: { server: [{ id: "stale" }] },
    }).mcpServerIds,
    ["user-id"],
  );
});
test("disabled custom MCP ignores stale JSON and hides the JSON editor", () => {
  assert.equal(
    build({ mcpConfigJson: "invalid stale" }).mcpConfigJson,
    undefined,
  );
  const field = sessionFields.find((field) => field.name === "mcpConfigJson");
  assert.deepEqual(field?.displayOptions?.show?.customMcpEnabled, [true]);
});
test("interactive auto-delete defaults to last activity while scheduled uses start", () => {
  assert.equal(
    build({ autoDeleteEnabled: true }).autoDeleteFrom,
    "lastActivity",
  );
});
