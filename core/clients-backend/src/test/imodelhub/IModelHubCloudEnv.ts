/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken, UserInfo, ConnectClient, Project, IModelHubClient } from "@bentley/imodeljs-clients";
import { ContextManagerClient, IModelAuthorizationClient, IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { TestConfig } from "../TestConfig";
import { getDefaultClient } from "./TestUtils";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestConnectClient implements ContextManagerClient {
  public async queryContextByName(alctx: ActivityLoggingContext, accessToken: AccessToken, name: string): Promise<Project> {
    const client = new ConnectClient();
    return client.getProject(alctx, accessToken, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

class TestIModelHubUserMgr implements IModelAuthorizationClient {
  public async authorizeUser(alctx: ActivityLoggingContext, _userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    const authToken = await TestConfig.login(userCredentials);
    const client = getDefaultClient() as IModelHubClient;
    return client.getAccessToken(alctx, authToken);
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new TestConnectClient();
  public readonly authorization = new TestIModelHubUserMgr();
}
