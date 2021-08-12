/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContextRegistryClient, ITwin } from "@bentley/context-registry-client";
import { ContextManagerClient } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** An implementation of IModelProjectAbstraction backed by an iTwin project */
export class ContextRegistryClientWrapper implements ContextManagerClient {
  public async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const client = new ContextRegistryClient();
    return client.getContextContainerByName(requestContext, name);
  }
}
