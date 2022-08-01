/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CheckpointConnection, IModelApp, IModelAppOptions, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, IModelReadRpcInterface, RpcInterfaceEndpoints, RpcOperation, RpcRegistry } from "@itwin/core-common";

import fetch, { Request } from "node-fetch";
import { getTestAccessToken,  TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "@itwin/oidc-signin-tool";
import { TestFrontendAuthorizationClient } from "@itwin/oidc-signin-tool/lib/cjs/TestFrontendAuthorizationClient";
import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";

(global as any).Request = Request;
(global as any).fetch = fetch;
(global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
(global as any).location = { origin: undefined }; // WebAppRpcRequest needs this

export class RpcList {
  private username: string;
  private password: string;
  private clientId: string;
  private serviceUrl: string;
  private backend: string;
  private version: string;
  private iModelConnection!: IModelConnection;
  private additionalScopes?: string;
  public changeSetId: string;

  constructor(serviceUrl: string, backend: string, version: string, username: string, password: string, clientId: string, scopes?: string) {
    this.serviceUrl = serviceUrl;
    this.backend = backend;
    this.version = version;
    this.username = username;
    this.password = password;
    this.clientId = clientId;
    this.additionalScopes = scopes;
    this.changeSetId = "";
  }

  private async initializeRpcClientBentleyCloud(serviceUrl: string): Promise<void> {
    let scope = "itwinjs imodels:read";
    if (this.additionalScopes !== undefined) {
      scope += ` ${  this.additionalScopes}`;
    }
    console.log(scope);
    const clientConfig: TestBrowserAuthorizationClientConfiguration = {
      clientId: this.clientId,
      redirectUri: "http://localhost:5000",
      scope: scope,
      authority: "https://qa-ims.bentley.com/",
    }
    const userCredentials: TestUserCredentials = {
      email: this.username,
      password: this.password
    }
    const token: string | undefined = await getTestAccessToken(clientConfig, userCredentials);
    if (!token) {
      console.log("Unable to get access token");
      return;
    }
    const iModelAppOptions: IModelAppOptions = {
      hubAccess: new FrontendIModelsAccess( new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } })),
      authorizationClient: new TestFrontendAuthorizationClient(token),
    };

    await NoRenderApp.startup(iModelAppOptions);
    const cloudParams: BentleyCloudRpcParams = { info: { title: this.backend, version: this.version }, uriPrefix: serviceUrl };
    BentleyCloudRpcManager.initializeClient(cloudParams, [ IModelReadRpcInterface ]);

  }

  public async connect(contextId: string, iModelId: string) {
    await this.initializeRpcClientBentleyCloud(this.serviceUrl);
    try {
      this.iModelConnection = await CheckpointConnection.openRemote(contextId, iModelId);
      this.changeSetId = this.iModelConnection.changeset.id;
    } catch(e) {
      console.log(e);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.iModelConnection != null)
      await this.iModelConnection.close();
    await IModelApp.shutdown();

    // Workaround for static sessions not being cleared in IModelApp.shutdown()
    RpcRegistry.instance.definitionClasses.clear();
    RpcRegistry.instance.proxies.clear();
    RpcRegistry.instance.implementationClasses.clear();
    RpcRegistry.instance.implementations.clear();
    const RpcControl = require("@itwin/core-common/lib/cjs/rpc/core/RpcControl");
    RpcControl.RpcControlChannel.channels.length = 0;
  }

  public async getEndpoints(): Promise<RpcInterfaceEndpoints[]> {
    RpcOperation.fallbackToken = this.iModelConnection.getRpcProps();
    return BentleyCloudRpcManager.describeAvailableEndpoints();
  }

  public getChangeSetId() {
    return this.iModelConnection.changeset.id;
  }
}
