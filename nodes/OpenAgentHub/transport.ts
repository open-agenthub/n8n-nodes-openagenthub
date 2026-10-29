import type {
  IExecuteFunctions,
  IPollFunctions,
  ILoadOptionsFunctions,
  IDataObject,
  IHttpRequestMethods,
} from "n8n-workflow";

export function baseUrl(value: unknown, allowLocalHttp: unknown): string {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("Enter a valid OpenAgentHub base URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && local && allowLocalHttp === true)
  )
    throw new Error(
      "HTTPS is required; HTTP is only allowed for explicitly enabled localhost development",
    );
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "Base URL must not contain credentials, query parameters or fragments",
    );
  return url.toString().replace(/\/$/, "");
}
export function segment(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("A valid identifier is required");
  const text = value;
  if (!text.trim() || text === "." || text === "..")
    throw new Error("A valid identifier is required");
  return encodeURIComponent(text);
}
export function objectJson(value: unknown): IDataObject {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("Enter valid JSON settings");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("JSON must be an object");
  return parsed as IDataObject;
}
export function messageBody(value: unknown): string {
  const text = String(value).trim();
  if (!text || text.length > 4000)
    throw new Error("Message must contain 1–4000 characters");
  return text;
}
export async function request(
  context: IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions,
  credential: string,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<unknown> {
  const credentials = await context.getCredentials(credential);
  const url = baseUrl(credentials.baseUrl, credentials.allowLocalHttp);
  // All paths originate in the node implementation, never in workflow data.
  if (!path.startsWith("/api/") || path.includes("://"))
    throw new Error("Invalid API route");
  try {
    return await context.helpers.httpRequestWithAuthentication.call(
      context,
      credential,
      {
        method,
        url: url + path,
        body,
        qs,
        json: true,
        timeout: 30000,
        disableFollowRedirect: true,
      },
    );
  } catch (error) {
    // n8n request errors can contain request headers and response bodies. Do not propagate them.
    const details = error as {
      statusCode?: unknown;
      httpCode?: unknown;
      response?: { status?: unknown; statusCode?: unknown };
    };
    const safeStatus = [
      details?.statusCode,
      details?.httpCode,
      details?.response?.status,
      details?.response?.statusCode,
    ]
      .map((value) =>
        typeof value === "number"
          ? value
          : typeof value === "string" && /^\d{3}$/.test(value)
            ? Number(value)
            : undefined,
      )
      .find(
        (value) =>
          value !== undefined &&
          Number.isInteger(value) &&
          value >= 100 &&
          value <= 599,
      );
    throw new Error(
      `OpenAgentHub request failed${safeStatus ? ` (HTTP ${safeStatus})` : ""}. Check credentials, permissions and server availability.`,
    );
  }
}

export const CREDENTIAL_TEST_TIMEOUT_MS = 10_000;

export const testApiCredential: import("n8n-workflow").ICredentialTestFunction =
  async function (credential) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = credential.data;
      if (!data || typeof data.token !== "string" || !data.token.trim())
        return { status: "Error", message: "A token is required" };
      const url = baseUrl(data.baseUrl, data.allowLocalHttp);
      const personal = credential.type === "openAgentHubApi";
      // Session listing can involve Kubernetes and every session. Authentication
      // only needs the scoped credential metadata, never session enumeration.
      // Keep a wall-clock deadline as well as the helper's network timeout:
      // a stalled helper must not leave n8n's credential dialog waiting forever.
      const response = await Promise.race([
        // n8n ICredentialTestFunctions exposes only the legacy request helper.
        // eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
        this.helpers.request({
          method: "GET",
          uri: url + (personal ? "/api/remote/credentials" : "/api/sessions"),
          headers: { Authorization: "Bearer " + data.token.trim() },
          json: true,
          timeout: CREDENTIAL_TEST_TIMEOUT_MS,
          followRedirect: false,
          followAllRedirects: false,
          resolveWithFullResponse: true,
          simple: false,
        }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("credential-test-timeout")), CREDENTIAL_TEST_TIMEOUT_MS);
        }),
      ]) as { statusCode?: number; body?: unknown };
      const code = response?.statusCode;
      if (code === 401 || code === 403)
        return { status: "Error", message: "Authentication rejected. Check the API token and its permissions." };
      if (code !== 200)
        return { status: "Error", message: "AgentHub did not return a successful API response. Check the base URL, reverse proxy and server availability." };
      const body = response.body;
      const valid = personal
        ? body !== null && typeof body === "object" && !Array.isArray(body) &&
          "accounts" in body && body.accounts !== null && typeof body.accounts === "object" && !Array.isArray(body.accounts)
        : Array.isArray(body);
      if (!valid)
        return { status: "Error", message: "Unexpected API response. Use the AgentHub base URL, not an OIDC login page or a proxy landing page." };
      return { status: "OK", message: "Authentication succeeded" };
    } catch (error) {
      if ((error instanceof Error && error.message === "credential-test-timeout") ||
          ["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNABORTED"].includes(String((error as { code?: unknown })?.code)))
        return { status: "Error", message: "Connection test timed out after 10 seconds. Check that the AgentHub URL is reachable from the n8n server." };
      return {
        status: "Error",
        message: "Authentication failed. Check the base URL, token and server availability.",
      };
    } finally {
      if (deadline !== undefined) clearTimeout(deadline);
    }
  };
