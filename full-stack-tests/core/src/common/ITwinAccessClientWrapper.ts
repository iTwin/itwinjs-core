/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { ITwinManagerClient } from "@bentley/imodelhub-client";
import { AccessToken } from "@itwin/core-bentley";

/** An implementation of TestITwin backed by an iTwin project */
export class ITwinAccessClientWrapper implements ITwinManagerClient {
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
