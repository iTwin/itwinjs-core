/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode, using } from "@bentley/bentleyjs-core";
import { NativeApp, IModelApp, NativeAppLogger } from "@bentley/imodeljs-frontend";
import { BriefcaseProps } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients";
import { TestUsers, TestAuthorizationClient } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";
import { OfflineScope } from "./HttpRequestHook";

describe("NativeApp (#integration)", () => {
  before(async () => {
    await NativeApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    IModelApp.authorizationClient = new TestAuthorizationClient(requestContext.accessToken);
  });

  after(async () => {
    await NativeApp.shutdown();
    IModelApp.authorizationClient = undefined;
  });

  it("Download Briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = Config.App.get("imjs_test_project_name");
    const testIModelName = Config.App.get("imjs_test_imodel_name");

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    // Setup a model with a large number of change sets
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    await NativeApp.downloadBriefcase(testProjectId, testIModelId);
    await using(new OfflineScope(), async (scope: OfflineScope) => {
      const briefcases = await NativeApp.getBriefcases();
      const rs = briefcases.filter((_: BriefcaseProps) => _.iModelId === testIModelId);
      assert(rs.length > 1);
      assert.isNumber(rs[0].fileSize);
      assert(rs[0].fileSize! > 0);
      const conn = await NativeApp.openBriefcase("", rs[0].iModelId!, rs[0].changeSetId!, OpenMode.Readonly);
      const rowCount = await conn.queryRowCount("SELECT ECInstanceId FROM bis.Element");
      assert.notEqual(rowCount, 0);
      assert.equal(scope.rejected.length, 0);
    });
  });

  it("Download Briefcase Offline (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = Config.App.get("imjs_test_project_name");
    const testIModelName = Config.App.get("imjs_test_imodel_name");

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    await using(new OfflineScope(), async (_scope: OfflineScope) => {
      try {
        await NativeApp.downloadBriefcase(testProjectId, testIModelId);
        assert(false, "downloadBriefcase() should fail in offlineScope");
      } catch {
      }
    });
  });
});
