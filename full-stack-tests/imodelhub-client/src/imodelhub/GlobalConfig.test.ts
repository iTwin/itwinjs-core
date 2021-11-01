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
  const accessToken = await getAccessToken();
  const iTwinId = await utils.getITwinId(accessToken);
  await utils.createIModel(accessToken, utils.sharedimodelName, iTwinId);
});

after(async () => {
  const accessToken = await getAccessToken();
  const iTwinId = await utils.getITwinId(accessToken);
  await utils.deleteIModelByName(accessToken, iTwinId, utils.sharedimodelName);
});

async function getAccessToken(): Promise<AccessToken> {
  return TestConfig.enableMocks ? "" : utils.login(TestUsers.super);
}
