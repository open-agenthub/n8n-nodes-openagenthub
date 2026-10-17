import test from "node:test";
import assert from "node:assert/strict";
import {
  baseUrl,
  messageBody,
  objectJson,
  request,
  segment,
} from "../nodes/OpenAgentHub/transport";
import {
  OpenAgentHubTrigger,
  selectMessages,
} from "../nodes/OpenAgentHub/OpenAgentHubTrigger.node";
import { OpenAgentHub } from "../nodes/OpenAgentHub/OpenAgentHub.node";
import type {
  IExecuteFunctions,
  IDataObject,
  IPollFunctions,
} from "n8n-workflow";

test("transport accepts HTTPS and requires explicit localhost HTTP opt-in", () => {
  assert.equal(
    baseUrl("https://example.com/hub/", false),
    "https://example.com/hub",
  );
  for (const url of [
    "http://example.com",
    "http://127.0.0.2",
    "file:///tmp",
    "https://u:p@example.com",
    "https://example.com/?token=secret",
    "https://example.com/#x",
  ])
    assert.throws(() => baseUrl(url, true));
  assert.throws(() => baseUrl("http://localhost", false));
  assert.equal(baseUrl("http://localhost:8080", true), "http://localhost:8080");
});
test("identifiers cannot escape paths; bodies match upstream limits", () => {
  assert.equal(segment("x/y?z#h"), "x%2Fy%3Fz%23h");
  assert.throws(() => segment(".."));
  assert.throws(() => segment(" "));
  assert.equal(messageBody(" hello "), "hello");
  assert.throws(() => messageBody(" "));
  assert.throws(() => messageBody("a".repeat(4001)));
  assert.deepEqual(objectJson('{"credentialId":"account"}'), {
    credentialId: "account",
  });
  assert.throws(() => objectJson("[]"));
});
test("HTTP errors redact tokens and response contents; redirects disabled", async () => {
  let options: Record<string, unknown> = {};
  const context = {
    getCredentials: async () => ({
      baseUrl: "https://example.com",
      token: "secret",
    }),
    helpers: {
      httpRequestWithAuthentication: async (
        _c: string,
        o: Record<string, unknown>,
      ) => {
        options = o;
        throw new Error("Authorization Bearer secret sensitive response");
      },
    },
  } as unknown as IExecuteFunctions;
  await assert.rejects(
    request(context, "openAgentHubApi", "GET", "/api/remote/sessions"),
    /^Error: OpenAgentHub request failed\. Check credentials, permissions and server availability\.$/,
  );
  assert.equal(options.disableFollowRedirect, true);
  assert.equal(options.timeout, 30000);
});
test("polling skips history by default, deduplicates and bounds persistent IDs", () => {
  const rows = [
    { id: "b", body: "second" },
    { id: "a", body: "first" },
  ];
  assert.deepEqual(selectMessages(rows, [], false, false).fresh, []);
  assert.deepEqual(
    selectMessages(rows, [], false, true).fresh.map((x) => x.id),
    ["a", "b"],
  );
  assert.deepEqual(
    selectMessages(rows, ["a"], true, false).fresh.map((x) => x.id),
    ["b"],
  );
  assert.equal(
    selectMessages(
      rows,
      Array.from({ length: 250 }, (_, i) => String(i)),
      true,
      false,
    ).seen.length,
    200,
  );
  assert.throws(() => selectMessages([{ body: "invalid" }], [], true, false));
});
async function execute(
  params: Record<string, unknown>,
  result: unknown = { id: "result" },
  keepGoing = false,
) {
  const calls: Record<string, unknown>[] = [];
  const context = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name: string) => params[name],
    getCredentials: async () => ({ baseUrl: "https://example.com" }),
    getNode: () => ({
      name: "test",
      type: "test",
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    continueOnFail: () => keepGoing,
    helpers: {
      httpRequestWithAuthentication: async (
        credential: string,
        options: Record<string, unknown>,
      ) => {
        calls.push({ credential, ...options });
        return result;
      },
    },
  } as unknown as IExecuteFunctions;
  const output = await new OpenAgentHub().getNodeType(1).execute!.call(context);
  return { calls, output };
}
test("create applies safe permission defaults and preserves integration settings", async () => {
  const { calls } = await execute({
    operation: "create",
    settings:
      '{"title":"Task","systemPrompt":"Rules","credentialId":"account"}',
  });
  assert.equal(calls[0].credential, "openAgentHubApi");
  assert.deepEqual(calls[0].body, {
    title: "Task",
    systemPrompt: "Rules",
    credentialId: "account",
    autoApprove: false,
    runAsRoot: false,
  });
});
test("send and stop use remote routes and preserve associated input", async () => {
  const { calls, output } = await execute({
    operation: "sendMessage",
    sessionId: "x/y",
    message: " hello ",
  });
  assert.equal(
    calls[0].url,
    "https://example.com/api/remote/sessions/x%2Fy/messages",
  );
  assert.deepEqual(calls[0].body, { body: "hello" });
  assert.deepEqual(output[0][0].pairedItem, { item: 0 });
  assert.equal(
    (await execute({ operation: "stop", sessionId: "s" })).calls[0].url,
    "https://example.com/api/remote/sessions/s/pause",
  );
});
test("sharing uses user JWT credential and exact Enterprise route", async () => {
  const { calls } = await execute({
    operation: "shareUser",
    sessionId: "s",
    recipient: "alice",
    role: "viewer",
  });
  assert.equal(calls[0].credential, "openAgentHubEeApi");
  assert.equal(
    calls[0].url,
    "https://example.com/api/ee/sessions/s/shares/users",
  );
  assert.deepEqual(calls[0].body, { recipient: "alice", role: "viewer" });
});
test("deletion requires explicit opt-in and pagination rejects invalid bounds", async () => {
  await assert.rejects(
    execute({ operation: "delete", sessionId: "s", confirmDelete: false }),
    /Confirm Deletion/,
  );
  await assert.rejects(
    execute({
      operation: "conversation",
      sessionId: "s",
      offset: 0,
      pageSize: 5001,
    }),
    /pagination/,
  );
});

