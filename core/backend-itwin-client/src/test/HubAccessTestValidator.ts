/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { TestConfig } from "./TestConfig";

chai.should();

/** Utility to test basic access to the iTwin Registry, RBAC, and iModelHub */
export class HubAccessTestValidator {
  private static _singletonInstance: HubAccessTestValidator;

  private constructor(private _testITwinName: string, private _testITwinId: string, private _testIModelName: string, private _testIModelId: string) {
  }

  public static async getInstance(): Promise<HubAccessTestValidator> {
    if (HubAccessTestValidator._singletonInstance)
      return HubAccessTestValidator._singletonInstance;

    const accessToken: AccessToken = await TestUtility.getAccessToken(TestUsers.regular);
    const requestContext = new AuthorizedClientRequestContext(accessToken);

    const testITwinName = "iModelJsIntegrationTest";
    const testIModelName = "ReadOnlyTest";
    const testITwinId: string = await TestConfig.getITwinIdByName(requestContext, testITwinName);
    const testIModelId: string = await TestConfig.queryIModelId(requestContext, testIModelName, testITwinId);

    HubAccessTestValidator._singletonInstance = new HubAccessTestValidator(testITwinName, testITwinId, testIModelName, testIModelId);
    return HubAccessTestValidator._singletonInstance;
  }

  public async validateITwinClientAccess(accessToken: AccessToken) {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const iTwinId = await TestConfig.getITwinIdByName(requestContext, this._testITwinName);
    chai.expect(iTwinId).to.be.equal(this._testITwinId);
  }

  public async validateIModelHubAccess(accessToken: AccessToken) {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const iModelId = await TestConfig.queryIModelId(requestContext, this._testIModelName, this._testITwinId);
    chai.expect(iModelId).to.be.equal(this._testIModelId);
  }
}
