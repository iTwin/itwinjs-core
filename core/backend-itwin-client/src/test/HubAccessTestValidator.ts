/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { TestConfig } from "./TestConfig";
import { AccessToken } from "@itwin/core-bentley";

chai.should();

/** Utility to test basic access to the iTwin Registry, RBAC, and iModelHub */
export class HubAccessTestValidator {
  private static _singletonInstance: HubAccessTestValidator;

  private constructor(private _testITwinName: string, private _testITwinId: string, private _testIModelName: string, private _testIModelId: string) {
  }

  public static async getInstance(): Promise<HubAccessTestValidator> {
    if (HubAccessTestValidator._singletonInstance)
      return HubAccessTestValidator._singletonInstance;

    const accessToken = await TestUtility.getAccessToken(TestUsers.regular);

    const testITwinName = "iModelJsIntegrationTest";
    const testIModelName = "ReadOnlyTest";
    const testITwinId: string = await TestConfig.getITwinIdByName(accessToken, testITwinName);
    const testIModelId: string = await TestConfig.queryIModelId(accessToken, testIModelName, testITwinId);

    HubAccessTestValidator._singletonInstance = new HubAccessTestValidator(testITwinName, testITwinId, testIModelName, testIModelId);
    return HubAccessTestValidator._singletonInstance;
  }

  public async validateITwinClientAccess(accessToken: AccessToken) {
    const iTwinId = await TestConfig.getITwinIdByName(accessToken, this._testITwinName);
    chai.expect(iTwinId).to.be.equal(this._testITwinId);
  }

  public async validateIModelHubAccess(accessToken: AccessToken) {
    const iModelId = await TestConfig.queryIModelId(accessToken, this._testIModelName, this._testITwinId);
    chai.expect(iModelId).to.be.equal(this._testIModelId);
  }
}
