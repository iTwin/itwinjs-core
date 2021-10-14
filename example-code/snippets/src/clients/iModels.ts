/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";
import { IModelHubClient } from "@bentley/imodelhub-client";

// __PUBLISH_EXTRACT_START__ IModelHandler.getIModels.example-code
export async function getIModelId(accessToken: AccessToken, iTwinId: string): Promise<string | undefined> {
  const client = new IModelHubClient();
  const imodels = await client.iModels.get(accessToken, iTwinId);
  return imodels ? imodels[0].wsgId : undefined;
}
// __PUBLISH_EXTRACT_END__
