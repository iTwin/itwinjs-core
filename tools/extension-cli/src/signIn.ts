/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcDesktopClient } from "@bentley/imodeljs-backend";

export async function signIn(): Promise<AccessToken> {
  const clientId = "imodeljs-extension-publisher";
  const redirectUri = "http://localhost:5001/signin-oidc";
  const requestContext: ClientRequestContext = new ClientRequestContext();
  const client = new OidcDesktopClient({
    clientId,
    redirectUri,
    scope: "openid imodel-extension-service-api context-registry-service:read-only offline_access",
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
