/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { RequestGlobalOptions } from "@bentley/itwin-client";
import { TestUsers } from "@itwin/oidc-signin-tool";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";

before(() => {
  if (TestConfig.enableIModelBank && !TestConfig.enableMocks) {
    RequestGlobalOptions.timeout = {
      deadline: 60000,
      response: 60000,
    };
  }
});

before(async () => {
  const requestContext = await getAccessToken();
  const contextId = await utils.getProjectId(requestContext);
  await utils.createIModel(requestContext, utils.sharedimodelName, contextId);
});

after(async () => {
  const requestContext = await getAccessToken();
  const contextId = await utils.getProjectId(requestContext);
  await utils.deleteIModelByName(requestContext, contextId, utils.sharedimodelName);
});

async function getAccessToken(): Promise<AccessToken> {
  return TestConfig.enableMocks ? "" : utils.login(TestUsers.super);
}
