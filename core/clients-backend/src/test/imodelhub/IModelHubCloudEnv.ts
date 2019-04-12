/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, UserInfo, ConnectClient, Project, IModelHubClient, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { ContextManagerClient, IModelAuthorizationClient, IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { TestConfig } from "../TestConfig";
import { getDefaultClient } from "./TestUtils";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestConnectClient implements ContextManagerClient {
  public async queryContextByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ConnectClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

class TestIModelHubUserMgr implements IModelAuthorizationClient {
  public async authorizeUser(requestContext: ClientRequestContext, _userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    requestContext.enter();

    const authToken = await TestConfig.login(userCredentials);
    requestContext.enter();

    const client = getDefaultClient() as IModelHubClient;
    return client.getAccessToken(requestContext, authToken);
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new TestConnectClient();
  public readonly authorization = new TestIModelHubUserMgr();
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }
}
