/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { OpenAPIInfo, BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { NoRenderApp, IModelApp } from "@bentley/imodeljs-frontend";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { getAccessTokenFromBackend, TestUserCredentials, TestOidcConfiguration } from "@bentley/oidc-signin-tool/lib/frontend";

import { Settings, getRpcInterfaces } from "../../common/Settings";
import { IModelSession } from "./IModelSession";
import { AuthorizationClient } from "./AuthorizationClient";

import { getProcessEnvFromBackend } from "../../common/SideChannels";

declare const PACKAGE_VERSION: string;

// tslint:disable no-console
// tslint:disable:ter-indent

export class TestContext {
  public adminUserAccessToken!: AccessToken;

  public iModelWithChangesets?: IModelSession;
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
      } as TestOidcConfiguration);
    }

    const iModelData = this.settings.iModel;
    console.log(`Using iModel { name:${iModelData.name}, id:${iModelData.id}, projectId:${iModelData.projectId}, changesetId:${iModelData.changeSetId} }`); // tslint:disable-line

    this.contextId = iModelData.projectId;
    this.iModelWithChangesets = new IModelSession(iModelData.id, this.contextId);

    this.initializeRpcInterfaces({ title: this.settings.Backend.name, version: this.settings.Backend.version });

    NoRenderApp.startup({ applicationVersion: PACKAGE_VERSION, applicationId: this.settings.gprid });

    IModelApp.authorizationClient = new AuthorizationClient(this.adminUserAccessToken);

    console.log("TestSetup: Done");
  }
}
