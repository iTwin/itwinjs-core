/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AccessToken, Logger, LogLevel } from "@itwin/core-bentley";
import { NoRenderApp } from "@itwin/core-frontend";
import {
  getAccessTokenFromBackend, TestBrowserAuthorizationClientConfiguration, TestFrontendAuthorizationClient, TestUserCredentials,
} from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { getRpcInterfaces, Settings } from "../../common/Settings";
import { getProcessEnvFromBackend } from "../../common/SideChannels";
import { IModelSession } from "./IModelSession";
import { BentleyCloudRpcManager, OpenAPIInfo } from "@itwin/core-common";
import { IModelHubFrontend } from "@bentley/imodelhub-client";

export class TestContext {
  public adminUserAccessToken!: AccessToken;

  public iModelWithChangesets?: IModelSession;
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
  private initializeRpcInterfaces(info: OpenAPIInfo) {
    // Url without trailing slash
    const uriPrefix: string = this.settings.Backend.location.replace(/\/$/, "");
    BentleyCloudRpcManager.initializeClient({ info, uriPrefix }, getRpcInterfaces());
  }

  private async initialize() {
    expect(this.settings.users.length).to.be.gte(1, `Unexpected number of users found in settings - got ${this.settings.users.length}, expected at least 2`);

    // Print out the configuration
    console.log(this.settings.toString()); // eslint-disable-line

    // Configure iTwin.js frontend logging to go to the console
    Logger.initializeToConsole();
    Logger.setLevelDefault(this.settings.logLevel === undefined ? LogLevel.Warning : this.settings.logLevel);

    if (undefined !== this.settings.oidcClientId) {
      this.adminUserAccessToken = await getAccessTokenFromBackend({
        email: this.settings.users[0].email,
        password: this.settings.users[0].password,
      } as TestUserCredentials, {
        clientId: this.settings.oidcClientId,
        redirectUri: this.settings.oidcRedirect,
        scope: this.settings.oidcScopes,
        authority: this.settings.oidcAuthority,
      } as TestBrowserAuthorizationClientConfiguration);
    }

    const iModelData = this.settings.iModel;

    this.iModelWithChangesets = await IModelSession.create(this.adminUserAccessToken, iModelData);
    this.iTwinId = this.iModelWithChangesets.iTwinId;

    this.initializeRpcInterfaces({ title: this.settings.Backend.name, version: this.settings.Backend.version });

    await NoRenderApp.startup({
      applicationId: this.settings.gprid,
      authorizationClient: new TestFrontendAuthorizationClient(this.adminUserAccessToken),
      hubAccess: new IModelHubFrontend(),
    });

    console.log("TestSetup: Done");  // eslint-disable-line
  }
}
