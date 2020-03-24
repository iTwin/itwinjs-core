/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import { IModelError } from "@bentley/imodeljs-common";
import { BriefcaseConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { AuthorizationClient } from "../setup/AuthorizationClient";
import { TestContext } from "../setup/TestContext";

import * as chai from "chai";
const expect = chai.expect;

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("Access", () => {
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
  });

  it("should fail to write to an IModel when it is opened for read TestCase:819336", async () => {
    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const contextId = testContext.iModelWithChangesets!.contextId;
    const openMode = OpenMode.Readonly;

    const accessToken = testContext.adminUserAccessToken;
    (IModelApp.authorizationClient as AuthorizationClient).setAccessToken(accessToken);
    const iModel = await BriefcaseConnection.open(contextId, iModelId, openMode);

    await expect(iModel.saveChanges(), "Expected writing to iModel in read mode to fail").to.be.rejectedWith(IModelError);
  });

  it("should fail to open an IModel for read/write TestCase:819337", async function () {
    if (testContext.settings.runiModelWriteRpcTests)
      this.skip();
    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const contextId = testContext.iModelWithChangesets!.contextId;
    const openMode = OpenMode.ReadWrite;
    const accessToken = testContext.adminUserAccessToken;
    (IModelApp.authorizationClient as AuthorizationClient).setAccessToken(accessToken);
    await expect(BriefcaseConnection.open(contextId, iModelId, openMode), "Expected opening iModel for write to fail").to.be.rejectedWith(IModelError);
  });

  it("should fail to update project extents TestCase:878417", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const newExtents = new Range3d(0, 0, 0);

    await expect(iModel.updateProjectExtents(newExtents)).to.be.rejectedWith(IModelError);
  });
});
