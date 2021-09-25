/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@bentley/imodeljs-frontend";
import { BrowserAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessToken } from "@bentley/bentleyjs-core";

// Wraps the signIn process
// @return Promise that resolves to true after signIn is complete
export async function signIn(): Promise<boolean> {
  const auth = IModelApp.authorizationClient;
  if (undefined !== auth)
    return (await auth.getAccessToken()) !== undefined;

  const browserAuth = new BrowserAuthorizationClient({
    clientId: "imodeljs-spa-test",
    redirectUri: "http://localhost:3000/signin-callback",
    scope: "openid email profile organization itwinjs",
    responseType: "code",
  });
  try {
    await browserAuth.signInSilent();
  } catch (err) { }

  IModelApp.authorizationClient = browserAuth;

  if (browserAuth.isAuthorized)
    return true;

  return new Promise<boolean>((resolve, reject) => {
    browserAuth.onUserStateChanged.addOnce((token?: AccessToken) => resolve(token !== undefined));
    browserAuth.signIn().catch((err) => reject(err));
  });
}
