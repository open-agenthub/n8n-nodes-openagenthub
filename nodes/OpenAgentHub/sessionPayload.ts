import { NodeOperationError } from "n8n-workflow";
import type { IDataObject, IExecuteFunctions } from "n8n-workflow";

export function buildSessionPayload(
  context: IExecuteFunctions,
  itemIndex: number,
): IDataObject {
  const invalid = (message: string) =>
    new NodeOperationError(context.getNode(), message, { itemIndex });
  const get = (name: string, fallback: unknown = ""): unknown =>
    context.getNodeParameter(name, itemIndex, fallback);
  const text = (name: string, fallback = "") =>
    String(get(name, fallback)).trim();
  const lines = (name: string) => [
    ...new Set(
      text(name)
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const ids = (name: string): string[] => {
    const value = get(name, []);
    if (
      !Array.isArray(value) ||
      value.some((id) => typeof id !== "string" || !id.trim())
    )
      throw invalid(`${name} must be a list of IDs`);
    return [...new Set(value as string[])];
  };
  const agent = text("agent");
  const title = text("title");
  if (!title) throw invalid("A session name is required");
  if (!agent) throw invalid("A session harness must be selected");
  const container = get("container", {}) as IDataObject;
  const containerText = (name: string, fallback = "") =>
    String(container[name] ?? fallback).trim();
  const mode = text("mode", "Interactive");
  const authMode = text("authMode", "Subscription");
  if (!["Claude", "Codex", "Cursor", "OpenClaw", "OpenCode"].includes(agent))
    throw invalid("Unsupported session harness");
  if (!["Interactive", "Autonomous", "Scheduled"].includes(mode))
    throw invalid("Unsupported session mode");
  if (!["Subscription", "ApiKey"].includes(authMode))
    throw invalid("Unsupported authentication mode");
  const prompt = text("prompt");
  if (mode !== "Interactive" && !prompt)
    throw invalid(
      "An initial prompt is required for autonomous and scheduled sessions",
    );
  const schedule = mode === "Scheduled" ? text("schedule") : null;
  if (mode === "Scheduled" && !schedule)
    throw invalid("A schedule is required for scheduled sessions");
  const uiMode =
    agent === "Claude" && mode === "Interactive"
      ? text("uiMode", "terminal")
      : "terminal";
  if (!["terminal", "chat"].includes(uiMode))
    throw invalid("Unsupported session interface");
  const scope = text("gitPatScope", "all");
  if (!["all", "none", "selected"].includes(scope))
    throw invalid("Unsupported Git credential access scope");
  const selectedGitIds = scope === "selected" ? ids("gitPatIds") : [];
  if (selectedGitIds.includes("*"))
    throw invalid(
      "Select individual Git credential IDs; wildcard access requires the All option",
    );
  const reposValue = get("repos", {}) as { repo?: unknown[] };
  const connected = ids("connectedRepos").map((value) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw invalid(
        "Connected repository selection is invalid; refresh the repository list",
      );
    }
  });
  const repos = [...connected, ...(reposValue.repo ?? [])].map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw invalid("Invalid repository");
    const repo = value as Record<string, unknown>;
    const url = String(repo.url ?? "").trim();
    if (!/^(?:https?:\/\/|ssh:\/\/|git:\/\/|[^\s@:]+@[^\s:]+:)/i.test(url))
      throw invalid(
        "Use an HTTP, HTTPS, SSH, Git, or SCP-style repository URL",
      );
    if (/^https?:\/\//i.test(url)) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw invalid("Invalid repository URL");
      }
      if (parsed.username || parsed.password)
        throw invalid(
          "Repository URLs must not contain credentials; use a connected provider or stored Git credential",
        );
    }
    return {
      url,
      branch: String(repo.branch ?? "").trim() || null,
      providerId: String(repo.providerId ?? "").trim() || null,
    };
  });
  const policyMode = text("policyMode", "default");
  if (!["default", "custom"].includes(policyMode))
    throw invalid("Unsupported tool permission mode");
  const defaultPolicy =
    agent === "Codex"
      ? {
          allowedTools: ["Read", "Edit"],
          allowedCommands: ["git status", "npm test", "dotnet test"],
        }
      : agent === "OpenCode"
        ? {
            allowedTools: ["Read", "Edit", "Glob", "Grep"],
            allowedCommands: ["git status", "npm test"],
          }
        : agent === "Cursor"
          ? {
              allowedTools: ["Shell(git status)", "Read(**)", "Write(**)"],
              allowedCommands: [],
            }
          : {
              allowedTools: ["Edit", "Bash(git*)", "Read"],
              allowedCommands: [],
            };
  const personalMcp = get("manualMcpServers", {}) as {
    server?: Array<{ id?: unknown }>;
  };
  const mcpServerIds =
    text("creationAuthentication", "personal") === "user"
      ? ids("mcpServerIds")
      : [
          ...new Set(
            (personalMcp.server ?? []).map((server) => {
              if (typeof server.id !== "string" || !server.id.trim())
                throw invalid("MCP server ID is required");
              return server.id.trim();
            }),
          ),
        ];
  const payload: IDataObject = {
    title,
    description: text("description") || null,
    agent,
    mode,
    authMode,
    uiMode,
    prompt: prompt || null,
    schedule,
    credentialId:
      authMode === "Subscription" ? text("credentialId") || null : null,
    gitPatIds: scope === "all" ? null : selectedGitIds,
    repos,
    projectId: text("projectId") || null,
    mcpServerIds,
    policy:
      policyMode === "default"
        ? { ...defaultPolicy, allowedMcpTools: [] }
        : {
            allowedTools: lines("policyTools"),
            allowedMcpTools: lines("policyMcpTools"),
            allowedCommands: agent === "Cursor" ? [] : lines("policyCommands"),
          },
    systemPrompt: text("systemPrompt") || null,
    image: containerText("image") || null,
    runAsRoot: container.runAsRoot === true,
    autoApprove: container.autoApprove === true,
    cpu: containerText("cpu", "500m"),
    memory: containerText("memory", "1Gi"),
    autoDeleteAfterSeconds: null,
    autoDeleteFrom: null,
    accountFailover: text("accountFailover", "auto"),
  };
  if (!["auto", "off"].includes(String(payload.accountFailover)))
    throw invalid("Unsupported account failover mode");
  if (containerText("parentSessionId"))
    payload.parentSessionId = containerText("parentSessionId");
  if (agent === "OpenClaw" && authMode === "ApiKey") {
    const source = text("openClawApiKeySource", "Anthropic");
    if (!["Anthropic", "OpenAI", "Cursor"].includes(source))
      throw invalid("Unsupported OpenClaw API key source");
    payload.openClawApiKeySource = source;
  }
  const mcp =
    get("customMcpEnabled", false) === true ? text("mcpConfigJson") : "";
  if (mcp) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(mcp);
    } catch {
      throw invalid("Custom MCP configuration must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw invalid("Custom MCP configuration must be a JSON object");
    payload.mcpConfigJson = mcp;
  }
  if (get("autoDeleteEnabled", false) === true) {
    const unit = text("autoDeleteUnit", "hours");
    if (!["hours", "days"].includes(unit))
      throw invalid("Unsupported auto-delete unit");
    const seconds = Math.round(
      Number(get("autoDeleteAmount", 24)) * (unit === "days" ? 86400 : 3600),
    );
    if (!Number.isFinite(seconds) || seconds < 300 || seconds > 365 * 86400)
      throw invalid("Auto-delete must be between 5 minutes and 365 days");
    const from =
      mode === "Scheduled" ? "start" : text("autoDeleteFrom", "lastActivity");
    if (
      !["start", "lastActivity"].includes(from) ||
      (mode === "Scheduled" && from !== "start")
    )
      throw invalid("Scheduled auto-delete must count from session start");
    payload.autoDeleteAfterSeconds = seconds;
    payload.autoDeleteFrom = from;
  }
  const specUrl = text("ephemeralSpecUrl");
  if (specUrl) {
    let url: URL;
    try {
      url = new URL(specUrl);
    } catch {
      throw invalid("Invalid API specification URL");
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw invalid(
        "API specification URL must use HTTP(S) without embedded credentials",
      );
    payload.ephemeralApiSources = [
      {
        name:
          text("ephemeralName") ||
          url.hostname.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase(),
        specUrl,
        specType: "auto",
        saveToLibrary: get("ephemeralSaveToLibrary", false) === true,
      },
    ];
  }
  return payload;
}
