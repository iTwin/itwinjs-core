/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Asset, ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { ContextManagerClient, IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext, UserInfo } from "@bentley/itwin-client";

import { getIModelHubClient } from "./TestUtils";
import { TestIModelHubOidcAuthorizationClient } from "../TestIModelHubOidcAuthorizationClient";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/iTwin project */
class TestContextManagerClient implements ContextManagerClient {
  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ContextRegistryClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }

  public async queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset> {
    const client = new ContextRegistryClient();
    return client.getAsset(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new TestContextManagerClient();
  public readonly imodelClient = getIModelHubClient();
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any) {
    return new TestIModelHubOidcAuthorizationClient(userInfo, userCredentials);
  }
}