test("JSON validation does not expose submitted secrets", async () => {
  const result = await execute(
    { operation: "create", settings: '{"token":"sensitive-value",}' },
    undefined,
    true,
  );
  assert.deepEqual(result.output[0][0].json, {
    error: "Enter valid JSON settings",
  });
  assert.equal(result.calls.length, 0);
});
test("empty 204 responses normalize into valid n8n items", async () => {
  const { output } = await execute(
    { operation: "delete", sessionId: "s", confirmDelete: true },
    "",
  );
  assert.deepEqual(output[0][0].json, { success: true });
});
test("integration conversation and credential switch use user JWT routes", async () => {
  const conversation = await execute({
    operation: "conversation",
    sessionId: "s",
    offset: 3,
    pageSize: 500,
  });
  assert.equal(
    conversation.calls[0].url,
    "https://example.com/api/sessions/s/conversation",
  );
  assert.deepEqual(conversation.calls[0].qs, { offset: 3, max: 500 });
  const switchResult = await execute({
    operation: "switchCredential",
    sessionId: "s",
    credentialId: "account",
  });
  assert.equal(switchResult.calls[0].method, "PATCH");
  assert.equal(
    switchResult.calls[0].url,
    "https://example.com/api/sessions/s/credential",
  );
  assert.deepEqual(switchResult.calls[0].body, { credentialId: "account" });
});
test("poll lifecycle persists bounded IDs per server, credential and session and never advances on failure", async () => {
  const state: IDataObject = {};
  let id = "s";
  let server = "https://example.com";
  let credentialId = "one";
  let rows: unknown = [{ id: "a", body: "old" }];
  const context = {
    getNodeParameter: (name: string) => (name === "sessionId" ? id : false),
    getCredentials: async () => ({ baseUrl: server }),
    getNode: () => ({
      credentials: { openAgentHubEeApi: { id: credentialId } },
    }),
    getWorkflowStaticData: () => state,
    helpers: { httpRequestWithAuthentication: async () => rows },
  } as unknown as IPollFunctions;
  const poll = () => new OpenAgentHubTrigger().poll.call(context);
  assert.equal(await poll(), null);
  rows = [
    { id: "b", body: "new" },
    { id: "a", body: "old" },
  ];
  assert.deepEqual(
    (await poll())?.[0].map((x) => x.json.id),
    ["b"],
  );
  assert.equal(await poll(), null);
  id = "other";
  assert.equal(await poll(), null);
  server = "https://other.example.com";
  assert.equal(await poll(), null);
  credentialId = "two";
  assert.equal(await poll(), null);
  assert.equal(Object.keys(state).length, 4);
  const saved = JSON.stringify(state);
  rows = { invalid: true };
  await assert.rejects(poll(), /Invalid message/);
  assert.equal(JSON.stringify(state), saved);
});

