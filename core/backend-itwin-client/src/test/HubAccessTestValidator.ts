/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { TestConfig } from "./TestConfig";

chai.should();

/** Utility to test basic access to the Context Registry, RBAC, and iModelHub */
export class HubAccessTestValidator {
  private static _singletonInstance: HubAccessTestValidator;

  private constructor(private _testProjectName: string, private _testProjectId: string, private _testIModelName: string, private _testIModelId: string) {
  }

  public static async getInstance(): Promise<HubAccessTestValidator> {
    if (HubAccessTestValidator._singletonInstance)
      return HubAccessTestValidator._singletonInstance;

    const accessToken: AccessToken = await TestUtility.getAccessToken(TestUsers.regular);
    const requestContext = new AuthorizedClientRequestContext(accessToken);

    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "ReadOnlyTest";
    const testProjectId: string = await TestConfig.queryProjectId(requestContext, testProjectName);
    const testIModelId: string = await TestConfig.queryIModelId(requestContext, testIModelName, testProjectId);

    HubAccessTestValidator._singletonInstance = new HubAccessTestValidator(testProjectName, testProjectId, testIModelName, testIModelId);
    return HubAccessTestValidator._singletonInstance;
  }

  public async validateContextRegistryAccess(accessToken: AccessToken): Promise<void> {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const projectId = await TestConfig.queryProjectId(requestContext, this._testProjectName);
    chai.expect(projectId).to.be.equal(this._testProjectId);
  }

  public async validateIModelHubAccess(accessToken: AccessToken): Promise<void> {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const iModelId = await TestConfig.queryIModelId(requestContext, this._testIModelName, this._testProjectId);
    chai.expect(iModelId).to.be.equal(this._testIModelId);
  }
}
