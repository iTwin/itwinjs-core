/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ContextManagerClient } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { AuthorizedClientRequestContext, Project, ConnectClient, Asset } from "@bentley/imodeljs-clients/lib/imodeljs-clients";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
export class ConnectClientWrapper implements ContextManagerClient {
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
