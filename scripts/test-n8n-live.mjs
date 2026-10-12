// Run against a disposable local n8n instance with this package loaded.
// OAH_TEST_CREDENTIAL_FILE points to a private JSON file with baseUrl/token.
// OAH_TEST_API_URL may point to a local-only proxy to that same backend.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const n8nUrl = process.env.N8N_TEST_URL || "http://127.0.0.1:5678";
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(n8nUrl).hostname),
  "Use a disposable local n8n instance",
);
const credential = JSON.parse(
  await readFile(
    process.env.OAH_TEST_CREDENTIAL_FILE || "/tmp/oah-live-credential.json",
    "utf8",
  ),
);
let cookie = "";
const authFile = process.env.N8N_TEST_AUTH_FILE || "/tmp/oah-n8n-auth.json";
try {
  cookie = JSON.parse(await readFile(authFile, "utf8")).cookie;
} catch {}
async function api(path, body) {
  const response = await fetch(n8nUrl + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) {
    cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    await writeFile(authFile, JSON.stringify({ cookie }), { mode: 0o600 });
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(`Local n8n ${path} returned HTTP ${response.status}`);
  return result.data ?? result;
}
if (!cookie)
  await api("/rest/owner/setup", {
    email: "n8n-test@example.invalid",
    firstName: "Integration",
    lastName: "Test",
    password: randomBytes(24).toString("hex") + "Aa1!",
  });
const data = {
  baseUrl: process.env.OAH_TEST_API_URL || credential.baseUrl,
  token: credential.token,
  allowLocalHttp:
    process.env.OAH_TEST_API_URL?.startsWith("http://127.0.0.1:") || false,
};
const saved = await api("/rest/credentials", {
  name: "Disposable AgentHub integration test",
  type: "openAgentHubApi",
  data,
});
assert.ok(saved.id);
const credentials = { openAgentHubApi: { id: saved.id, name: saved.name } };
const nodeType = "CUSTOM.openAgentHub";
const descriptions = await api("/rest/node-types", {
  nodeInfos: [
    { name: nodeType, version: 1 },
    { name: nodeType, version: 2 },
  ],
});
assert.equal(descriptions.length, 2);
for (const description of descriptions) {
  assert.equal(
    new Set(description.credentials.map((c) => c.name)).size,
    description.credentials.length,
  );
  assert.ok(
    JSON.stringify(description.icon ?? description.iconUrl)?.includes(
      "openagenthub.png",
    ),
  );
}
const iconReference = descriptions[1].iconUrl;
const iconPath =
  typeof iconReference === "string" ? iconReference : iconReference.light;
const iconResponse = await fetch(new URL(iconPath, n8nUrl + "/"), {
  headers: { Cookie: cookie },
});
assert.ok(iconResponse.ok);
const expectedIcon = await readFile(
  new URL("../nodes/OpenAgentHub/openagenthub.png", import.meta.url),
);
assert.ok(Buffer.from(await iconResponse.arrayBuffer()).equals(expectedIcon));
console.log("Real n8n serves the exact requested GitHub avatar");
const params = {
  operation: "create",
  creationAuthentication: "personal",
  title: "n8n runtime integration test (temporary)",
  agent: "Codex",
  mode: "Interactive",
  authMode: "Subscription",
  gitPatScope: "none",
};
async function options(methodName, field) {
  return await api("/rest/dynamic-node-parameters/options", {
    nodeTypeAndVersion: { name: nodeType, version: 2 },
    path: "parameters." + field,
    methodName,
    credentials,
    currentNodeParameters: params,
  });
}
const harnesses = await options("getAgents", "agent");
assert.ok(harnesses.some((option) => option.value === "Codex"));
const accounts = await options("getProviderAccounts", "credentialId");
assert.ok(accounts.length > 1, "Expected a saved Codex account");
await options("getGitCredentials", "gitPatIds");
console.log(
  "Real n8n option fetching passed: harnesses, login accounts and scoped Git credentials",
);
// Missing backend support must yield the actionable error; this is not a live Git picker success.
const response = await fetch(n8nUrl + "/rest/dynamic-node-parameters/options", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    nodeTypeAndVersion: { name: nodeType, version: 2 },
    path: "parameters.repositoryProviders",
    methodName: "getGitProviders",
    credentials,
    currentNodeParameters: params,
  }),
});
const git = await response.json();
if (response.ok)
  console.log(
    "Connected Git discovery available; providers:",
    (git.data ?? git).length,
  );
else {
  assert.ok(
    JSON.stringify(git).includes("Update AgentHub") ||
      JSON.stringify(git).includes("Restricted tokens"),
  );
  console.log(
    "Real n8n correctly explains missing/denied PAT Git backend support",
  );
}
const create = {
  id: "create",
  name: "Create",
  type: nodeType,
  typeVersion: 2,
  position: [260, 0],
  parameters: params,
  credentials,
};
const get = {
  id: "get",
  name: "Get",
  type: nodeType,
  typeVersion: 2,
  position: [520, 0],
  parameters: {
    operation: "get",
    sessionId: '={{ $node["Create"].json["id"] }}',
  },
  credentials,
};
const remove = {
  id: "delete",
  name: "Delete",
  type: nodeType,
  typeVersion: 2,
  position: [780, 0],
  parameters: {
    operation: "delete",
    sessionId: '={{ $node["Create"].json["id"] }}',
    confirmDelete: true,
  },
  credentials,
};
const workflow = await api("/rest/workflows", {
  name: "Disposable AgentHub lifecycle test",
  nodes: [
    {
      id: "start",
      name: "Start",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    },
    create,
    get,
    remove,
  ],
  connections: {
    Start: { main: [[{ node: "Create", type: "main", index: 0 }]] },
    Create: { main: [[{ node: "Get", type: "main", index: 0 }]] },
    Get: { main: [[{ node: "Delete", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1" },
});
await writeFile(
  process.env.N8N_TEST_RESULT_FILE || "/tmp/oah-n8n-test-workflow.json",
  JSON.stringify({ workflowId: workflow.id }),
  { mode: 0o600 },
);
console.log("Lifecycle workflow saved for n8n execute --id:", workflow.id);
