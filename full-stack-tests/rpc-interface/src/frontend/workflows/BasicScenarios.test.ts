/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelApp, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { TestFrontendAuthorizationClient } from "@bentley/oidc-signin-tool/lib/frontend";
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

  async function openIModelAndQueryPage(contextId: string, iModelId: string, openMode: OpenMode) {
    const iModel = await RemoteBriefcaseConnection.open(contextId, iModelId, openMode); // eslint-disable-line deprecation/deprecation
    expect(iModel).to.exist;
    expect(iModel.elements).to.exist;

    const elements = iModel.elements;
    const elementProps = await elements.getProps(elements.rootSubjectId);
    expect(elementProps).to.exist;
    expect(elementProps.length).to.equal(1);
  }

  it("should successfully open a new IModel with changesets for read and Get Properties for an Element TestCase:819342", async () => {
    const contextId = testContext.contextId;
    const openMode = OpenMode.Readonly;

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    await openIModelAndQueryPage(contextId!, iModelId, openMode);
  });

  // imodeljs does not allow this -- changesetid must be non-empty for routing purposes.
  it.skip("should successfully open a new IModel without changesets for read and Get Properties for an Element TestCase:872675", async () => {
    const contextId = testContext.contextId;
    const openMode = OpenMode.Readonly;

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    await openIModelAndQueryPage(contextId!, iModelId, openMode);
  });

  it("should open iModel and Execute Query TestCase:819343", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();

    const rows = [];
    for await (const row of iModel.query("SELECT ECInstanceId AS id FROM BisCore.Element", undefined, 10))
      rows.push(row);

    expect(rows).not.to.be.empty;
  });

  /* This test is wrong. If two users open the same imodel using the same mode in the same backend, then they
        will share a single briefcase in the backend. When either user closes the imodel, then the briefcase will
        be closed. The backend does not maintain some kind of ref count that would keep the briefcase open
        for the second connection.
  it("should not affect other users when iModel is closed TestCase:819344 #orchestrator", async () => {
    const iModelId = testContext.iModelWithChangesets.iModelId;
    const contextId = testContext.iModelWithChangesets.contextId;
    const openMode = OpenMode.Readonly;

    const originalAppAuth = TestRpcClientManager.configuration.applicationAuthorizationValue;

    try {
      // Get access token of user that does not have permission to read given iModel
      const user1accessToken = await testContext.regularUser1.getAccessToken();
      const user1accessTokenString = user1accessToken.toTokenString() || "";

      TestRpcClientManager.configuration.applicationAuthorizationValue = user1accessTokenString;
      const iModel1 = await IModelConnection.open(user1accessToken, contextId, iModelId, openMode);

      // Open the same imodel for another user
      const user2accessToken = await testContext.regularUser2.getAccessToken();
      const user2accessTokenString = user2accessToken.toTokenString() || "";

      TestRpcClientManager.configuration.applicationAuthorizationValue = user2accessTokenString;
      const iModel2 = await IModelConnection.open(user2accessToken, contextId, iModelId, openMode);
      const query = "SELECT ECInstanceId AS id FROM BisCore.Element";

      // Act: Close the iModel for the same user
      {
          TestRpcClientManager.configuration.applicationAuthorizationValue = user1accessTokenString;
          const rows = await iModel1.queryPage(query);
          expect(rows).to.exist.and.be.not.empty;
          await iModel1.close(user1accessToken);
      }

      // Assert: Previous session close should not affect other users
      {
          TestRpcClientManager.configuration.applicationAuthorizationValue = user2accessTokenString;
          const rows = await iModel2.queryPage(query);
          expect(rows).to.exist.and.be.not.empty;
      }
    } finally {
      TestRpcClientManager.configuration.applicationAuthorizationValue = originalAppAuth;
    }
  });
 */
});
