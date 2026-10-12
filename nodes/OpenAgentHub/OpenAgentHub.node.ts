import {
  NodeOperationError,
  NodeConnectionTypes,
  VersionedNodeType,
} from "n8n-workflow";
import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import {
  messageBody,
  objectJson,
  request,
  segment,
  testApiCredential,
} from "./transport";

import { sessionFields } from "./sessionFields";
import { buildSessionPayload } from "./sessionPayload";
import { loadOptions } from "./discovery";

const remoteOperations = [
  "create",
  "get",
  "list",
  "stop",
  "resume",
  "delete",
  "sendMessage",
  "transcript",
];
class OpenAgentHubVersion implements INodeType {
  constructor(version: 1 | 2) {
    this.description = {
      ...this.description,
      version,
      credentials:
        version === 1
          ? [
              {
                name: "openAgentHubApi",
                required: true,
                testedBy: "testApiCredential",
                displayOptions: { show: { operation: remoteOperations } },
              },
              {
                name: "openAgentHubEeApi",
                required: true,
                testedBy: "testApiCredential",
                displayOptions: { hide: { operation: remoteOperations } },
              },
            ]
          : [
              {
                name: "openAgentHubApi",
                required: false,
                testedBy: "testApiCredential",
                displayOptions: { show: { operation: remoteOperations } },
              },
              {
                name: "openAgentHubEeApi",
                required: false,
                testedBy: "testApiCredential",
                displayOptions: {
                  show: {
                    operation: [
                      "create",
                      "conversation",
                      "messages",
                      "update",
                      "switchCredential",
                      "shares",
                      "shareUser",
                      "shareLink",
                      "revokeUser",
                      "revokeLink",
                    ],
                  },
                },
              },
            ],
    };
  }
  methods = { credentialTest: { testApiCredential }, loadOptions };
  description: INodeTypeDescription = {
    usableAsTool: true,
    icon: { light: "file:openagenthub.png", dark: "file:openagenthub.png" },
    subtitle: "OpenAgentHub sessions and messages",
    displayName: "OpenAgentHub",
    name: "openAgentHub",
    group: ["transform"],
    version: 2,
    defaultVersion: 2,
    description: "Manage agent sessions, messages and Enterprise sharing",
    defaults: { name: "OpenAgentHub" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "create",
        options: [
          {
            name: "Create Session",
            value: "create",
            action: "Create a session",
          },
          {
            name: "Create Share Link (Enterprise)",
            value: "shareLink",
            action: "Create a session share link",
          },
          {
            name: "Delete Session",
            value: "delete",
            action: "Delete a session permanently",
          },
          {
            name: "Get Conversation (Integration)",
            value: "conversation",
            action: "Read structured conversation data",
          },
          {
            name: "Get Recent Messages",
            value: "messages",
            action: "Get the latest twenty agent messages",
          },
          { name: "Get Session", value: "get", action: "Get a session" },
          {
            name: "Get Transcript",
            value: "transcript",
            action: "Read a transcript page",
          },
          { name: "List Sessions", value: "list", action: "List sessions" },
          {
            name: "List Shares (Enterprise)",
            value: "shares",
            action: "List session shares",
          },
          {
            name: "Resume Session",
            value: "resume",
            action: "Resume a session",
          },
          {
            name: "Revoke Share Link (Enterprise)",
            value: "revokeLink",
            action: "Revoke a share link",
          },
          {
            name: "Revoke User Share (Enterprise)",
            value: "revokeUser",
            action: "Revoke a user share",
          },
          {
            name: "Send Message",
            value: "sendMessage",
            action: "Send a message to a session",
          },
          {
            name: "Share With User (Enterprise)",
            value: "shareUser",
            action: "Share a session with a user",
          },
          {
            name: "Stop (Pause) Session",
            value: "stop",
            action: "Pause a session and preserve state",
          },
          {
            name: "Switch Credential (Integration)",
            value: "switchCredential",
            action: "Switch the live provider credential",
          },
          {
            name: "Update Session",
            value: "update",
            action: "Update session settings",
          },
        ],
      },
      {
        displayName: "AgentHub Authentication",
        name: "creationAuthentication",
        type: "options",
        noDataExpression: true,
        default: "personal",
        options: [
          {
            name: "Personal API Token",
            value: "personal",
            description:
              "Saved login and Git-token selection; enter repositories and catalog IDs manually",
          },
          {
            name: "User Access Token",
            value: "user",
            description:
              "Browse connected Git accounts, repositories, projects and MCP servers like the AgentHub UI",
          },
        ],
        displayOptions: { show: { operation: ["create"], "@version": [2] } },
      },
      {
        displayName:
          "For creation, configure only the credential selected by AgentHub Authentication. Other operations use the credential for their API. A missing selected credential is reported when the node runs.",
        name: "creationCredentialsNotice",
        type: "notice",
        default: "",
        displayOptions: { show: { operation: ["create"], "@version": [2] } },
      },
      ...sessionFields,
      {
        displayName: "System Prompt",
        name: "systemPrompt",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        description:
          "Standing instructions appended to the agent system prompt",
        displayOptions: { show: { operation: ["create"], "@version": [2] } },
      },
      {
        displayName: "Container and Resources",
        name: "container",
        type: "collection",
        default: {},
        placeholder: "Add Option",
        options: [
          {
            displayName: "Auto Approve",
            name: "autoApprove",
            type: "boolean",
            default: false,
            description: "Whether to approve tool requests automatically",
          },
          {
            displayName: "Container Image",
            name: "image",
            type: "string",
            default: "",
            description: "Leave empty to use the default image for the harness",
          },
          { displayName: "CPU", name: "cpu", type: "string", default: "500m" },
          {
            displayName: "Memory",
            name: "memory",
            type: "string",
            default: "1Gi",
          },
          {
            displayName: "Parent Session ID",
            name: "parentSessionId",
            type: "string",
            default: "",
          },
          {
            displayName: "Run as Root",
            name: "runAsRoot",
            type: "boolean",
            default: false,
            description: "Whether to run as root inside the session container",
          },
        ],
        displayOptions: { show: { operation: ["create"], "@version": [2] } },
      },
      {
        displayName: "Session ID",
        name: "sessionId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { hide: { operation: ["create", "list"] } },
      },
      {
        displayName: "Session Settings (JSON)",
        name: "settings",
        type: "json",
        default: "{}",
        description:
          "Create/update request. Supports systemPrompt, credentialId (integration), repos, policy, MCP sources, projectId and parentSessionId. Use credential IDs instead of secrets.",
        displayOptions: { show: { operation: ["update"] } },
      },
      {
        displayName: "Session Settings (JSON)",
        name: "settings",
        type: "json",
        default: "{}",
        displayOptions: { show: { operation: ["create"], "@version": [1] } },
      },
      {
        displayName: "Message",
        name: "message",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { operation: ["sendMessage"] } },
      },
      {
        displayName: "Offset",
        name: "offset",
        type: "number",
        typeOptions: { minValue: 0 },
        default: 0,
        displayOptions: { show: { operation: ["transcript", "conversation"] } },
      },
      {
        displayName: "Page Size",
        name: "pageSize",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 1000000 },
        default: 1000,
        description:
          "Transcript characters, or conversation entries (maximum 5000)",
        displayOptions: { show: { operation: ["transcript", "conversation"] } },
      },
      {
        displayName: "Credential ID",
        name: "credentialId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["switchCredential"] } },
      },
      {
        displayName: "Recipient",
        name: "recipient",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["shareUser", "revokeUser"] } },
      },
      {
        displayName: "Role",
        name: "role",
        type: "options",
        default: "viewer",
        options: [
          { name: "Viewer", value: "viewer" },
          { name: "Collaborator", value: "collaborator" },
        ],
        displayOptions: { show: { operation: ["shareUser", "shareLink"] } },
      },
      {
        displayName: "Expires At",
        name: "expiresAt",
        type: "string",
        default: "",
        placeholder: "2026-12-31T23:59:59Z",
        description:
          "Optional ISO 8601 expiry. Empty creates a link without an expiry.",
        displayOptions: { show: { operation: ["shareLink"] } },
      },
      {
        displayName: "Link ID",
        name: "linkId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["revokeLink"] } },
      },
      {
        displayName: "Confirm Deletion",
        name: "confirmDelete",
        type: "boolean",
        default: false,
        description:
          "Whether to permanently delete this session and its associated resources",
        displayOptions: { show: { operation: ["delete"] } },
      },
    ],
  };
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let i = 0; i < this.getInputData().length; i++) {
      try {
        const op = this.getNodeParameter("operation", i) as string;
        const nativeCreate = op === "create" && this.getNode().typeVersion >= 2;
        const authentication = nativeCreate
          ? this.getNodeParameter("creationAuthentication", i, "personal")
          : "personal";
        if (authentication !== "personal" && authentication !== "user")
          throw new NodeOperationError(
            this.getNode(),
            "Choose a supported AgentHub authentication method",
          );
        const credential =
          nativeCreate && authentication === "user"
            ? "openAgentHubEeApi"
            : remoteOperations.includes(op)
              ? "openAgentHubApi"
              : "openAgentHubEeApi";
        const prefix =
          credential === "openAgentHubApi"
            ? "/api/remote/sessions"
            : "/api/sessions";
        const id = ["create", "list"].includes(op)
          ? ""
          : segment(this.getNodeParameter("sessionId", i));
        let method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
        let path = prefix + (id ? `/${id}` : "");
        let body: IDataObject | undefined;
        let qs: IDataObject | undefined;
        switch (op) {
          case "create":
          case "update":
            method = op === "create" ? "POST" : "PATCH";
            body = nativeCreate
              ? buildSessionPayload(this, i)
              : objectJson(this.getNodeParameter("settings", i));
            if (op === "create")
              body = { autoApprove: false, runAsRoot: false, ...body };
            break;
          case "stop":
          case "resume":
            method = "POST";
            path += op === "stop" ? "/pause" : "/resume";
            break;
          case "delete":
            if (this.getNodeParameter("confirmDelete", i) !== true)
              throw new NodeOperationError(
                this.getNode(),
                "Enable Confirm Deletion to delete a session",
              );
            method = "DELETE";
            break;
          case "sendMessage":
            method = "POST";
            path += "/messages";
            body = { body: messageBody(this.getNodeParameter("message", i)) };
            break;
          case "transcript":
          case "conversation": {
            path += `/${op}`;
            const offset = Number(this.getNodeParameter("offset", i));
            const size = Number(this.getNodeParameter("pageSize", i));
            if (
              !Number.isSafeInteger(offset) ||
              offset < 0 ||
              offset > 2147483647 ||
              !Number.isSafeInteger(size) ||
              size < 1 ||
              size > (op === "conversation" ? 5000 : 1000000)
            )
              throw new NodeOperationError(
                this.getNode(),
                "Invalid pagination bounds",
              );
            qs = { offset, [op === "conversation" ? "max" : "maxChars"]: size };
            break;
          }
          case "messages":
            path += "/messages";
            break;
          case "switchCredential":
            method = "PATCH";
            path += "/credential";
            body = {
              credentialId: this.getNodeParameter("credentialId", i) as string,
            };
            break;
          case "shares":
          case "shareUser":
          case "shareLink":
          case "revokeUser":
          case "revokeLink":
            path = `/api/ee/sessions/${id}/shares`;
            if (op === "shareUser") {
              method = "POST";
              path += "/users";
              body = {
                recipient: this.getNodeParameter("recipient", i) as string,
                role: this.getNodeParameter("role", i) as string,
              };
            }
            if (op === "shareLink") {
              method = "POST";
              path += "/links";
              const expiry = this.getNodeParameter("expiresAt", i) as string;
              if (
                expiry &&
                (!/^\d{4}-\d\d-\d\dT/.test(expiry) ||
                  !Number.isFinite(Date.parse(expiry)))
              )
                throw new NodeOperationError(
                  this.getNode(),
                  "Expiry must be an ISO 8601 date",
                );
              body = {
                role: this.getNodeParameter("role", i) as string,
                expiresAt: expiry || null,
              };
            }
            if (op === "revokeUser") {
              method = "DELETE";
              path +=
                "/users/" + segment(this.getNodeParameter("recipient", i));
            }
            if (op === "revokeLink") {
              method = "DELETE";
              path += "/links/" + segment(this.getNodeParameter("linkId", i));
            }
            break;
          case "get":
          case "list":
            break;
          default:
            throw new NodeOperationError(
              this.getNode(),
              "Unsupported operation",
            );
        }
        const result = await request(this, credential, method, path, body, qs);
        const rows = Array.isArray(result)
          ? result
          : [
              result === undefined || result === null || result === ""
                ? { success: true }
                : result,
            ];
        if (
          rows.some(
            (row) => !row || typeof row !== "object" || Array.isArray(row),
          )
        )
          throw new NodeOperationError(this.getNode(), "Invalid API response");
        for (const row of rows)
          output.push({ json: row as IDataObject, pairedItem: { item: i } });
      } catch (error) {
        const safeError = new NodeOperationError(
          this.getNode(),
          error as Error,
          { itemIndex: i },
        );
        if (!this.continueOnFail()) throw safeError;
        output.push({
          json: { error: (error as Error).message },
          pairedItem: { item: i },
        });
      }
    }
    return [output];
  }
}

export class OpenAgentHub extends VersionedNodeType {
  constructor() {
    const versions = {
      1: new OpenAgentHubVersion(1),
      2: new OpenAgentHubVersion(2),
    };
    const description = versions[2].description;
    super(versions, {
      displayName: description.displayName,
      name: description.name,
      group: description.group,
      description: description.description,
      icon: description.icon,
      defaultVersion: 2,
    });
  }
}