test("credentials expose encrypted password fields and exact Bearer expressions", async () => {
  const { OpenAgentHubApi } = await import(
    "../credentials/OpenAgentHubApi.credentials"
  );
  const { OpenAgentHubEeApi } = await import(
    "../credentials/OpenAgentHubEeApi.credentials"
  );
  for (const credential of [new OpenAgentHubApi(), new OpenAgentHubEeApi()]) {
    assert.equal(
      credential.properties.find((p) => p.name === "token")?.typeOptions
        ?.password,
      true,
    );
    assert.deepEqual(credential.authenticate, {
      type: "generic",
      properties: {
        headers: { Authorization: "=Bearer {{$credentials.token}}" },
      },
    });
  }
});

test("credential tests reject unsafe URLs before networking and redact transport failures", async () => {
  const { testApiCredential } = await import("../nodes/OpenAgentHub/transport");
  let count = 0;
  let options: Record<string, unknown> = {};
  const context = {
    helpers: {
      request: async (o: Record<string, unknown>) => {
        count++;
        options = o;
        throw new Error("Bearer secret response");
      },
    },
  } as unknown as import("n8n-workflow").ICredentialTestFunctions;
  const unsafe = await testApiCredential.call(context, {
    id: "a",
    name: "a",
    type: "openAgentHubApi",
    data: { token: "secret", baseUrl: "http://remote.example.com" },
  });
  assert.equal(unsafe.status, "Error");
  assert.equal(count, 0);
  const failed = await testApiCredential.call(context, {
    id: "a",
    name: "a",
    type: "openAgentHubApi",
    data: { token: "secret", baseUrl: "https://example.com" },
  });
  assert.equal(failed.status, "Error");
  assert.equal(count, 1);
  assert.equal(failed.message.includes("secret"), false);
  assert.equal(options.followRedirect, false);
  assert.equal(options.followAllRedirects, false);
});

test("default v3 requires only an AgentHub API token and hides OIDC controls", () => {
  const node = new OpenAgentHub();
  assert.equal(node.description.defaultVersion, 3);
  const description = node.getNodeType(3).description;
  assert.deepEqual(description.credentials?.map((c) => [c.name, c.required]), [["openAgentHubApi", true]]);
  assert.ok(!description.properties.some((p) => p.name === "creationAuthentication"));
  const options = description.properties.find((p) => p.name === "operation")!.options!;
  assert.ok(options.some((o) => "value" in o && o.value === "switchCredential"));
  assert.ok(!options.some((o) => "value" in o && o.value === "shareLink"));
  assert.ok(description.properties.some((p) => p.name === "manualMcpServers"));
});

test("v3 updates and account switching use PAT remote routes despite stale user auth", async () => {
  for (const operation of ["update", "switchCredential"]) {
    const calls: Array<{ credential: string; url: string }> = [];
    const context = {
      getInputData: () => [{ json: {} }],
      getNode: () => ({ name: "test", type: "test", typeVersion: 3, parameters: {}, position: [0, 0] }),
      getNodeParameter: (name: string) => ({ operation, creationAuthentication: "user", sessionId: "session", settings: '{"title":"New"}', credentialId: "account" })[name as "operation"],
      getCredentials: async (name: string) => { assert.equal(name, "openAgentHubApi"); return { baseUrl: "https://example.com" }; },
      continueOnFail: () => false,
      helpers: { httpRequestWithAuthentication: async (credential: string, options: { url: string }) => { calls.push({ credential, url: options.url }); return { id: "session" }; } },
    } as unknown as IExecuteFunctions;
    await new OpenAgentHub().getNodeType(3).execute!.call(context);
    assert.equal(calls[0].credential, "openAgentHubApi");
    assert.equal(calls[0].url, `https://example.com/api/remote/sessions/session${operation === "switchCredential" ? "/credential" : ""}`);
  }
});
