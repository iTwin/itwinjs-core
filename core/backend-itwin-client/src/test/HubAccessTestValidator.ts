/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { TestConfig } from "./TestConfig";
import { AccessToken } from "@itwin/core-bentley";

chai.should();

/** Utility to test basic access to the Context Registry, RBAC, and iModelHub */
export class HubAccessTestValidator {
  private static _singletonInstance: HubAccessTestValidator;

  private constructor(private _testProjectName: string, private _testProjectId: string, private _testIModelName: string, private _testIModelId: string) {
  }

  public static async getInstance(): Promise<HubAccessTestValidator> {
    if (HubAccessTestValidator._singletonInstance)
      return HubAccessTestValidator._singletonInstance;

    const accessToken = await TestUtility.getAccessToken(TestUsers.regular);

    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "ReadOnlyTest";
    const testProjectId: string = await TestConfig.getITwinIdByName(accessToken, testProjectName);
    const testIModelId: string = await TestConfig.queryIModelId(accessToken, testIModelName, testProjectId);

    HubAccessTestValidator._singletonInstance = new HubAccessTestValidator(testProjectName, testProjectId, testIModelName, testIModelId);
    return HubAccessTestValidator._singletonInstance;
  }

  public async validateITwinClientAccess(accessToken: AccessToken) {
    const projectId = await TestConfig.getITwinIdByName(accessToken, this._testProjectName);
    chai.expect(projectId).to.be.equal(this._testProjectId);
  }

  public async validateIModelHubAccess(accessToken: AccessToken) {
    const iModelId = await TestConfig.queryIModelId(accessToken, this._testIModelName, this._testProjectId);
    chai.expect(iModelId).to.be.equal(this._testIModelId);
  }
}
