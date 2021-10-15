/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { IModelCloudEnvironment, ITwinManagerClient } from "@bentley/imodelhub-client";
import { TestIModelHubOidcAuthorizationClient } from "../TestIModelHubOidcAuthorizationClient";
import { getIModelHubClient } from "./TestUtils";

/** An implementation of TestITwin backed by an iTwin */
class TestITwinManagerClient implements ITwinManagerClient {
  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const client = new ProjectsAccessClient();
    const iTwinList: ITwin[] = await client.getAll(accessToken, {
      search: {
        searchString: name,
        propertyName: ProjectsSearchableProperty.Name,
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
  public readonly iTwinMgr = new TestITwinManagerClient();
  public readonly imodelClient = getIModelHubClient();
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userCredentials: any) {
    return new TestIModelHubOidcAuthorizationClient(userCredentials);
  }
}
