/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/context-registry-client";
import { ContextManagerClient } from "@bentley/imodelhub-client";

/** An implementation of IModelProjectAbstraction backed by an iTwin project */
export class ContextRegistryClientWrapper implements ContextManagerClient {
  public async getITwinByName(requestContext: AccessToken, name: string): Promise<ITwin> {
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
