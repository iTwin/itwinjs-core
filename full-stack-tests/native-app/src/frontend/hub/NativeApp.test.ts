/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext, OpenMode, using } from "@bentley/bentleyjs-core";
import { ImsTestAuthorizationClient } from "@bentley/imodeljs-clients";
import { NativeApp, IModelApp, NativeAppLogger } from "@bentley/imodeljs-frontend";
import { TestUsers } from "./TestUsers";
import { TestUtility } from "./TestUtility";
import { BriefcaseProps } from "@bentley/imodeljs-common";
import { OfflineScope } from "./HttpRequestHook";
describe("NativeApp (#integration)", () => {
  before(async () => {
    await NativeApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const imsTestAuthorizationClient = new ImsTestAuthorizationClient();
    await imsTestAuthorizationClient.signIn(new ClientRequestContext(), TestUsers.regular);
    IModelApp.authorizationClient = imsTestAuthorizationClient;
  });

  after(async () => {
    await NativeApp.shutdown();
    IModelApp.authorizationClient = undefined;
  });

  it("Download Briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    // Setup a model with a large number of change sets
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    await NativeApp.downloadBriefcase(testProjectId, testIModelId);
    await using(new OfflineScope(), async (scope: OfflineScope) => {
      const briefcases = await NativeApp.getBriefcases();
      const rs = briefcases.filter((_: BriefcaseProps) => _.iModelId === testIModelId);
      assert(rs.length === 1);
      assert.isNumber(rs[0].fileSize);
      assert(rs[0].fileSize! > 0);
      const conn = await NativeApp.openBriefcase("", rs[0].iModelId!, rs[0].changeSetId!, OpenMode.Readonly);
      const rowCount = await conn.queryRowCount("SELECT ECInstanceId FROM bis.Element");
      // tslint:disable-next-line:no-console
      assert.notEqual(rowCount, 0);
      assert.equal(scope.rejected.length, 0);
    });
  });

  it("Download Briefcase Offline (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

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
