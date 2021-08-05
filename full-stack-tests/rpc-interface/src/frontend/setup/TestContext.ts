/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BentleyCloudRpcManager, OpenAPIInfo } from "@bentley/imodeljs-common";
import { AuthorizedFrontendRequestContext, NoRenderApp } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";
import {
  getAccessTokenFromBackend, TestBrowserAuthorizationClientConfiguration, TestFrontendAuthorizationClient, TestUserCredentials,
} from "@bentley/oidc-signin-tool/lib/frontend";
import { getRpcInterfaces, Settings } from "../../common/Settings";
import { getClientAccessTokenFromBackend, getProcessEnvFromBackend } from "../../common/SideChannels";
import { IModelSession } from "./IModelSession";

declare const PACKAGE_VERSION: string;

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/indent */

export class TestContext {
  public adminUserAccessToken!: AccessToken;
  public clientAccessToken?: AccessToken;

  public iModelWithChangesets?: IModelSession;
  public iModelForWrite?: IModelSession;
  public contextId?: string;

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
  private initializeRpcInterfaces(info: OpenAPIInfo) {
    // Url without trailing slash
    const uriPrefix: string = this.settings.Backend.location.replace(/\/$/, "");
    BentleyCloudRpcManager.initializeClient({ info, uriPrefix }, getRpcInterfaces(this.settings));
  }

  private async initialize() {
    expect(this.settings.users.length).to.be.gte(1, `Unexpected number of users found in settings - got ${this.settings.users.length}, expected at least 2`);
    expect(this.settings.iModels.length).to.be.gte(1, `Unexpected number of iModels found in settings - got ${this.settings.iModels.length}, expected at least 1`);

    // Print out the configuration
    console.log(this.settings.toString());

    // Configure iModel.js frontend logging to go to the console
    Logger.initializeToConsole();
    Logger.setLevelDefault(this.settings.logLevel === undefined ? LogLevel.Warning : this.settings.logLevel);

    // Setup environment
    Config.App.set("imjs_buddi_resolve_url_using_region", this.settings.env);

    if (undefined !== this.settings.oidcClientId) {
      this.adminUserAccessToken = await getAccessTokenFromBackend({
        email: this.settings.users[0].email,
        password: this.settings.users[0].password,
      } as TestUserCredentials, {
        clientId: this.settings.oidcClientId,
        redirectUri: this.settings.oidcRedirect,
        scope: this.settings.oidcScopes,
      } as TestBrowserAuthorizationClientConfiguration);
    }

    if (undefined !== this.settings.clientConfiguration)
      this.clientAccessToken = await getClientAccessTokenFromBackend(this.settings.clientConfiguration);

    this.initializeRpcInterfaces({ title: this.settings.Backend.name, version: this.settings.Backend.version });

    await NoRenderApp.startup({
      applicationVersion: PACKAGE_VERSION,
      applicationId: this.settings.gprid,
      authorizationClient: new TestFrontendAuthorizationClient(this.adminUserAccessToken),
    });

    const requestContext = new AuthorizedFrontendRequestContext(this.adminUserAccessToken);
    this.iModelWithChangesets = await IModelSession.create(requestContext, this.settings.iModel);
    this.contextId = this.iModelWithChangesets.contextId;
    if (this.settings.runiModelWriteRpcTests)
      this.iModelForWrite = await IModelSession.create(requestContext, this.settings.writeIModel);

    console.log("TestSetup: Done");
  }
}
