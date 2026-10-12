import test from "node:test";
import assert from "node:assert/strict";
import { NodeHelpers } from "n8n-workflow";
import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeParameters,
} from "n8n-workflow";
import { loadOptions } from "../nodes/OpenAgentHub/discovery";
import { OpenAgentHub } from "../nodes/OpenAgentHub/OpenAgentHub.node";

function catalog(
  params: Record<string, unknown>,
  responses: Record<string, unknown>,
) {
  const calls: { credential: string; options: IDataObject }[] = [];
  const context = {
    getNodeParameter: (name: string, fallback: unknown) =>
      params[name] ?? fallback,
    getCredentials: async () => ({ baseUrl: "https://agenthub.example" }),
    helpers: {
      httpRequestWithAuthentication: async (
        credential: string,
        options: IDataObject,
      ) => {
        calls.push({ credential, options });
        const path = new URL(String(options.url)).pathname;
        const response = responses[path];
        if (response instanceof Error) throw response;
        return response;
      },
    },
  } as unknown as ILoadOptionsFunctions;
  return { context, calls };
}

test("personal account and Git menus use only scoped remote credential metadata", async () => {
  const { context, calls } = catalog(
    { agent: "Codex" },
    {
      "/api/remote/credentials": {
        accounts: {
          Codex: [
            {
              id: "allowed",
              label: "Work",
              email: "me@example.com",
              isDefault: true,
              token: "secret-marker",
            },
          ],
          Claude: [{ id: "other", label: "Other harness" }],
        },
        gitPats: [
          {
            id: "git-id",
            kind: "gitlab",
            host: "gitlab.example",
            token: "secret-marker",
          },
        ],
      },
    },
  );
  const accounts = await loadOptions.getProviderAccounts.call(context);
  const git = await loadOptions.getGitCredentials.call(context);
  assert.deepEqual(
    accounts.map((option) => option.value),
    ["", "allowed"],
  );
  assert.match(accounts[1].name, /Work.*me@example.com.*default/);
  assert.deepEqual(git, [{ name: "GitLab — gitlab.example", value: "git-id" }]);
  assert.ok(!JSON.stringify([accounts, git]).includes("secret-marker"));
  assert.ok(
    calls.every(
      (call) =>
        call.credential === "openAgentHubApi" &&
        call.options.url === "https://agenthub.example/api/remote/credentials",
    ),
  );
  assert.ok(calls.every((call) => call.options.disableFollowRedirect === true));
});

test("personal catalog never calls JWT-only routes; user mode respects allowed harnesses", async () => {
  const personal = catalog(
    {},
    { "/api/remote/git/providers": [], "/api/remote/git/projects": [] },
  );
  assert.ok(
    (await loadOptions.getAgents.call(personal.context)).some(
      (option) => option.value === "OpenCode",
    ),
  );
  assert.deepEqual(
    await loadOptions.getGitProviders.call(personal.context),
    [],
  );
  assert.deepEqual(
    await loadOptions.getRepositories.call(personal.context),
    [],
  );
  assert.deepEqual(await loadOptions.getMcpServers.call(personal.context), []);
  assert.deepEqual(await loadOptions.getProjects.call(personal.context), [
    { name: "No Project", value: "" },
  ]);
  assert.ok(
    personal.calls.every((call) =>
      String(call.options.url).includes("/api/remote/git/"),
    ),
  );
  const user = catalog(
    { creationAuthentication: "user" },
    { "/api/agents/allowed": { agents: ["Codex"] } },
  );
  assert.deepEqual(await loadOptions.getAgents.call(user.context), [
    { name: "Codex", value: "Codex" },
  ]);
  assert.equal(user.calls[0].credential, "openAgentHubEeApi");
});

test("connected repository menus search only selected connected accounts and retain provider identity", async () => {
  const { context, calls } = catalog(
    {
      creationAuthentication: "user",
      repositoryProviders: ["github-work", "github-work"],
      repositorySearch: "widget",
    },
    {
      "/api/git/providers": [
        {
          id: "github-work",
          displayName: "GitHub Work",
          username: "me",
          connected: true,
        },
        { id: "gitlab-off", connected: false },
      ],
      "/api/git/projects": [
        {
          fullName: "org/widget",
          url: "https://github.com/org/widget.git",
          defaultBranch: "main",
          providerId: "ignored-untrusted-field",
          secret: "secret-marker",
        },
      ],
    },
  );
  const providers = await loadOptions.getGitProviders.call(context);
  assert.deepEqual(
    providers.map((option) => option.value),
    ["github-work"],
  );
  const repositories = await loadOptions.getRepositories.call(context);
  assert.deepEqual(JSON.parse(String(repositories[0].value)), {
    url: "https://github.com/org/widget.git",
    branch: "main",
    providerId: "github-work",
  });
  const searchCalls = calls.filter((call) =>
    String(call.options.url).endsWith("/api/git/projects"),
  );
  assert.equal(searchCalls.length, 1);
  assert.deepEqual(searchCalls[0].options.qs, {
    provider: "github-work",
    q: "widget",
  });
  assert.ok(
    calls.every((call) =>
      String(call.options.url).startsWith("https://agenthub.example/api/"),
    ),
  );
  assert.ok(!JSON.stringify(repositories).includes("secret-marker"));
});

test("disconnected providers fail before searching; discovery HTTP errors do not reveal responses", async () => {
  const disconnected = catalog(
    { creationAuthentication: "user", repositoryProviders: ["gone"] },
    { "/api/git/providers": [] },
  );
  await assert.rejects(
    loadOptions.getRepositories.call(disconnected.context),
    /no longer connected/,
  );
  assert.equal(disconnected.calls.length, 1);
  const failed = catalog(
    {},
    {
      "/api/remote/credentials": new Error(
        "secret-marker request token response",
      ),
    },
  );
  await assert.rejects(
    loadOptions.getGitCredentials.call(failed.context),
    (error) =>
      error instanceof Error && !error.message.includes("secret-marker"),
  );
});

