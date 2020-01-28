/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronRpcConfiguration, OidcDesktopClientConfiguration } from "@bentley/imodeljs-common";
import { OidcDesktopClientRenderer, OidcBrowserClient, FrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { OidcFrontendClientConfiguration, IOidcFrontendClient } from "@bentley/imodeljs-clients";

export class OidcClientHelper {
  private static _oidcClient: IOidcFrontendClient;

  public static get oidcClient() { return this._oidcClient; }

  public static get redirectUri(): string {
    return "http://localhost:3000/signin-callback";
  }

  public static async initializeOidc() {
    const scope = "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party";
    if (ElectronRpcConfiguration.isElectron) {
      const clientId = "imodeljs-electron-test";
      const redirectUri = this.redirectUri;
      const oidcConfiguration: OidcDesktopClientConfiguration = { clientId, redirectUri, scope: scope + " offline_access" };
      this._oidcClient = new OidcDesktopClientRenderer(oidcConfiguration);
    } else {
      // We are running in a web context
      const clientId = "imodeljs-spa-test";
      const redirectUri = this.redirectUri;
      const postSignoutRedirectUri = "http://localhost:3000/";
      const oidcConfiguration: OidcFrontendClientConfiguration = { clientId, redirectUri, postSignoutRedirectUri, scope: scope + " imodeljs-router", responseType: "code" };
      this._oidcClient = new OidcBrowserClient(oidcConfiguration);
    }

    const requestContext = new FrontendRequestContext();
    await this._oidcClient.initialize(requestContext);

    IModelApp.authorizationClient = this._oidcClient;
  }

  public static shutdown() {
    if (this._oidcClient !== undefined)
      this._oidcClient.dispose();
  }
}
