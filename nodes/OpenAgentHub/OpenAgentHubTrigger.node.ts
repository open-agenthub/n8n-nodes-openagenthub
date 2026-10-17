import {
  NodeConnectionTypes,
  NodeOperationError,
  OperationalError,
} from "n8n-workflow";
import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IPollFunctions,
} from "n8n-workflow";
import { baseUrl, request, segment, testApiCredential } from "./transport";

export function selectMessages(
  rows: IDataObject[],
  seen: string[],
  initialized: boolean,
  includeExisting: boolean,
): { fresh: IDataObject[]; seen: string[] } {
  if (rows.some((row) => typeof row.id !== "string"))
    throw new OperationalError("Invalid message response");
  const previous = new Set(seen);
  const fresh =
    !initialized && !includeExisting
      ? []
      : rows.filter((row) => !previous.has(row.id as string));
  return {
    fresh: fresh.reverse(),
    seen: [...new Set([...seen, ...rows.map((row) => row.id as string)])].slice(
      -200,
    ),
  };
}
export class OpenAgentHubTrigger implements INodeType {
  methods = { credentialTest: { testApiCredential } };
  description: INodeTypeDescription = {
    icon: { light: "file:openagenthub.png", dark: "file:openagenthub.png" },
    subtitle: "OpenAgentHub sessions and messages",
    displayName: "OpenAgentHub Legacy JWT Trigger",
    name: "openAgentHubTrigger",
    group: ["trigger"],
    version: 1,
    description:
      "Poll the latest 20 messages of an existing session using a user JWT",
    defaults: { name: "OpenAgentHub Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    polling: true,
    credentials: [
      {
        name: "openAgentHubEeApi",
        required: true,
        testedBy: "testApiCredential",
      },
    ],
    properties: [
      {
        displayName: "Session ID",
        name: "sessionId",
        type: "string",
        default: "",
        required: true,
      },
      {
        displayName: "Include Existing Messages",
        name: "includeExisting",
        type: "boolean",
        default: false,
        description:
          "Whether to emit existing messages on the first poll. Only the latest 20 are available; messages between polls can be missed.",
      },
    ],
  };
  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const id = segment(this.getNodeParameter("sessionId"));
    const rows = await request(
      this,
      "openAgentHubEeApi",
      "GET",
      `/api/sessions/${id}/messages`,
    );
    if (!Array.isArray(rows))
      throw new NodeOperationError(this.getNode(), "Invalid message response");
    const state = this.getWorkflowStaticData("node");
    const credentials = await this.getCredentials("openAgentHubEeApi");
    const credentialId =
      this.getNode().credentials?.openAgentHubEeApi?.id ?? "";
    const key = `messages:${baseUrl(credentials.baseUrl, credentials.allowLocalHttp)}:${credentialId}:${id}`;
    const stored = state[key] as
      | { seen: string[]; initialized: boolean }
      | undefined;
    const selection = selectMessages(
      rows as IDataObject[],
      stored?.seen ?? [],
      stored?.initialized ?? false,
      this.getNodeParameter("includeExisting") === true,
    );
    state[key] = { seen: selection.seen, initialized: true };
    return selection.fresh.length
      ? [selection.fresh.map((json) => ({ json }))]
      : null;
  }
}
