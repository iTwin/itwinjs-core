/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AccessToken, Logger, LogLevel } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, OpenAPIInfo } from "@itwin/core-common";
import { NoRenderApp } from "@itwin/core-frontend";
import { getServiceAuthTokenFromBackend, TestFrontendAuthorizationClient } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";
import { getRpcInterfaces, Settings } from "../../common/Settings";
import { getClientAccessTokenFromBackend, getProcessEnvFromBackend } from "../../common/SideChannels";
import { IModelSession } from "./IModelSession";

declare const PACKAGE_VERSION: string;

/* eslint-disable no-console */
export class TestContext {
  public clientAccessToken?: AccessToken;
  public serviceAuthToken!: AccessToken;

  public iModelWithChangesets?: IModelSession;
  public iModelForWrite?: IModelSession;
  public iTwinId?: string;

  public settings: Settings;

  private constructor(env: NodeJS.ProcessEnv) {
    this.settings = new Settings(env);
  }
  private static _instance?: TestContext = undefined;

  public static async instance(): Promise<TestContext> {
    if (this._instance === undefined) {
      this._instance = new TestContext(await getProcessEnvFromBackend());
      await this._instance.initialize();
    }
    return this._instance;
  }

  /** Initialize configuration for the rpc interfaces used by the application. */
  private initializeRpcInterfaces(info: OpenAPIInfo) { // eslint-disable-line @typescript-eslint/no-deprecated
    // Url without trailing slash
    const uriPrefix: string = this.settings.Backend.location.replace(/\/$/, "");
    BentleyCloudRpcManager.initializeClient({ info, uriPrefix }, getRpcInterfaces(this.settings));
  }

  private async initialize() {
    expect(this.settings.users.length).to.be.gte(1, `Unexpected number of users found in settings - got ${this.settings.users.length}, expected at least 2`);
    expect(this.settings.iModels.length).to.be.gte(1, `Unexpected number of iModels found in settings - got ${this.settings.iModels.length}, expected at least 1`);

    // Print out the configuration
    console.log(this.settings.toString());

    // Configure iTwin.js frontend logging to go to the console
    Logger.initializeToConsole();
    Logger.setLevelDefault(this.settings.logLevel === undefined ? LogLevel.Warning : this.settings.logLevel);

    if (this.settings?.clientConfiguration && this.settings.clientConfiguration.clientId) {
      this.serviceAuthToken = await getServiceAuthTokenFromBackend({
        clientId: this.settings.clientConfiguration.clientId,
        clientSecret: this.settings.clientConfiguration.clientSecret,
        scope: this.settings.clientConfiguration.scope,
        authority: `https://${
          process.env.IMJS_URL_PREFIX === "dev-"
            ? "qa-"
            : process.env.IMJS_URL_PREFIX ?? ""
        }ims.bentley.com`,
      });
    }

    if (undefined !== this.settings.clientConfiguration)
      this.clientAccessToken = await getClientAccessTokenFromBackend();

    this.initializeRpcInterfaces({ title: this.settings.Backend.name, version: this.settings.Backend.version });

    const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
    await NoRenderApp.startup({
      applicationVersion: PACKAGE_VERSION,
      applicationId: this.settings.gprid,
      authorizationClient: new TestFrontendAuthorizationClient(this.serviceAuthToken),
      hubAccess: new FrontendIModelsAccess(iModelClient),
    });

    this.iModelWithChangesets = await IModelSession.create(this.serviceAuthToken, this.settings.iModel);

    this.iTwinId = this.iModelWithChangesets.iTwinId;

    if (this.settings.runiModelWriteRpcTests)
      this.iModelForWrite = await IModelSession.create(this.serviceAuthToken, this.settings.writeIModel);

  }
}
