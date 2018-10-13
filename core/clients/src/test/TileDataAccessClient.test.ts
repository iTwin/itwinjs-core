/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { TileDataAccessClient, InstanceData } from "../TileDataAccessClient";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig, TestUsers } from "./TestConfig";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

describe("TileDataAccessClient", () => {
  let accessToken: AccessToken;
  const tileDataAccessClient = new TileDataAccessClient();
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login(TestUsers.user3);
    accessToken = await tileDataAccessClient.getAccessToken(actx, authToken);
  });

  it("should be able to retrieve property data properties  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const tileDataAccessData: InstanceData[] = await tileDataAccessClient.getPropertyData(actx, accessToken, "e9987eb3-c3a1-43b6-a368-e36876ad8e47", "2199023255773");
    chai.assert(tileDataAccessData);
  });

});
