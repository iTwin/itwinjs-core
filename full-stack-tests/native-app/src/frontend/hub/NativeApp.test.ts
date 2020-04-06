/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { using, GuidString } from "@bentley/bentleyjs-core";
import { NativeApp, IModelApp, NativeAppLogger, AuthorizedFrontendRequestContext, FrontendRequestContext } from "@bentley/imodeljs-frontend";
import { BriefcaseRpcProps, IModelVersion } from "@bentley/imodeljs-common";
import { Config, ProgressInfo } from "@bentley/imodeljs-clients";
import { TestUsers, TestAuthorizationClient } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";
import { TestChangeSetUtility } from "./TestChangeSetUtility";
import { OfflineScope } from "./HttpRequestHook";

describe("NativeApp (#integration)", () => {
  let testProjectName: string;
  let testProjectId: GuidString;
  let testIModelName: string;
  let testIModelId: GuidString;

  before(async () => {
    await NativeApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    IModelApp.authorizationClient = new TestAuthorizationClient(requestContext.accessToken);

    testProjectName = Config.App.get("imjs_test_project_name");
    testIModelName = Config.App.get("imjs_test_imodel_name");

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    testProjectId = await TestUtility.getTestProjectId(testProjectName);
    testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);
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

    const requestContext = await AuthorizedFrontendRequestContext.create();

    const iModelRpcProps = await NativeApp.downloadBriefcase(requestContext, testProjectId, testIModelId);
    await using(new OfflineScope(), async (scope: OfflineScope) => {
      const briefcases = await NativeApp.getBriefcases();
      const rs = briefcases.filter((_: BriefcaseRpcProps) => _.iModelId === testIModelId);
      assert(rs.length > 0);
      assert.isNumber(rs[0].fileSize);
      assert(rs[0].fileSize! > 0);
      const conn = await NativeApp.openBriefcase(new FrontendRequestContext(), iModelRpcProps);
      const rowCount = await conn.queryRowCount("SELECT ECInstanceId FROM bis.Element");
      assert.notEqual(rowCount, 0);
      assert.equal(scope.rejected.length, 0);
    });
  });

  it("Download Briefcase Offline (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();

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
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const authorizedRequestContext = await AuthorizedFrontendRequestContext.create();

    const downloadToken = await NativeApp.startDownloadBriefcase(authorizedRequestContext, testProjectId, locTestIModelId);
    authorizedRequestContext.enter();

    await NativeApp.finishDownloadBriefcase(authorizedRequestContext, downloadToken);
    authorizedRequestContext.enter();

    const requestContext = new FrontendRequestContext();

    await NativeApp.openBriefcase(requestContext, downloadToken.iModelRpcProps);
    requestContext.enter();

    await NativeApp.closeBriefcase(requestContext, downloadToken.iModelRpcProps);
    requestContext.enter();

    await NativeApp.deleteBriefcase(authorizedRequestContext, downloadToken.iModelRpcProps);
  });

  it("Progress event (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const requestContext = await AuthorizedFrontendRequestContext.create();
    let events = 0;
    IModelApp.eventSourceOptions.pollInterval = 1000;
    const downloadToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, locTestIModelId, IModelVersion.latest(),
      (_progress: ProgressInfo) => {
        events++;
      });
    requestContext.enter();

    await NativeApp.finishDownloadBriefcase(requestContext, downloadToken);
    requestContext.enter();
    assert.notEqual(events, 0);
    await NativeApp.deleteBriefcase(requestContext, downloadToken.iModelRpcProps);
  });

  // NEEDS_WORK: VSTS#295999
  it.skip("Should be able to cancel an in progress download (#integration)", async () => {
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const requestContext = await AuthorizedFrontendRequestContext.create();

    const downloadToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, locTestIModelId);
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

      await NativeApp.deleteBriefcase(requestContext, downloadToken.iModelRpcProps);
    } catch (err) {
      requestContext.enter();
      cancelled2 = true;
    }

    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });

  it("should be able to update a briefcase by reopening it", async () => {
    const testIModelBaseName = "NativeAppTest";
    const testChangeSetUtility = new TestChangeSetUtility();
    await testChangeSetUtility.initialize(testProjectName, testIModelBaseName);

    const locTestIModelId = await testChangeSetUtility.createTestIModel();

    // Download a test iModel
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const briefcaseToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, locTestIModelId, IModelVersion.latest());
    requestContext.enter();
    await NativeApp.finishDownloadBriefcase(requestContext, briefcaseToken);
    requestContext.enter();

    const briefcases: BriefcaseRpcProps[] = await NativeApp.getBriefcases();
    assert.isTrue(briefcases.length > 0);

    // Update test iModel with a change set
    await testChangeSetUtility.pushTestChangeSet();

    // Restart the Host (to force re-initialization of caches)
    await TestUtility.restartIModelHost();

    // Download the test iModel again
    const updatedBriefcaseToken = await NativeApp.startDownloadBriefcase(requestContext, testProjectId, locTestIModelId, IModelVersion.latest());
    requestContext.enter();
    await NativeApp.finishDownloadBriefcase(requestContext, updatedBriefcaseToken);
    requestContext.enter();

    // Validate that the change set got updated
    assert.notEqual(updatedBriefcaseToken.iModelRpcProps.changeSetId, briefcaseToken.iModelRpcProps.changeSetId);
    // NEEDS_WORK: Check that the change set id matches the one that was pushed

    const updatedBriefcases: BriefcaseRpcProps[] = await NativeApp.getBriefcases();
    assert.equal(briefcases.length, updatedBriefcases.length);

    // Delete iModel from the Hub and disk
    await testChangeSetUtility.deleteTestIModel();
  });

});
