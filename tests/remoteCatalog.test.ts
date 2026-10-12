import test from "node:test";
import assert from "node:assert/strict";
import type { ILoadOptionsFunctions, IExecuteFunctions } from "n8n-workflow";
import { loadOptions } from "../nodes/OpenAgentHub/discovery";
import { buildSessionPayload } from "../nodes/OpenAgentHub/sessionPayload";

test("personal Git discovery uses remote routes and preserves provider identity in creation", async () => {
  const calls: string[] = [];
  const params: Record<string, unknown> = {
    creationAuthentication: "personal",
    repositoryProviders: ["gitlab"],
    repositorySearch: "demo",
  };
  const context = {
    getNode: () => ({ name: "OpenAgentHub", typeVersion: 2 }),
    getNodeParameter: (name: string, fallback: unknown) =>
      params[name] ?? fallback,
    getCredentials: async () => ({ baseUrl: "https://hub.example" }),
    helpers: {
      httpRequestWithAuthentication: async (
        credential: string,
        options: { url: string; qs?: unknown },
      ) => {
        assert.equal(credential, "openAgentHubApi");
        calls.push(options.url);
        if (options.url.endsWith("providers"))
          return [
            { id: "gitlab", connected: true, displayName: "Work GitLab" },
          ];
        assert.deepEqual(options.qs, { provider: "gitlab", q: "demo" });
        return [
          {
            url: "https://gitlab.example/team/demo.git",
            fullName: "team/demo",
            defaultBranch: "main",
          },
        ];
      },
    },
  } as unknown as ILoadOptionsFunctions;
  assert.equal(
    (await loadOptions.getGitProviders.call(context))[0].value,
    "gitlab",
  );
  const repos = await loadOptions.getRepositories.call(context);
  assert.ok(
    calls.every((url) => url.startsWith("https://hub.example/api/remote/git/")),
  );
  const values: Record<string, unknown> = {
    title: "Test",
    agent: "Claude",
    connectedRepos: [repos[0].value],
  };
  const payload = buildSessionPayload(
    {
      getNode: () => ({}),
      getNodeParameter: (name: string, _index: number, fallback: unknown) =>
        values[name] ?? fallback,
    } as unknown as IExecuteFunctions,
    0,
  );
  assert.deepEqual(payload.repos, [
    {
      url: "https://gitlab.example/team/demo.git",
      branch: "main",
      providerId: "gitlab",
    },
  ]);
});

for (const [status, message] of [
  [404, "Update AgentHub"],
  [403, "Restricted tokens"],
] as const) {
  test(`PAT Git discovery explains HTTP ${status} without disclosing secrets`, async () => {
    const context = {
      getNode: () => ({ name: "OpenAgentHub", typeVersion: 2 }),
      getNodeParameter: (_name: string, fallback: unknown) => fallback,
      getCredentials: async () => ({ baseUrl: "https://hub.example" }),
      helpers: {
        httpRequestWithAuthentication: async () => {
          throw Object.assign(new Error("secret-marker"), {
            statusCode: status,
          });
        },
      },
    } as unknown as ILoadOptionsFunctions;
    await assert.rejects(
      loadOptions.getGitProviders.call(context),
      (error) =>
        error instanceof Error &&
        error.message.includes(message) &&
        !error.message.includes("secret-marker"),
    );
  });
}

test("catalogs use current editor parameters when saved node values are stale", async () => {
  const context = {
    getNodeParameter: () => "personal",
    getCurrentNodeParameter: (name: string) =>
      name === "creationAuthentication"
        ? "user"
        : name === "agent"
          ? "Codex"
          : undefined,
    getCredentials: async () => ({ baseUrl: "https://hub.example" }),
    helpers: {
      httpRequestWithAuthentication: async (
        credential: string,
        options: { url: string },
      ) => {
        assert.equal(credential, "openAgentHubEeApi");
        assert.equal(
          options.url,
          "https://hub.example/api/credentials/accounts",
        );
        return {
          Codex: [{ id: "current", label: "Current account" }],
          Claude: [{ id: "stale" }],
        };
      },
    },
  } as unknown as ILoadOptionsFunctions;
  const options = await loadOptions.getProviderAccounts.call(context);
  assert.deepEqual(
    options.map((option) => option.value),
    ["", "current"],
  );
});
