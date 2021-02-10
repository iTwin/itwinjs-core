/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, GuidString } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import { SnapshotDb } from "../../IModelDb";
import { AuthorizedBackendRequestContext, BriefcaseManager, IModelHost } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

describe("IModelOpen (#integration)", () => {

  let requestContext: AuthorizedBackendRequestContext;
  let badRequestContext: AuthorizedBackendRequestContext;
  const testProjectName = "iModelJsIntegrationTest";
  const testIModelName = "Stadium Dataset 1";
  let testIModelId: GuidString;
  let testProjectId: GuidString;
  let testChangeSetId: GuidString;

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);
    testChangeSetId = (await HubUtility.queryLatestChangeSet(requestContext, testIModelId))!.wsgId;

    // Open and close the iModel to ensure it works and is closed
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(testChangeSetId).toJSON() });
    assert.isDefined(iModel);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);

    const badToken = new AccessToken("ThisIsABadToken");
    badRequestContext = new AuthorizedBackendRequestContext(badToken);
  });

  const deleteTestIModelCache = () => {
    const path = (BriefcaseManager as any).getIModelPath(testIModelId);
    (BriefcaseManager as any).deleteFolderAndContents(path);
  };

  it("Unauthorized requests should cause an obvious error", async () => {
    // Try the bad request context
    let error: any;
    try {
      await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext: badRequestContext, contextId: testProjectId, iModelId: testIModelId });
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof BentleyError);
    assert.equal(401, error.status);

    error = undefined;
    try {
      await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext: badRequestContext, contextId: testProjectId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(testChangeSetId).toJSON() });
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof BentleyError);
    assert.equal(401, error.status);
  });

  it("should be able to handle simultaneous open calls", async () => {
    // Clean folder to re-fetch briefcase
    deleteTestIModelCache();

    const numTries = 100;
    const version = IModelVersion.asOfChangeSet(testChangeSetId).toJSON();

    // Open iModel with no timeout, and ensure all promises resolve to the same briefcase
    const openPromises = new Array<Promise<SnapshotDb>>();
    for (let ii = 0; ii < numTries; ii++) {
      const open = IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: version });
      openPromises.push(open);
    }
    const iModels = await Promise.all(openPromises);
    const pathname = iModels[0].pathName;
    for (let ii = 1; ii < numTries; ii++) {
      assert.strictEqual(iModels[ii].pathName, pathname);
    }
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModels[0]);
  });

  it("should be able to open a version that requires many merges", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, testIModelId);
    const numChangeSets = changeSets.length;
    assert.isAbove(numChangeSets, 10);

    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(changeSets[9].wsgId).toJSON() });
    assert.isDefined(iModel);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
  });

  it("should be able to handle simultaneous open calls of different versions", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, testIModelId);
    const numChangeSets = changeSets.length;
    assert.isAbove(numChangeSets, 10);

    const changeSetIds = new Array<GuidString>();
    const indices: number[] = [0, Math.floor(numChangeSets / 3), Math.floor(numChangeSets / 2), Math.floor(numChangeSets * 2 / 3), numChangeSets - 1];
    for (const index of indices) {
      changeSetIds.push(changeSets[index].wsgId);
    }

    const openPromises = new Array<Promise<SnapshotDb>>();
    for (const changeSetId of changeSetIds) {
      const open = IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(changeSetId).toJSON() });
      openPromises.push(open);
    }

    const iModels = await Promise.all(openPromises);
    for (const iModel of iModels) {
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
    }
  }).timeout(1000000);

});
