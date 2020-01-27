/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, UserInfo, ConnectClient, Project, Asset, AuthorizedClientRequestContext, IModelHubClient } from "@bentley/imodeljs-clients";
import { ContextManagerClient, IModelAuthorizationClient, IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { TestConfig } from "../TestConfig";
import { getImodelHubClient, getDefaultClient } from "./TestUtils";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestConnectClient implements ContextManagerClient {
  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ConnectClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }

  public async queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset> {
    const client = new ConnectClient();
    return client.getAsset(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

class TestIModelHubUserMgr implements IModelAuthorizationClient {
  private _token: AccessToken | undefined;

  public async authorizeUser(requestContext: ClientRequestContext, _userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    requestContext.enter();
    const authToken = await TestConfig.getAccessToken(userCredentials);
    requestContext.enter();

    const client = getDefaultClient() as IModelHubClient;
    this._token = await client.getAccessToken(requestContext, authToken);
    if (this._token === undefined)
      throw new Error("not logged in");
    return Promise.resolve(this._token);
  }

  public isAuthorized = true;
  public hasExpired = true;
  public hasSignedIn = true;
  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this._token === undefined)
      throw new Error("not logged in");
    return Promise.resolve(this._token);
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new TestConnectClient();
  public readonly authorization = new TestIModelHubUserMgr();
  public readonly imodelClient = getImodelHubClient();
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }
}
