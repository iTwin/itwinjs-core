/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { QueryRowFormat } from "@itwin/core-common";
import { CheckpointConnection, IModelApp } from "@itwin/core-frontend";
import { TestFrontendAuthorizationClient } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { TestContext } from "../setup/TestContext";

const expect = chai.expect;

chai.use(chaiAsPromised);

describe("Basic Scenarios", async () => {
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    const accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
  });

  async function openIModelAndQueryPage(iTwinId: string, iModelId: string) {
    const iModel = await CheckpointConnection.openRemote(iTwinId, iModelId);
    expect(iModel).to.exist;
    expect(iModel.elements).to.exist;

    const elements = iModel.elements;
    const elementProps = await elements.getProps(elements.rootSubjectId);
    expect(elementProps).to.exist;
    expect(elementProps.length).to.equal(1);
  }

  it("should successfully open a new IModel with changesets for read and Get Properties for an Element TestCase:819342", async () => {
    const iTwinId = testContext.iTwinId;

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    await openIModelAndQueryPage(iTwinId!, iModelId);
  });

  it("should open iModel and Execute Query TestCase:819343", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();

    const rows = [];
    for await (const row of iModel.query("SELECT ECInstanceId AS id FROM BisCore.Element", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames, limit: { count: 10 } }))
      rows.push(row);

    expect(rows).not.to.be.empty;
  });

});
