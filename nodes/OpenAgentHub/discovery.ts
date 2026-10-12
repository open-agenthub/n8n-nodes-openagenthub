import { NodeOperationError } from "n8n-workflow";
import type {
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from "n8n-workflow";
import { request } from "./transport";

const harnesses = ["Claude", "Codex", "Cursor", "OpenClaw", "OpenCode"];

function parameter(
  context: ILoadOptionsFunctions,
  name: string,
  fallback: unknown,
): unknown {
  const current =
    typeof context.getCurrentNodeParameter === "function"
      ? context.getCurrentNodeParameter(name)
      : undefined;
  return current ?? context.getNodeParameter(name, fallback);
}

export function creationCredential(context: ILoadOptionsFunctions): string {
  const authentication = parameter(
    context,
    "creationAuthentication",
    "personal",
  );
  if (authentication === "personal") return "openAgentHubApi";
  if (authentication === "user") return "openAgentHubEeApi";
  throw new Error("Choose a supported AgentHub authentication method");
}

function object(value: unknown): IDataObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid catalog response");
  return value as IDataObject;
}

function rows(value: unknown): IDataObject[] {
  if (!Array.isArray(value)) throw new Error("Invalid catalog response");
  return value.map(object);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sort(options: INodePropertyOptions[]): INodePropertyOptions[] {
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

async function userCatalog(
  context: ILoadOptionsFunctions,
  path: string,
): Promise<IDataObject[]> {
  if (creationCredential(context) !== "openAgentHubEeApi") return [];
  return rows(await request(context, "openAgentHubEeApi", "GET", path));
}

async function gitCatalog(
  context: ILoadOptionsFunctions,
  endpoint: string,
  qs?: IDataObject,
): Promise<IDataObject[]> {
  const credential = creationCredential(context);
  const prefix =
    credential === "openAgentHubApi" ? "/api/remote/git/" : "/api/git/";
  try {
    return rows(
      await request(
        context,
        credential,
        "GET",
        prefix + endpoint,
        undefined,
        qs,
      ),
    );
  } catch (error) {
    if (
      credential === "openAgentHubApi" &&
      error instanceof Error &&
      error.message.includes("HTTP 404")
    )
      throw new NodeOperationError(
        context.getNode(),
        "This AgentHub server does not support Git discovery with personal API tokens yet. Update AgentHub to a version providing /api/remote/git/providers, or use User Access Token authentication.",
      );
    if (
      credential === "openAgentHubApi" &&
      error instanceof Error &&
      error.message.includes("HTTP 403")
    )
      throw new NodeOperationError(
        context.getNode(),
        "This personal API token cannot browse connected Git accounts. Restricted tokens do not grant OAuth repository access; use an unrestricted personal token or User Access Token authentication.",
      );
    throw new NodeOperationError(context.getNode(), error as Error);
  }
}
export const loadOptions = {
  async getAgents(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    if (creationCredential(this) === "openAgentHubApi")
      return harnesses.map((name) => ({ name, value: name }));
    const response = object(
      await request(this, "openAgentHubEeApi", "GET", "/api/agents/allowed"),
    );
    if (
      !Array.isArray(response.agents) ||
      response.agents.some((agent) => typeof agent !== "string")
    )
      throw new Error("Invalid harness catalog response");
    return sort(
      response.agents.map((agent) => ({
        name: String(agent),
        value: String(agent),
      })),
    );
  },

  async getProviderAccounts(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    const credential = creationCredential(this);
    const response = object(
      await request(
        this,
        credential,
        "GET",
        credential === "openAgentHubApi"
          ? "/api/remote/credentials"
          : "/api/credentials/accounts",
      ),
    );
    const accounts =
      credential === "openAgentHubApi" ? object(response.accounts) : response;
    const agent = text(parameter(this, "agent", "Claude"));
    const available =
      accounts[agent] === undefined ? [] : rows(accounts[agent]);
    return [
      { name: "Default Account", value: "" },
      ...sort(
        available
          .filter((account) => text(account.id))
          .map((account) => {
            const identity = [text(account.email), text(account.organization)]
              .filter(Boolean)
              .join(" · ");
            const label = text(account.label) || text(account.id);
            const name =
              (identity ? `${label} — ${identity}` : label) +
              (account.isDefault === true ? " (default)" : "") +
              (account.isExhausted === true ? " (at limit)" : "");
            return { name, value: text(account.id) };
          }),
      ),
    ];
  },

  async getGitCredentials(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    const credential = creationCredential(this);
    const response = object(
      await request(
        this,
        credential,
        "GET",
        credential === "openAgentHubApi"
          ? "/api/remote/credentials"
          : "/api/credentials",
      ),
    );
    return sort(
      rows(response.gitPats)
        .filter((pat) => text(pat.id))
        .map((pat) => ({
          name: `${pat.kind === "github" ? "GitHub" : pat.kind === "gitlab" ? "GitLab" : text(pat.kind)} — ${text(pat.host)}`,
          value: text(pat.id),
        })),
    );
  },

  async getProjects(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    return [
      { name: "No Project", value: "" },
      ...sort(
        (await userCatalog(this, "/api/projects"))
          .filter((project) => text(project.id))
          .map((project) => ({
            name: text(project.name) || text(project.id),
            value: text(project.id),
          })),
      ),
    ];
  },

  async getMcpServers(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    return sort(
      (await userCatalog(this, "/api/mcp-servers"))
        .filter((server) => text(server.id))
        .map((server) => ({
          name: text(server.name) || text(server.id),
          value: text(server.id),
        })),
    );
  },

  async getGitProviders(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    return sort(
      (await gitCatalog(this, "providers"))
        .filter((provider) => provider.connected === true && text(provider.id))
        .map((provider) => ({
          name: `${text(provider.displayName) || text(provider.id)}${text(provider.username) ? ` — ${text(provider.username)}` : ""}`,
          value: text(provider.id),
        })),
    );
  },

  async getRepositories(
    this: ILoadOptionsFunctions,
  ): Promise<INodePropertyOptions[]> {
    const selected = parameter(this, "repositoryProviders", []);
    if (
      !Array.isArray(selected) ||
      selected.some((id) => typeof id !== "string")
    )
      throw new Error(
        "Choose connected Git accounts before loading repositories",
      );
    const connected = await gitCatalog(this, "providers");
    const allowed = new Set(
      connected
        .filter((provider) => provider.connected === true)
        .map((provider) => text(provider.id)),
    );
    const providers = [...new Set(selected as string[])];
    if (providers.some((id) => !allowed.has(id)))
      throw new Error("A selected Git account is no longer connected");
    const query = text(parameter(this, "repositorySearch", ""));
    const options: INodePropertyOptions[] = [];
    // Use only AgentHub's repository API. Never attach an AgentHub token to clone URLs.
    for (const provider of providers) {
      const repositories = await gitCatalog(this, "projects", {
        provider,
        q: query,
      });
      for (const repo of repositories) {
        if (!text(repo.url)) continue;
        options.push({
          name: `${text(repo.fullName) || text(repo.name) || text(repo.url)} (${provider})`,
          value: JSON.stringify({
            url: text(repo.url),
            branch: text(repo.defaultBranch) || null,
            providerId: provider,
          }),
        });
      }
    }
    return sort(options);
  },
};
