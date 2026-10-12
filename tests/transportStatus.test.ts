import test from "node:test";
import assert from "node:assert/strict";
import type { ILoadOptionsFunctions } from "n8n-workflow";
import { request } from "../nodes/OpenAgentHub/transport";

test("transport recognizes n8n string httpCode without exposing raw errors", async () => {
  for (const details of [
    { httpCode: "404" },
    { statusCode: "403" },
    { response: { status: "502" } },
    { response: { statusCode: 429 } },
  ]) {
    const context = {
      getCredentials: async () => ({ baseUrl: "https://hub.example" }),
      helpers: {
        httpRequestWithAuthentication: async () => {
          throw Object.assign(new Error("secret-marker"), details);
        },
      },
    } as unknown as ILoadOptionsFunctions;
    await assert.rejects(
      request(context, "openAgentHubApi", "GET", "/api/remote/git/providers"),
      (error) =>
        error instanceof Error &&
        /HTTP (404|403|502|429)/.test(error.message) &&
        !error.message.includes("secret-marker"),
    );
  }
});
test("transport rejects untrusted status strings", async () => {
  const context = {
    getCredentials: async () => ({ baseUrl: "https://hub.example" }),
    helpers: {
      httpRequestWithAuthentication: async () => {
        throw { httpCode: "404 secret-marker" };
      },
    },
  } as unknown as ILoadOptionsFunctions;
  await assert.rejects(
    request(context, "openAgentHubApi", "GET", "/api/remote/git/providers"),
    (error) =>
      error instanceof Error &&
      !error.message.includes("HTTP") &&
      !error.message.includes("secret-marker"),
  );
});
