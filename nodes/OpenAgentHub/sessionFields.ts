import type { INodeProperties } from "n8n-workflow";

const show = { operation: ["create"], "@version": [2] };
const dynamic = (method: string, depends: string[] = []) => ({
  loadOptionsMethod: method,
  loadOptionsDependsOn: ["creationAuthentication", ...depends],
});
const help: Record<string, string> = {
  title: "Name displayed in AgentHub; use a meaningful workflow or task name",
  description: "Optional summary shown with the session",
  mode: "Interactive starts a session you can message. Autonomous runs the initial prompt. Scheduled runs the prompt using the cron schedule.",
  authMode:
    "Subscription uses a saved harness login account. API Key uses API keys already stored in AgentHub.",
  schedule:
    "Five-part cron expression in UTC, for example 0 6 * * 1-5 for weekdays at 06:00",
  repositoryProviders:
    "Choose connected GitHub/GitLab OAuth accounts before loading repositories. Choose from the list, or specify IDs using an expression. Personal tokens require AgentHub remote Git discovery support and unrestricted OAuth access.",
  repositorySearch:
    "Search repository names in the selected connected Git accounts; change this field to reload the list",
  connectedRepos:
    "Choose from the list, or specify IDs using an expression. First select connected Git accounts. Selected repositories include their provider and default branch.",
  repos:
    "Manually add clone URLs, for example https://gitlab.example.com/group/project.git. Use the connected repository picker above to browse linked accounts.",
  projectId:
    "Optional AgentHub project grouping, separate from GitLab repositories. Choose from the list, or specify an ID using an expression.",
  autoDeleteEnabled:
    "Whether AgentHub should automatically delete the session after the configured interval",
  accountFailover:
    "Automatic switches to another permitted login when an account reaches its limit. Off keeps the chosen account.",
  customMcpEnabled:
    "Whether to provide advanced MCP configuration; saved MCP server selections do not require JSON",
  ephemeralName: "Optional name for tools generated from the API specification",
  ephemeralSaveToLibrary:
    "Whether to save the API source in your AgentHub library for reuse",
};
export const sessionFields: INodeProperties[] = [
  {
    displayName: "Session Name",
    name: "title",
    type: "string",
    default: "Session",
    required: true,
  },
  {
    displayName: "Description",
    name: "description",
    type: "string",
    default: "",
  },
  {
    displayName: "Session Harness Name or ID",
    name: "agent",
    type: "options",
    typeOptions: dynamic("getAgents"),
    default: "",
    required: true,
    description: "Choose from the list, or specify an ID using an expression",
  },
  {
    displayName: "Mode",
    name: "mode",
    type: "options",
    options: ["Interactive", "Autonomous", "Scheduled"].map((value) => ({
      name: value,
      value,
    })),
    default: "Interactive",
  },
  {
    displayName: "Authentication",
    name: "authMode",
    type: "options",
    options: [
      { name: "Subscription", value: "Subscription" },
      { name: "API Key", value: "ApiKey" },
    ],
    default: "Subscription",
  },
  {
    displayName: "Login Account Name or ID",
    name: "credentialId",
    type: "options",
    typeOptions: dynamic("getProviderAccounts", ["agent"]),
    default: "",
    description:
      "Choose from the list, or specify an ID using an expression. Empty uses the current default account on each start.",
    displayOptions: { show: { authMode: ["Subscription"] } },
  },
  {
    displayName: "OpenClaw API Key Source",
    name: "openClawApiKeySource",
    type: "options",
    options: ["Anthropic", "OpenAI", "Cursor"].map((value) => ({
      name: value,
      value,
    })),
    default: "Anthropic",
    displayOptions: { show: { agent: ["OpenClaw"], authMode: ["ApiKey"] } },
  },
  {
    displayName: "Session Interface",
    name: "uiMode",
    type: "options",
    options: [
      { name: "Terminal", value: "terminal" },
      { name: "Chat", value: "chat" },
    ],
    default: "terminal",
    displayOptions: { show: { agent: ["Claude"], mode: ["Interactive"] } },
  },
  {
    displayName: "Initial Prompt",
    name: "prompt",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    description: "Required for autonomous and scheduled sessions",
  },
  {
    displayName: "Schedule",
    name: "schedule",
    type: "string",
    default: "0 6 * * 1-5",
    displayOptions: { show: { mode: ["Scheduled"] } },
  },
  {
    displayName: "Git Credential Access",
    name: "gitPatScope",
    type: "options",
    options: [
      { name: "None", value: "none" },
      { name: "Selected Accounts", value: "selected" },
      { name: "All Accounts (Including Future Accounts)", value: "all" },
    ],
    default: "all",
    description:
      "Controls stored Git personal access tokens available inside the session; repository OAuth connections are selected separately",
  },
  {
    displayName: "Git Account Names or IDs",
    name: "gitPatIds",
    type: "multiOptions",
    typeOptions: dynamic("getGitCredentials"),
    default: [],
    description: "Choose from the list, or specify IDs using an expression",
    displayOptions: { show: { gitPatScope: ["selected"] } },
  },
  {
    displayName: "Connected Git Account Names or IDs",
    name: "repositoryProviders",
    type: "multiOptions",
    default: [],
    typeOptions: dynamic("getGitProviders"),
    description:
      'Choose connected GitHub or GitLab accounts to browse. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: "Repository Search",
    name: "repositorySearch",
    type: "string",
    default: "",
    description: "Filter repositories in the selected connected Git accounts",
  },
  {
    displayName: "Connected Repository Names or IDs",
    name: "connectedRepos",
    type: "multiOptions",
    typeOptions: dynamic("getRepositories", [
      "repositoryProviders",
      "repositorySearch",
    ]),
    default: [],
    description:
      "Choose from the list, or specify IDs using an expression. Includes the connected GitHub or GitLab provider for authentication.",
  },
  {
    displayName: "Repositories",
    name: "repos",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    default: {},
    placeholder: "Add Repository",
    options: [
      {
        displayName: "Repository",
        name: "repo",
        values: [
          {
            displayName: "Clone URL",
            name: "url",
            type: "string",
            default: "",
            required: true,
          },
          {
            displayName: "Branch",
            name: "branch",
            type: "string",
            default: "",
          },
          {
            displayName: "Connected Provider ID",
            name: "providerId",
            type: "string",
            default: "",
            description:
              "Optional OAuth provider connection used to clone and push",
          },
        ],
      },
    ],
  },
  {
    displayName: "Project Name or ID",
    name: "projectId",
    type: "options",
    typeOptions: dynamic("getProjects"),
    default: "",
    description: "Choose from the list, or specify an ID using an expression",
    displayOptions: { show: { creationAuthentication: ["user"] } },
  },
  {
    displayName: "Project ID",
    name: "projectId",
    type: "string",
    default: "",
    displayOptions: { show: { creationAuthentication: ["personal"] } },
  },
  {
    displayName: "MCP Server Names or IDs",
    name: "mcpServerIds",
    displayOptions: { show: { creationAuthentication: ["user"] } },
    type: "multiOptions",
    typeOptions: dynamic("getMcpServers"),
    default: [],
    description: "Choose from the list, or specify IDs using an expression",
  },
  {
    displayName: "MCP Server IDs",
    name: "manualMcpServers",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    default: {},
    placeholder: "Add MCP Server",
    options: [
      {
        displayName: "Server",
        name: "server",
        values: [
          {
            displayName: "Server ID",
            name: "id",
            type: "string",
            default: "",
            required: true,
          },
        ],
      },
    ],
    displayOptions: { show: { creationAuthentication: ["personal"] } },
  },
  {
    displayName: "Tool Permissions",
    name: "policyMode",
    type: "options",
    options: [
      { name: "Harness Defaults", value: "default" },
      { name: "Custom", value: "custom" },
    ],
    default: "default",
    description:
      "Use the same default policy as the session creation dialog, or explicitly list permissions",
  },
  {
    displayName: "Allowed Tools",
    name: "policyTools",
    displayOptions: { show: { policyMode: ["custom"] } },
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    description:
      "One tool pattern per line; empty grants no automatic tool permissions",
  },
  {
    displayName: "Allowed MCP Tools",
    name: "policyMcpTools",
    displayOptions: { show: { policyMode: ["custom"] } },
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    description: "One MCP tool pattern per line",
  },
  {
    displayName: "Allowed Commands",
    name: "policyCommands",
    displayOptions: { show: { policyMode: ["custom"] } },
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    description:
      "One command per line: exact commands for Claude and OpenClaw, command prefixes for Codex and OpenCode; Cursor ignores this field",
  },
  {
    displayName: "Auto-Delete",
    name: "autoDeleteEnabled",
    type: "boolean",
    default: false,
  },
  {
    displayName: "Delete After",
    name: "autoDeleteAmount",
    type: "number",
    default: 24,
    typeOptions: { minValue: 0.1 },
    displayOptions: { show: { autoDeleteEnabled: [true] } },
  },
  {
    displayName: "Delete After Unit",
    name: "autoDeleteUnit",
    type: "options",
    options: [
      { name: "Hours", value: "hours" },
      { name: "Days", value: "days" },
    ],
    default: "hours",
    displayOptions: { show: { autoDeleteEnabled: [true] } },
  },
  {
    displayName: "Delete Countdown Starts",
    name: "autoDeleteFrom",
    type: "options",
    options: [
      { name: "Session Start", value: "start" },
      { name: "Last Activity", value: "lastActivity" },
    ],
    default: "lastActivity",
    displayOptions: {
      show: { autoDeleteEnabled: [true], mode: ["Interactive", "Autonomous"] },
    },
  },
  {
    displayName: "Delete Countdown Starts",
    name: "autoDeleteFrom",
    type: "options",
    options: [{ name: "Session Start", value: "start" }],
    default: "start",
    displayOptions: {
      show: { autoDeleteEnabled: [true], mode: ["Scheduled"] },
    },
  },
  {
    displayName: "Account Failover",
    name: "accountFailover",
    type: "options",
    options: [
      { name: "Automatic", value: "auto" },
      { name: "Off", value: "off" },
    ],
    default: "auto",
  },
  {
    displayName: "Custom MCP Configuration Enabled",
    name: "customMcpEnabled",
    type: "boolean",
    default: false,
  },
  {
    displayName: "Custom MCP Configuration",
    name: "mcpConfigJson",
    displayOptions: { show: { customMcpEnabled: [true] } },
    type: "json",
    default: "",
    description:
      "Optional MCP JSON configuration; saved server selections do not require JSON",
  },
  {
    displayName: "API Specification URL",
    name: "ephemeralSpecUrl",
    type: "string",
    default: "",
    description:
      "Optional OpenAPI or GraphQL specification to expose as a session MCP source",
  },
  {
    displayName: "API Source Name",
    name: "ephemeralName",
    type: "string",
    default: "",
  },
  {
    displayName: "Save API Source to Library",
    name: "ephemeralSaveToLibrary",
    type: "boolean",
    default: false,
  },
].map((field) => ({
  ...field,
  description: help[field.name] ?? field.description,
  displayOptions: { show: { ...show, ...field.displayOptions?.show } },
})) as INodeProperties[];
