/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { using } from "@bentley/bentleyjs-core";
import { NativeApp, IModelApp, NativeAppLogger, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { BriefcaseProps, IModelVersion } from "@bentley/imodeljs-common";
import { Config, ProgressInfo } from "@bentley/imodeljs-clients";
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

  it.skip("should purge the briefcase cache", async () => {
    await TestUtility.purgeBriefcaseCache();
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

    const requestContext = await AuthorizedFrontendRequestContext.create();

    const iModelToken = await NativeApp.downloadBriefcase(requestContext, testProjectId, testIModelId);
    await using(new OfflineScope(), async (scope: OfflineScope) => {
      const briefcases = await NativeApp.getBriefcases();
      const rs = briefcases.filter((_: BriefcaseProps) => _.iModelId === testIModelId);
      assert(rs.length > 0);
      assert.isNumber(rs[0].fileSize);
      assert(rs[0].fileSize! > 0);
      const conn = await NativeApp.openBriefcase(requestContext, iModelToken);
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

    const requestContext = await AuthorizedFrontendRequestContext.create();

    await using(new OfflineScope(), async (_scope: OfflineScope) => {
      try {
        await NativeApp.downloadBriefcase(requestContext, testProjectId, testIModelId);
        assert(false, "downloadBriefcase() should fail in offlineScope");
      } catch {
      }
    });
  });
  it("should be able to start and finish downloading a briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    const requestContext = await AuthorizedFrontendRequestContext.create();

    const downloadToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, testIModelId);
    requestContext.enter();

    await NativeApp.finishDownloadBriefcase(requestContext, downloadToken);
    requestContext.enter();

    const iModel = await NativeApp.openBriefcase(requestContext, downloadToken.iModelToken);
    requestContext.enter();

    await iModel.close();
    requestContext.enter();

    await NativeApp.deleteBriefcase(requestContext, downloadToken.iModelToken);
  });
  it("Progress event (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    const requestContext = await AuthorizedFrontendRequestContext.create();
    let events = 0;
    IModelApp.eventSourceOptions.pollInterval = 1000;
    const downloadToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, testIModelId, IModelVersion.latest(),
      (_progress: ProgressInfo) => {
        events++;
      });
    requestContext.enter();

    await NativeApp.finishDownloadBriefcase(requestContext, downloadToken);
    requestContext.enter();
    assert.notEqual(events, 0);
    await NativeApp.deleteBriefcase(requestContext, downloadToken.iModelToken);
  });

  it("Should be able to cancel an in progress download (#integration)", async () => {
    NativeAppLogger.initialize();
    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    const requestContext = await AuthorizedFrontendRequestContext.create();

    const downloadToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, testIModelId);
    requestContext.enter();

    let cancelled1: boolean = false;
    setTimeout(async () => {
      cancelled1 = await NativeApp.cancelDownloadBriefcase(requestContext, downloadToken);
      requestContext.enter();
    }, 10000);

    let cancelled2: boolean = false;
    try {
      await NativeApp.finishDownloadBriefcase(requestContext, downloadToken);
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      cancelled2 = true;
    }

    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });
});
