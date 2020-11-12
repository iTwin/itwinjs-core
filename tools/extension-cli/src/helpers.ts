/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/itwin-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { DesktopAuthorizationClient } from "@bentley/imodeljs-backend";
import { ExtensionProps } from "@bentley/extension-client";

export async function signIn(): Promise<AccessToken> {
  const clientId = "imodeljs-extension-publisher";
  const redirectUri = "http://localhost:5001/signin-oidc";
  const requestContext: ClientRequestContext = new ClientRequestContext();
  const client = new DesktopAuthorizationClient({
    clientId,
    redirectUri,
    scope: "openid imodel-extension-service-api context-registry-service:read-only offline_access imodel-extension-service:modify",
  });
  await client.initialize(requestContext);
  return new Promise<AccessToken>((resolve, reject) => {
    client.onUserStateChanged.addListener((token) => {
      if (token !== undefined) {
        resolve(token);
      } else {
        reject(new Error("Failed to sign in"));
      }
    });
    client.signIn(requestContext).catch((err) => reject(err));
  });
}

export function prettyPrint(extensions: ExtensionProps[]): string {
  let result: string = "";
  for (const extension of extensions) {
    result += `    Name:        ${extension.extensionName}
    Version:     ${extension.version}
    Context ID:  ${extension.contextId}
    Uploaded by: ${extension.uploadedBy}
    Uploaded at: ${extension.timestamp.toLocaleString()}
    Status:      ${extension.status.status}\n\n`;
  }
  return result.slice(0, -2);
}
