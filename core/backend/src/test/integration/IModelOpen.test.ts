/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { WSStatus, GuidString } from "@bentley/bentleyjs-core";
import { IModelVersion, RpcPendingResponse } from "@bentley/imodeljs-common";
import { AccessToken, WsgError, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUsers } from "../TestUsers";
import { IModelDb, OpenParams, AuthorizedBackendRequestContext, BriefcaseManager } from "../../imodeljs-backend";
import { HubUtility } from "./HubUtility";
import { KeepBriefcase } from "../../BriefcaseManager";

describe("IModelOpen (#integration)", () => {

  let requestContext: AuthorizedBackendRequestContext;
  let badRequestContext: AuthorizedBackendRequestContext;
  const testProjectName = "Design Review ATP";
  const testIModelName = "Stadium Dataset 1";
  let testIModelId: GuidString;
  let testProjectId: GuidString;
  let testChangeSetId: GuidString;

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);
    testChangeSetId = await HubUtility.queryLatestChangeSetId(requestContext, testIModelId);

    // Open and close the iModel to ensure it works and is closed
    const iModel = await IModelDb.open(requestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(testChangeSetId));
    assert.isDefined(iModel);
    await iModel.close(requestContext, KeepBriefcase.No);

    const badToken = AccessToken.fromJsonWebTokenString("ThisIsABadToken");
    badRequestContext = new AuthorizedBackendRequestContext(badToken);
  });

  const deleteTestIModelCache = () => {
    const path = (BriefcaseManager as any).getIModelPath(testIModelId);
    (BriefcaseManager as any).deleteFolderRecursive(path);
  };

  it("Unauthorized requests should cause an obvious error", async () => {
    // Try the bad request context
    let error: any;
    try {
      await IModelDb.open(badRequestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof WsgError);
    assert.equal(401, error.status);
    assert.equal(WSStatus.LoginFailed, error.errorNumber);

    error = undefined;
    try {
      await IModelDb.open(badRequestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(testChangeSetId));
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof WsgError);
    assert.equal(401, error.status);
    assert.equal(WSStatus.LoginFailed, error.errorNumber);
  });

  it("should throw a pending response after specified timeout", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const openParams: OpenParams = OpenParams.fixedVersion();
    openParams.timeout = 500;

    // Open iModel and ensure RpcPendingResponse exception is thrown
    let exceptionThrown = false;
    let startTime = 0;
    let timeElapsed = 0;
    try {
      startTime = Date.now();
      await IModelDb.open(requestContext, testProjectId, testIModelId, openParams);
    } catch (error) {
      timeElapsed = Date.now() - startTime;
      exceptionThrown = error instanceof RpcPendingResponse;
    }
    assert.isTrue(exceptionThrown);
    assert.isBelow(timeElapsed, openParams.timeout + 500); // Adding arbitrary overhead

    // Open and close the model
    openParams.timeout = undefined;
    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, testIModelId, openParams);
    assert.isDefined(iModel);
    await iModel.close(requestContext, KeepBriefcase.No);
  });

  it("should be able to handle simultaneous multiple open calls", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const numTries = 100;
    const openParams: OpenParams = OpenParams.fixedVersion();
    openParams.timeout = 500;
    const version = IModelVersion.asOfChangeSet(testChangeSetId);
    let openPromises = new Array<Promise<IModelDb>>();
    for (let ii = 0; ii < numTries; ii++) {
      const open = IModelDb.open(requestContext, testProjectId, testIModelId, openParams, version);
      openPromises.push(open);
    }

    // Open iModel and ensure RpcPendingResponse exception is thrown
    let exceptionThrown = false;
    let startTime = 0;
    let timeElapsed = 0;
    try {
      startTime = Date.now();
      await Promise.all(openPromises);
    } catch (error) {
      timeElapsed = Date.now() - startTime;
      exceptionThrown = error instanceof RpcPendingResponse;
    }
    assert.isTrue(exceptionThrown);
    assert.isBelow(timeElapsed, openParams.timeout + 500); // Adding arbitrary overhead

    // Open iModel with no timeout, and ensure all promises resolve to the same briefcase
    openPromises = [];
    openParams.timeout = undefined;
    for (let ii = 0; ii < numTries; ii++) {
      const open = IModelDb.open(requestContext, testProjectId, testIModelId, openParams, version);
      openPromises.push(open);
    }
    const iModels: IModelDb[] = await Promise.all(openPromises);
    const pathname = iModels[0].briefcase.pathname;
    for (let ii = 1; ii < numTries; ii++) {
      assert.strictEqual(iModels[ii].briefcase.pathname, pathname);
    }
    await iModels[0].close(requestContext, KeepBriefcase.No);
  });

  it("should be able to open a version that requires many merges", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, testIModelId);
    const numChangeSets = changeSets.length;
    assert.isAbove(numChangeSets, 10);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(changeSets[9].wsgId));
    assert.isDefined(iModel);
    await iModel.close(requestContext, KeepBriefcase.No);
  });

  it("should be able to handle simultaneous multiple open calls of different versions", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, testIModelId);
    const numChangeSets = changeSets.length;
    assert.isAbove(numChangeSets, 10);

    const changeSetIds = new Array<GuidString>();
    const indices: number[] = [0, Math.floor(numChangeSets / 3), Math.floor(numChangeSets / 2), Math.floor(numChangeSets * 2 / 3), numChangeSets - 1];
    for (const index of indices) {
      changeSetIds.push(changeSets[index].wsgId);
    }

    const openPromises = new Array<Promise<IModelDb>>();
    for (const changeSetId of changeSetIds) {
      const open = IModelDb.open(requestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(changeSetId));
      openPromises.push(open);
    }

    const iModels: IModelDb[] = await Promise.all(openPromises);
    for (const iModel of iModels) {
      await iModel.close(requestContext, KeepBriefcase.Yes);
    }
  });

  // it.skip("should be able to make repetitive multiple simultaneous open requests to the Hub", async () => {
  //   const projectName = "DesignReviewTestDatasets";
  //   const projectId: GuidString = await HubUtility.queryProjectIdByName(requestContext, projectName);

  //   const iModelNames = [
  //     "BSY_OG_UK_01 OG_REF",
  //     "Coffs Harbour Bypass Dataset 1",
  //     "Coffs Harbour Bypass Dataset 2",
  //     "Mott Dataset 1",
  //     "Mott Dataset 2 - Section 6",
  //     "Mott Dataset 3 - Section 8",
  //     "Mott Dataset 4 - Section 8",
  //     "Mott WP-137",
  //     "OG_REF",
  //     "PenChemOSBL7",
  //     "Retail Building",
  //     "Stadium Dataset 1",
  //     "Sweco Norway Dataset 1",
  //     "Sweco Norway Dataset 2 - Revit and MicroStation Bridge",
  //     "Sweco Norway Dataset 3 - 108 refs",
  //   ];

  //   const iModelIds = new Array<GuidString>();
  //   const changeSetIds = new Array<GuidString>();
  //   for (const iModelName of iModelNames) {
  //     let iModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
  //     assert.isDefined(iModelId, `iModel ${iModelName} not found in project ${projectName}`);
  //     iModelIds.push(iModelId);

  //     let changeSetId: GuidString = await HubUtility.queryLatestChangeSetId(requestContext, iModelId);
  //     assert.isDefined(changeSetId);
  //     changeSetIds.push(changeSetId);
  //   }

  //   // Remove all briefcases from cache
  //   for (const iModelId of iModelIds) {
  //     const path = (BriefcaseManager as any).getIModelPath(iModelId);
  //     (BriefcaseManager as any).deleteFolderRe
  //   }

  // });

});