test("real n8n display rules show native create controls in v2, retain v1 JSON, and preserve unique first-match credential descriptors", () => {
  const versioned = new OpenAgentHub();
  const visible = (version: number, params: INodeParameters) =>
    versioned
      .getNodeType(version)
      .description.properties.filter((property) =>
        NodeHelpers.displayParameter(
          params,
          property,
          { typeVersion: version },
          versioned.getNodeType(version).description,
        ),
      );
  const params = {
    operation: "create",
    creationAuthentication: "personal",
    authMode: "Subscription",
    agent: "Claude",
    mode: "Interactive",
  };
  const v1 = visible(1, params);
  const v2 = visible(2, params);
  assert.ok(v1.some((property) => property.name === "settings"));
  assert.ok(!v1.some((property) => property.name === "title"));
  assert.ok(v2.some((property) => property.name === "title"));
  assert.ok(v2.some((property) => property.name === "credentialId"));
  assert.ok(!v2.some((property) => property.name === "settings"));
  assert.ok(!v2.some((property) => property.type === "json"));
  const credentials = (version: number, values: INodeParameters) =>
    versioned
      .getNodeType(version)
      .description.credentials?.filter((credential) =>
        NodeHelpers.displayParameter(
          values,
          credential,
          { typeVersion: version },
          versioned.getNodeType(version).description,
        ),
      )
      .map((credential) => credential.name);
  assert.deepEqual(credentials(1, { operation: "create" }), [
    "openAgentHubApi",
  ]);
  assert.deepEqual(credentials(2, params), [
    "openAgentHubApi",
    "openAgentHubEeApi",
  ]);
  assert.deepEqual(
    credentials(2, { ...params, creationAuthentication: "user" }),
    ["openAgentHubApi", "openAgentHubEeApi"],
  );
  assert.deepEqual(
    credentials(2, {
      ...params,
      operation: "get",
      creationAuthentication: "user",
    }),
    ["openAgentHubApi"],
  );
  assert.deepEqual(credentials(2, { ...params, operation: "conversation" }), [
    "openAgentHubEeApi",
  ]);
  assert.equal(versioned.description.defaultVersion, 2);
  for (const version of [1, 2]) {
    const description = versioned.getNodeType(version).description;
    const names = description.credentials!.map((credential) => credential.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(
      description.credentials!.every(
        (credential) => credential.required === (version === 1),
      ),
    );
    for (const operation of ["create", "get", "list", "conversation"]) {
      for (const authentication of ["personal", "user"]) {
        const name =
          (operation === "create" &&
            version === 2 &&
            authentication === "user") ||
          operation === "conversation"
            ? "openAgentHubEeApi"
            : "openAgentHubApi";
        const first = description.credentials!.find(
          (credential) => credential.name === name,
        )!;
        assert.ok(
          NodeHelpers.displayParameter(
            { operation, creationAuthentication: authentication },
            first,
            { typeVersion: version },
            description,
          ),
        );
      }
    }
  }
});

async function executeNative(authentication: string) {
  const calls: { credential: string; options: IDataObject }[] = [];
  const params: Record<string, unknown> = {
    operation: "create",
    creationAuthentication: authentication,
    title: "Native session",
    agent: "Codex",
    mode: "Autonomous",
    prompt: "Run tests",
    credentialId: "login-id",
    gitPatScope: "selected",
    gitPatIds: ["git-id"],
    container: { cpu: "1", memory: "2Gi", runAsRoot: false },
  };
  const context = {
    getNode: () => ({ name: "Node", typeVersion: 2 }),
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name: string, _index: number, fallback: unknown) =>
      params[name] ?? fallback,
    getCredentials: async (name: string) => {
      const description = new OpenAgentHub().getNodeType(2).description;
      const credential = description.credentials!.find(
        (item) => item.name === name,
      );
      assert.ok(
        credential,
        "n8n resolves credentials by the first matching name",
      );
      assert.ok(
        NodeHelpers.displayParameter(
          params,
          credential,
          { typeVersion: 2 },
          description,
        ),
        "n8n rejects hidden credentials before making requests",
      );
      return { baseUrl: "https://agenthub.example" };
    },
    continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: async (
        credential: string,
        options: IDataObject,
      ) => {
        calls.push({ credential, options });
        return { id: "created" };
      },
    },
  } as unknown as IExecuteFunctions;
  const output = await new OpenAgentHub().getNodeType(2).execute!.call(context);
  return { output, calls };
}

test("native session creation executes with each selected auth route and maps typed settings", async () => {
  for (const authentication of ["personal", "user"]) {
    const { calls, output } = await executeNative(authentication);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].credential,
      authentication === "personal" ? "openAgentHubApi" : "openAgentHubEeApi",
    );
    assert.equal(
      calls[0].options.url,
      `https://agenthub.example/api/${authentication === "personal" ? "remote/" : ""}sessions`,
    );
    const body = calls[0].options.body as IDataObject;
    assert.equal(body.title, "Native session");
    assert.equal(body.credentialId, "login-id");
    assert.deepEqual(body.gitPatIds, ["git-id"]);
    assert.equal(body.autoApprove, false);
    assert.equal(body.cpu, "1");
    assert.equal(body.memory, "2Gi");
    assert.deepEqual(output[0][0].pairedItem, { item: 0 });
  }
  await assert.rejects(executeNative("unsupported"), /authentication/);
});
