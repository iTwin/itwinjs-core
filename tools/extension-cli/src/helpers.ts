/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/itwin-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { ElectronAuthorizationBackend } from "@bentley/electron-manager/lib/ElectronBackend";
import { ExtensionProps } from "@bentley/extension-client";
import { NativeHost } from "@bentley/imodeljs-backend";

export async function signIn(): Promise<AccessToken> {
  const clientId = "imodeljs-extension-publisher";
  const redirectUri = "http://localhost:5001/signin-oidc";
  const requestContext = new ClientRequestContext();
  const client = new ElectronAuthorizationBackend();
  await client.initialize(requestContext, {
    clientId,
    redirectUri,
    scope: "openid imodel-extension-service-api context-registry-service:read-only offline_access imodel-extension-service:modify",
  });
  return new Promise<AccessToken>((resolve, reject) => {
    NativeHost.onUserStateChanged.addListener((token) => {
      if (token !== undefined) {
        resolve(token);
      } else {
        reject(new Error("Failed to sign in"));
      }
    });
    client.signIn().catch((err) => reject(err));
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
