import type {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";
export class OpenAgentHubApi implements ICredentialType {
  name = "openAgentHubApi";
  displayName = "OpenAgentHub Personal API";
  icon = "file:openagenthub.svg" as const;
  documentationUrl = "https://github.com/open-agenthub/open-agenthub";
  properties: INodeProperties[] = [
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "",
      placeholder: "https://agenthub.example.com",
      required: true,
    },
    {
      displayName: "Personal API Token",
      name: "token",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "An oah_ personal API token from OpenAgentHub",
    },
    {
      displayName: "Allow Local HTTP",
      name: "allowLocalHttp",
      type: "boolean",
      default: false,
      description:
        "Whether to allow unencrypted HTTP on localhost only for development",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: { Authorization: "=Bearer {{$credentials.token}}" },
    },
  };
}
