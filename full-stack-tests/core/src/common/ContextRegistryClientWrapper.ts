/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients/lib/imodeljs-clients";
import { Project, ContextRegistryClient, Asset } from "@bentley/context-registry-client";
import { ContextManagerClient } from "@bentley/imodelhub-client";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
export class ContextRegistryClientWrapper implements ContextManagerClient {
  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ContextRegistryClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
  public async queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset> {
    const client = new ContextRegistryClient();
    return client.getAsset(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}
