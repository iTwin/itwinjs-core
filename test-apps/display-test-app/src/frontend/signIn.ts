/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { IModelApp  } from "@itwin/core-frontend";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { AccessToken, ProcessDetector } from "@itwin/core-bentley";

// Wraps the signIn process
// @return Promise that resolves to true after signIn is complete
export async function signIn(): Promise<boolean> {
  const existingAuthClient = IModelApp.authorizationClient;
  if (undefined !== existingAuthClient && (existingAuthClient instanceof BrowserAuthorizationClient || existingAuthClient instanceof ElectronRendererAuthorization)) {
    if (existingAuthClient.isAuthorized) {
      return (await existingAuthClient.getAccessToken()) !== undefined;
    }

    return new Promise<boolean>((resolve, reject) => {
      existingAuthClient.onAccessTokenChanged.addOnce((token: AccessToken) => resolve(token !== ""));
      existingAuthClient.signIn().catch((err) => reject(err));
    });
  }

  let authClient: ElectronRendererAuthorization | BrowserAuthorizationClient;
  if (ProcessDetector.isElectronAppFrontend) {
    authClient = new ElectronRendererAuthorization();
  } else {
    authClient = new BrowserAuthorizationClient({
      clientId: "imodeljs-spa-test",
      redirectUri: "http://localhost:3000/signin-callback",
      scope: "openid email profile organization itwinjs",
      responseType: "code",
    });
    try {
      await authClient.signInSilent();
    } catch (err) { }
  }

  IModelApp.authorizationClient = authClient;
  if (authClient.isAuthorized)
    return true;

  return new Promise<boolean>((resolve, reject) => {
    authClient.onAccessTokenChanged.addOnce((token: AccessToken) => resolve(token !== ""));
    authClient.signIn().catch((err) => reject(err));
  });
}

export async function signOut(): Promise<void> {
  const auth = IModelApp.authorizationClient;
  if (auth instanceof ElectronRendererAuthorization || auth instanceof BrowserAuthorizationClient){
    await auth.signOut();
    IModelApp.authorizationClient = undefined;
  }
}
