/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { IModelApp  } from "@itwin/core-frontend";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { AccessToken, ProcessDetector } from "@itwin/core-bentley";
import { getConfigurationString } from "./DisplayTestApp";

// Wraps the signIn process
// @return Promise that resolves to true after signIn is complete
export async function signIn(): Promise<boolean> {
  const existingAuthClient = IModelApp.authorizationClient;
  if (undefined !== existingAuthClient && (existingAuthClient instanceof BrowserAuthorizationClient || existingAuthClient instanceof ElectronRendererAuthorization)) {
    if (existingAuthClient.isAuthorized) {
      return (await existingAuthClient.getAccessToken()) !== undefined;
    }

    return new Promise<boolean>((resolve, reject) => {
      existingAuthClient.onAccessTokenChanged.addOnce((token: AccessToken) => resolve(!!token));
      existingAuthClient.signIn().catch((err) => reject(err));
    });
  }

  let authClient: ElectronRendererAuthorization | BrowserAuthorizationClient | undefined;
  if (ProcessDetector.isElectronAppFrontend) {
    authClient = new ElectronRendererAuthorization();
  } else if (ProcessDetector.isMobileAppFrontend) {
    // The default auth client works on mobile
    const accessToken = await IModelApp.authorizationClient?.getAccessToken();
    return !!accessToken;
  } else {
    const clientId = getConfigurationString("oidcClientId") ?? "imodeljs-spa-test";
    const redirectUri = getConfigurationString("oidcRedirectUri") ?? "http://localhost:3000/signin-callback";
    const scope = getConfigurationString("oidcScope") ?? "projects:read realitydata:read imodels:read imodels:modify imodelaccess:read";
    const responseType = "code";
    authClient = new BrowserAuthorizationClient({
      clientId,
      redirectUri,
      scope,
      responseType,
    });
    try {
      await authClient.signInSilent();
    } catch (err) { }
  }

  if (typeof authClient === "undefined") {
    return false;
  } else {
    IModelApp.authorizationClient = authClient;
    if (authClient.isAuthorized)
      return true;

    return new Promise<boolean>((resolve, reject) => {
      authClient!.onAccessTokenChanged.addOnce((token: AccessToken) => resolve(!!token));
      authClient!.signIn().catch((err) => reject(err));
    });
  }
}

export async function signOut(): Promise<void> {
  const auth = IModelApp.authorizationClient;
  if (auth instanceof ElectronRendererAuthorization || auth instanceof BrowserAuthorizationClient){
    await auth.signOut();
    IModelApp.authorizationClient = undefined;
  }
}
