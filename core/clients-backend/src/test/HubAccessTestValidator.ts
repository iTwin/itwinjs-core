/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { TestConfig } from "./TestConfig";
import { TestUsers } from "./TestUsers";

chai.should();

/** Utility to test basic access to Connect, RBAC and iModelHub */
export class HubAccessTestValidator {
  private static _singletonInstance: HubAccessTestValidator;

  private constructor(private _testProjectName: string, private _testProjectId: string, private _testIModelName: string, private _testIModelId: string) {
  }

  public static async getInstance(): Promise<HubAccessTestValidator> {
    if (HubAccessTestValidator._singletonInstance)
      return HubAccessTestValidator._singletonInstance;

    const accessToken: AccessToken = await TestConfig.getAccessToken(TestUsers.regular);
    const requestContext = new AuthorizedClientRequestContext(accessToken);

    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "ReadOnlyTest";
    const testProjectId: string = await TestConfig.queryProjectId(requestContext, testProjectName);
    const testIModelId: string = await TestConfig.queryIModelId(requestContext, testIModelName, testProjectId);

    HubAccessTestValidator._singletonInstance = new HubAccessTestValidator(testProjectName, testProjectId, testIModelName, testIModelId);
    return HubAccessTestValidator._singletonInstance;
  }

  public async validateConnectAccess(accessToken: AccessToken) {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const projectId = await TestConfig.queryProjectId(requestContext, this._testProjectName);
    chai.expect(projectId).to.be.equal(this._testProjectId);
  }

  public async validateIModelHubAccess(accessToken: AccessToken) {
    const requestContext = new AuthorizedClientRequestContext(accessToken);
    const iModelId = await TestConfig.queryIModelId(requestContext, this._testIModelName, this._testProjectId);
    chai.expect(iModelId).to.be.equal(this._testIModelId);
  }
}
