/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ITwin, ITwinsAccessClient, ITwinsAPIResponse, ITwinSubClass } from "@itwin/itwins-client";
import { AccessToken } from "@itwin/core-bentley";

/** An implementation of TestITwin backed by an iTwin project */
export class ITwinAccessClientWrapper {
  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const client = new ITwinsAccessClient();
    const iTwinListResponse: ITwinsAPIResponse<ITwin[]> = await client.queryAsync(accessToken, ITwinSubClass.Project, {
      displayName: name,
    });

    const iTwinList = iTwinListResponse.data;
    if (!iTwinList) {
      throw new Error(`ITwin ${name} returned with no data when queried.`);
    }

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }
}
