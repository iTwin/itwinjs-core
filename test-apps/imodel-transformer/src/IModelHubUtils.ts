/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:words buddi urlps

import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { ElectronAuthorizationBackend } from "@bentley/electron-manager/lib/ElectronBackend";
import { NativeHost } from "@bentley/imodeljs-backend";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";

export namespace IModelHubUtils {

  export async function getAuthorizedClientRequestContext(): Promise<AuthorizedClientRequestContext> {
    const accessToken = await signIn();
    return new AuthorizedClientRequestContext(accessToken);
  }

  async function signIn(): Promise<AccessToken> {
    const client = new ElectronAuthorizationBackend();
    const requestContext = new ClientRequestContext();
    await client.initialize(requestContext, {
      clientId: "imodeljs-electron-test",
      redirectUri: "http://localhost:3000/signin-callback",
      scope: "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party imodel-extension-service-api offline_access",
    });
    return new Promise<AccessToken>((resolve, reject) => {
      NativeHost.onUserStateChanged.addListener((token) => {
        if (token !== undefined) {
          resolve(token);
        } else {
          reject(new Error("Failed to sign in"));
        }
      });
      client.signIn().catch((error: Error) => reject(error));
    });
  }

  export function setHubEnvironment(arg?: string): void {
    let value = "0";
    if ("qa" === arg) {
      value = "102";
    } else if ("dev" === arg) {
      value = "103";
    }
    Config.App.set("imjs_buddi_resolve_url_using_region", value);
  }

  // async function downloadBriefcase():
}

