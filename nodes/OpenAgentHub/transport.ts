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
    const status =
      (error as { statusCode?: number; response?: { status?: number } })
        .statusCode ??
      (error as { response?: { status?: number } }).response?.status;
    const safeStatus =
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
        ? status
        : undefined;
    throw new Error(
      `OpenAgentHub request failed${safeStatus ? ` (HTTP ${safeStatus})` : ""}. Check credentials, permissions and server availability.`,
    );
  }
}

export const testApiCredential: import("n8n-workflow").ICredentialTestFunction =
  async function (credential) {
    try {
      const data = credential.data;
      if (!data || typeof data.token !== "string" || !data.token.trim())
        return { status: "Error", message: "A token is required" };
      const url = baseUrl(data.baseUrl, data.allowLocalHttp);
      // n8n ICredentialTestFunctions exposes only the legacy request helper.
      // eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
      await this.helpers.request({
        method: "GET",
        uri:
          url +
          (credential.type === "openAgentHubApi"
            ? "/api/remote/sessions"
            : "/api/sessions"),
        headers: { Authorization: "Bearer " + data.token },
        json: true,
        timeout: 30000,
        followRedirect: false,
        followAllRedirects: false,
      });
      return { status: "OK", message: "Authentication succeeded" };
    } catch {
      return {
        status: "Error",
        message:
          "Authentication failed. Check the base URL, token and server availability.",
      };
    }
  };
