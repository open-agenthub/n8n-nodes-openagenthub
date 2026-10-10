import { NodeOperationError, NodeConnectionTypes } from "n8n-workflow";
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
export class OpenAgentHub implements INodeType {
  methods = { credentialTest: { testApiCredential } };
  description: INodeTypeDescription = {
    usableAsTool: true,
    icon: { light: "file:openagenthub.svg", dark: "file:openagenthub.svg" },
    subtitle: "OpenAgentHub sessions and messages",
    displayName: "OpenAgentHub",
    name: "openAgentHub",
    group: ["transform"],
    version: 1,
    description: "Manage agent sessions, messages and Enterprise sharing",
    defaults: { name: "OpenAgentHub" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
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
    ],
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
        displayOptions: { show: { operation: ["create", "update"] } },
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
        const credential = remoteOperations.includes(op)
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
            body = objectJson(this.getNodeParameter("settings", i));
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
