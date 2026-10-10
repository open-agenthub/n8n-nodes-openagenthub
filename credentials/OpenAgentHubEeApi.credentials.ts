import type {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";
export class OpenAgentHubEeApi implements ICredentialType {
  name = "openAgentHubEeApi";
  displayName = "OpenAgentHub User Access Token API";
  icon = "file:openagenthub.svg" as const;
  documentationUrl = "https://github.com/open-agenthub/open-agenthub";
  properties: INodeProperties[] = [
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "",
      required: true,
    },
    {
      displayName: "OIDC Access Token",
      name: "token",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "User JWT access token; personal oah_ tokens do not work on these routes. Refresh expired tokens manually.",
    },
    {
      displayName: "Allow HTTP for Local Development",
      name: "allowLocalHttp",
      type: "boolean",
      default: false,
      description:
        "Whether to allow unencrypted HTTP to localhost, 127.0.0.1 or ::1 only. Leave disabled for hosted AgentHub instances. In Docker, localhost refers to the n8n container.",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: { Authorization: "=Bearer {{$credentials.token}}" },
    },
  };
}
