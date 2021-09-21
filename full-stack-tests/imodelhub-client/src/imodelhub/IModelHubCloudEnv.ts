/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { IModelCloudEnvironment, ITwinManagerClient } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext, UserInfo } from "@bentley/itwin-client";

import { getIModelHubClient } from "./TestUtils";
import { TestIModelHubOidcAuthorizationClient } from "../TestIModelHubOidcAuthorizationClient";

// SWB
/** An implementation of IModelProjectAbstraction backed by a iModelHub/iTwin project */
// SWB
class TestITwinManagerClient implements ITwinManagerClient {
  public async getITwinByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const client = new ITwinAccessClient();
    const iTwinList: ITwin[] = await client.getAll(requestContext, {
      search: {
        searchString: name,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  // SWB
  public readonly iTwinMgr = new TestITwinManagerClient();
  public readonly imodelClient = getIModelHubClient();
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any) {
    return new TestIModelHubOidcAuthorizationClient(userInfo, userCredentials);
  }
}
