import test from "node:test";
import assert from "node:assert/strict";
import type { ICredentialTestFunctions, ICredentialsDecrypted } from "n8n-workflow";
import { CREDENTIAL_TEST_TIMEOUT_MS, testApiCredential } from "../nodes/OpenAgentHub/transport";

const credential: ICredentialsDecrypted = {
  id: "test", name: "test", type: "openAgentHubApi",
  data: { token: " private-test-token ", baseUrl: "https://agenthub.example" },
};
function context(handler: (options: Record<string, unknown>) => Promise<unknown>) {
  return { helpers: { request: handler } } as unknown as ICredentialTestFunctions;
}

test("connection test uses scoped metadata rather than expensive session listing", async () => {
  let options: Record<string, unknown> = {};
  const result = await testApiCredential.call(context(async (o) => {
    options = o;
    return { statusCode: 200, body: { accounts: {}, gitPats: [], apiKeys: [] } };
  }), credential);
  assert.equal(result.status, "OK");
  assert.equal(options.uri, "https://agenthub.example/api/remote/credentials");
  assert.equal(options.timeout, CREDENTIAL_TEST_TIMEOUT_MS);
  assert.equal(options.resolveWithFullResponse, true);
  assert.equal(options.simple, false);
  assert.equal(options.followRedirect, false);
  assert.equal(options.followAllRedirects, false);
  assert.deepEqual(options.headers, { Authorization: "Bearer private-test-token" });
});

test("connection test ends at its deadline even when the helper ignores timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const result = testApiCredential.call(context(() => new Promise(() => {})), credential);
  t.mock.timers.tick(CREDENTIAL_TEST_TIMEOUT_MS);
  const resolved = await result;
  assert.equal(resolved.status, "Error");
  assert.match(resolved.message, /timed out after 10 seconds/);
  assert.ok(!resolved.message.includes("private-test-token"));
});

test("connection test rejects redirects, denied tokens, proxy pages and malformed success responses", async () => {
  for (const response of [
    { statusCode: 302, body: "login private-test-token" },
    { statusCode: 401, body: { secret: "private-test-token" } },
    { statusCode: 403, body: "private-test-token" },
    { statusCode: 500, body: "private-test-token" },
    { statusCode: 200, body: "<html>Login private-test-token</html>" },
    { statusCode: 200, body: [] },
    { statusCode: 200, body: { accounts: null } },
    undefined,
  ]) {
    const result = await testApiCredential.call(context(async () => response), credential);
    assert.equal(result.status, "Error");
    assert.ok(!result.message.includes("private-test-token"));
  }
});

test("connection test clears deadline on success and keeps legacy JWT route compatible", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let uri: unknown;
  const result = await testApiCredential.call(context(async (o) => {
    uri = o.uri;
    return { statusCode: 200, body: [] };
  }), { ...credential, type: "openAgentHubEeApi" });
  assert.equal(result.status, "OK");
  assert.equal(uri, "https://agenthub.example/api/sessions");
  t.mock.timers.tick(CREDENTIAL_TEST_TIMEOUT_MS * 2);
});
