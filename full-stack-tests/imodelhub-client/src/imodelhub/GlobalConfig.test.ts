/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, AuthorizedClientRequestContext, RequestGlobalOptions } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
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
  const requestContext = await getRequestContext();
  const iTwinId = await utils.getITwinId(requestContext);
  await utils.createIModel(requestContext, utils.sharedimodelName, iTwinId);
});

after(async () => {
  const requestContext = await getRequestContext();
  const iTwinId = await utils.getITwinId(requestContext);
  await utils.deleteIModelByName(requestContext, iTwinId, utils.sharedimodelName);
});

async function getRequestContext(): Promise<AuthorizedClientRequestContext> {
  const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
  const requestContext = new AuthorizedClientRequestContext(accessToken);
  return requestContext;
}
