/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, UserProfile, ConnectClient, Project } from "../..";
import { IModelHubClient } from "../..";
import { TestConfig } from "../TestConfig";
import { ContextManagerClient, IModelAuthorizationClient, IModelCloudEnvironment } from "../../IModelCloudEnvironment";
import { getDefaultClient } from "./TestUtils";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestConnectClient implements ContextManagerClient {
  public async queryContextByName(alctx: ActivityLoggingContext, accessToken: AccessToken, name: string): Promise<Project> {
    const client = await new ConnectClient();
    return client.getProject(alctx, accessToken, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

class TestIModelHubUserMgr implements IModelAuthorizationClient {
  public async authorizeUser(alctx: ActivityLoggingContext, _userProfile: UserProfile | undefined, userCredentials: any): Promise<AccessToken> {
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
