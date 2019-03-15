/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelHubClient, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";

// __PUBLISH_EXTRACT_START__ IModelHandler.getIModels.example-code
export async function getIModelId(requestContext: AuthorizedClientRequestContext, projectId: string): Promise<string | undefined> {
  const client = new IModelHubClient();
  const imodels = await client.iModels.get(requestContext, projectId);
  return imodels ? imodels[0].wsgId : undefined;
}
// __PUBLISH_EXTRACT_END__
