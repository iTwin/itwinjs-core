/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelHubClient, AccessToken,
} from "@bentley/imodeljs-clients";

import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

// __PUBLISH_EXTRACT_START__ IModelHandler.getIModels.example-code
export async function getIModelId(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string): Promise<string | undefined> {
  const client = new IModelHubClient();
  const imodels = await client.IModels().get(alctx, accessToken, projectId);
  return imodels ? imodels[0].wsgId : undefined;
}
// __PUBLISH_EXTRACT_END__
