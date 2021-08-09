/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContextContainerNTBD, ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { ContextManagerClient } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** An implementation of IModelProjectAbstraction backed by an iTwin project */
export class ContextRegistryClientWrapper implements ContextManagerClient {
  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ContextRegistryClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
  public async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ContextContainerNTBD> {
    const client = new ContextRegistryClient();
    return client.getContextContainerByName(requestContext, name);
  }
}
