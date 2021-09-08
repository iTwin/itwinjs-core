/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHubClient } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

// __PUBLISH_EXTRACT_START__ IModelHandler.getIModels.example-code
// SWB
export async function getIModelId(requestContext: AuthorizedClientRequestContext, projectId: string): Promise<string | undefined> {
  const client = new IModelHubClient();
  // SWB
  const imodels = await client.iModels.get(requestContext, projectId);
  return imodels ? imodels[0].wsgId : undefined;
}
// __PUBLISH_EXTRACT_END__
