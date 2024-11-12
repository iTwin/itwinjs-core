/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, DbResult, GuidString, OpenMode } from "@itwin/core-bentley";
import { IModelError, IModelVersion } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { assert } from "chai";
import { BriefcaseManager, ChangedElementsDb, IModelDb, IModelHost, IModelJsFs, ProcessChangesetOptions, SnapshotDb } from "@itwin/core-backend";
import { ChangedElementsManager } from "@itwin/core-backend/lib/cjs/ChangedElementsManager";
import { HubWrappers } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { HubUtility } from "../HubUtility";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

/* eslint-disable @typescript-eslint/no-deprecated */

describe("ChangedElements", () => {
  let accessToken: AccessToken;
  let testITwinId: GuidString;
  let testIModelId: GuidString;

  before(async () => {
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
  });

  it("Create ChangedElements Cache and process changesets", async () => {
    const cacheFilePath = BriefcaseManager.getChangeCachePathName(testIModelId);
    if (IModelJsFs.existsSync(cacheFilePath))
      IModelJsFs.removeSync(cacheFilePath);

    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.first().toJSON() });
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: testIModelId });
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelId);
    if (IModelJsFs.existsSync(filePath))
      IModelJsFs.removeSync(filePath);

    let cache = ChangedElementsDb.createDb(iModel, filePath);
    assert.isDefined(cache);
    const startChangesetId = changesets[0].id;
    const endChangesetId = changesets[changesets.length - 1].id;
    // Check that the changesets have not been processed yet
    assert.isFalse(cache.isProcessed(startChangesetId));
    assert.isFalse(cache.isProcessed(endChangesetId));

    // Try getting changed elements, should fail because we haven't processed the changesets
    assert.throws(() => cache.getChangedElements(startChangesetId, endChangesetId), IModelError);

    // Process changesets with "Items" presentation rules
    const options: ProcessChangesetOptions = {
      rulesetId: "Items",
      startChangesetId,
      endChangesetId,
      wantParents: true,
      wantPropertyChecksums: true,
    };
    const result = await cache.processChangesets(accessToken, iModel, options);

    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed elements, it should work this time
    let changes = cache.getChangedElements(startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.modelIds !== undefined);
    assert.isTrue(changes!.parentIds !== undefined);
    assert.isTrue(changes!.parentClassIds !== undefined);
    assert.isTrue(changes!.elements.length === changes!.classIds.length);
    assert.isTrue(changes!.elements.length === changes!.opcodes.length);
    assert.isTrue(changes!.elements.length === changes!.type.length);
    assert.isTrue(changes!.elements.length === changes!.modelIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentClassIds!.length);
    // Try getting changed models
    const models = cache.getChangedModels(startChangesetId, endChangesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);

    // Clean and close
    cache.closeDb();
    cache.cleanCaches();
    // Destroy the cache
    // Open the db using the manager and try to get changed elements again to test the cached processed elements
    cache = ChangedElementsDb.openDb(filePath);
    assert.isTrue(cache !== undefined);
    // Check that the changesets should still be in the cache
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed elements again
    changes = cache.getChangedElements(startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.properties !== undefined);
    assert.isTrue(changes!.modelIds !== undefined);
    assert.isTrue(changes!.parentIds !== undefined);
    assert.isTrue(changes!.parentClassIds !== undefined);
    // Ensure format is returned correctly
    assert.isTrue(changes!.elements.length === changes!.classIds.length);
    assert.isTrue(changes!.elements.length === changes!.opcodes.length);
    assert.isTrue(changes!.elements.length === changes!.type.length);
    assert.isTrue(changes!.elements.length === changes!.properties!.length);
    assert.isTrue(changes!.elements.length === changes!.oldChecksums!.length);
    assert.isTrue(changes!.elements.length === changes!.newChecksums!.length);
    assert.isTrue(changes!.elements.length === changes!.modelIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentClassIds!.length);

    // If model Ids are returned, check that they correspond to the right length
    if (changes!.modelIds)
      assert.isTrue(changes!.elements.length === changes!.modelIds.length);

    // Ensure we can clean hidden property caches without erroring out
    cache.closeDb();
    cache.cleanCaches();

    // Test the ChangedElementsManager
    // Check that the changesets should still be in the cache
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelId, startChangesetId));
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelId, endChangesetId));
    // Check that we can get elements
    changes = ChangedElementsManager.getChangedElements(iModel.iModelId, startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.elements.length === changes!.classIds.length);
    assert.isTrue(changes!.elements.length === changes!.opcodes.length);
    assert.isTrue(changes!.elements.length === changes!.type.length);
    assert.isTrue(changes!.elements.length === changes!.modelIds!.length);
    assert.isTrue(changes!.elements.length === changes!.properties!.length);
    assert.isTrue(changes!.elements.length === changes!.oldChecksums!.length);
    assert.isTrue(changes!.elements.length === changes!.newChecksums!.length);
    assert.isTrue(changes!.elements.length === changes!.parentIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentClassIds!.length);

    if (changes!.modelIds)
      assert.isTrue(changes!.elements.length === changes!.modelIds.length);

    // Test change data full return type and ensure format is correct
    const changeData = ChangedElementsManager.getChangeData(iModel.iModelId, startChangesetId, endChangesetId);
    assert.isTrue(changeData !== undefined);
    assert.isTrue(changeData!.changedElements !== undefined);
    assert.isTrue(changeData!.changedModels !== undefined);
    assert.isTrue(changeData!.changedElements.elements.length === changeData!.changedElements.classIds.length);
    assert.isTrue(changeData!.changedElements.elements.length === changeData!.changedElements.opcodes.length);
    assert.isTrue(changeData!.changedElements.elements.length === changeData!.changedElements.type.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.properties!.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.oldChecksums!.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.newChecksums!.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.modelIds!.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.parentIds!.length);
    assert.isTrue(changeData?.changedElements.elements.length === changeData!.changedElements.parentClassIds!.length);

    assert.isTrue(changeData!.changedModels.modelIds.length === changeData!.changedModels.bboxes.length);

    ChangedElementsManager.cleanUp();
  });

  it("Create ChangedElements Cache and process changesets while rolling Db", async () => {
    const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(testIModelId);
    if (IModelJsFs.existsSync(cacheFilePath))
      IModelJsFs.removeSync(cacheFilePath);

    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.first().toJSON() });
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: testIModelId });
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelId);
    if (IModelJsFs.existsSync(filePath))
      IModelJsFs.removeSync(filePath);

    const cache = ChangedElementsDb.createDb(iModel, filePath);
    assert.isDefined(cache);
    // Process single
    const changesetId = changesets[0].id;
    // Check that the changesets have not been processed yet
    assert.isFalse(cache.isProcessed(changesetId));

    // Try getting changed elements, should fail because we haven't processed the changesets
    assert.throws(() => cache.getChangedElements(changesetId, changesetId), IModelError);

    // Process changesets with "Items" presentation rules
    const options: ProcessChangesetOptions = {
      rulesetId: "Items",
      startChangesetId: changesetId,
      endChangesetId: changesetId,
      wantParents: true,
      wantPropertyChecksums: true,
      wantRelationshipCaching: true,
      wantBoundingBoxes: true,
    };
    // Get file path before processing and rolling since it requires closing the iModelDb
    const iModelFilepath = iModel.pathName;
    const result = await cache.processChangesetsAndRoll(accessToken, iModel, options);
    const newIModel = SnapshotDb.openDgnDb({ path: iModelFilepath }, OpenMode.Readonly);
    // Ensure that the iModel got rolled as part of the processing operation
    assert.equal(newIModel.getCurrentChangeset().id, changesetId);
    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(changesetId));
    // Try getting changed elements, it should work this time
    const changes = cache.getChangedElements(changesetId, changesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.modelIds !== undefined);
    assert.isTrue(changes!.parentIds !== undefined);
    assert.isTrue(changes!.parentClassIds !== undefined);
    assert.isTrue(changes!.elements.length === changes!.classIds.length);
    assert.isTrue(changes!.elements.length === changes!.opcodes.length);
    assert.isTrue(changes!.elements.length === changes!.type.length);
    assert.isTrue(changes!.elements.length === changes!.modelIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentClassIds!.length);
    // Try getting changed models
    const models = cache.getChangedModels(changesetId, changesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);

    // Destroy the cache
    cache.closeDb();
    cache.cleanCaches();

    ChangedElementsManager.cleanUp();

    newIModel.closeFile();
  });

  it("Create ChangedElements Cache and process changesets while rolling Db without caching", async () => {
    const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(testIModelId);
    if (IModelJsFs.existsSync(cacheFilePath))
      IModelJsFs.removeSync(cacheFilePath);

    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.first().toJSON() });
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: testIModelId });
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelId);
    if (IModelJsFs.existsSync(filePath))
      IModelJsFs.removeSync(filePath);

    const cache = ChangedElementsDb.createDb(iModel, filePath);
    assert.isDefined(cache);
    // Process single
    const changesetId = changesets[0].id;
    // Check that the changesets have not been processed yet
    assert.isFalse(cache.isProcessed(changesetId));

    // Try getting changed elements, should fail because we haven't processed the changesets
    assert.throws(() => cache.getChangedElements(changesetId, changesetId), IModelError);

    // Process changesets with "Items" presentation rules
    const options: ProcessChangesetOptions = {
      rulesetId: "Items",
      startChangesetId: changesetId,
      endChangesetId: changesetId,
      wantParents: true,
      wantPropertyChecksums: true,
      wantRelationshipCaching: false,
      wantBoundingBoxes: true,
    };
    // Get file path before processing and rolling since it requires closing the iModelDb
    const iModelFilepath = iModel.pathName;
    const result = await cache.processChangesetsAndRoll(accessToken, iModel, options);
    const newIModel = SnapshotDb.openDgnDb({ path: iModelFilepath }, OpenMode.Readonly);
    // Ensure that the iModel got rolled as part of the processing operation
    assert.equal(newIModel.getCurrentChangeset().id, changesetId);
    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(changesetId));
    // Try getting changed elements, it should work this time
    const changes = cache.getChangedElements(changesetId, changesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.modelIds !== undefined);
    assert.isTrue(changes!.parentIds !== undefined);
    assert.isTrue(changes!.parentClassIds !== undefined);
    assert.isTrue(changes!.elements.length === changes!.classIds.length);
    assert.isTrue(changes!.elements.length === changes!.opcodes.length);
    assert.isTrue(changes!.elements.length === changes!.type.length);
    assert.isTrue(changes!.elements.length === changes!.modelIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentIds!.length);
    assert.isTrue(changes!.elements.length === changes!.parentClassIds!.length);
    // Try getting changed models
    const models = cache.getChangedModels(changesetId, changesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);

    // Destroy the cache
    cache.closeDb();
    cache.cleanCaches();

    ChangedElementsManager.cleanUp();

    newIModel.closeFile();
  });

  it("Test processing with and without bounding boxes", async () => {
    const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(testIModelId);
    if (IModelJsFs.existsSync(cacheFilePath))
      IModelJsFs.removeSync(cacheFilePath);

    let iModel: IModelDb = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.first().toJSON() });
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: testIModelId });
    const startChangesetId = changesets[0].id;
    const endChangesetId = changesets[changesets.length - 1].id;
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelId);
    if (IModelJsFs.existsSync(filePath))
      IModelJsFs.removeSync(filePath);

    let cache = ChangedElementsDb.createDb(iModel, filePath);
    assert.isDefined(cache);
    // Check that the changesets have not been processed yet
    assert.isFalse(cache.isProcessed(startChangesetId));
    assert.isFalse(cache.isProcessed(endChangesetId));

    // Try getting changed elements, should fail because we haven't processed the changesets
    assert.throws(() => cache.getChangedElements(startChangesetId, endChangesetId), IModelError);

    // Test processing with wantBoundingBoxes = true
    const options: ProcessChangesetOptions = {
      rulesetId: "Items",
      startChangesetId,
      endChangesetId,
      wantParents: true,
      wantPropertyChecksums: true,
      wantRelationshipCaching: true,
      wantBoundingBoxes: true,
    };
    // Keep path name for re-opening later
    const iModelPathName = iModel.pathName;
    // When processing multiple changesets, native side creates a clone to do the rolling on
    let result = await cache.processChangesetsAndRoll(accessToken, iModel, options);

    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed models
    let models = cache.getChangedModels(startChangesetId, endChangesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);
    // We should be able to find some bounding boxes for geometric models that are not [0,0,0] due to wantBoundingBoxes = true
    assert.isTrue(models!.bboxes.filter((bbox) => {
      const range = Range3d.fromJSON(bbox);
      return !range.isAlmostZeroX || !range.isAlmostZeroY || !range.isAlmostZeroZ;
    }).length > 0);

    // Re-open iModel
    iModel = SnapshotDb.openFile(iModelPathName);
    // Delete processed changed elements db and re-create fresh
    cache.closeDb();
    IModelJsFs.removeSync(filePath);
    cache = ChangedElementsDb.createDb(iModel, filePath);

    // Test processing with wantBoundingBoxes = false
    // When processing multiple changesets, native side creates a clone to do the rolling on
    result = await cache.processChangesetsAndRoll(accessToken, iModel, { ...options, wantBoundingBoxes: false });
    // Check that the changesets are processed
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed models
    models = cache.getChangedModels(startChangesetId, endChangesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);
    // Bounding boxes should be [0,0,0] for all elements when processing with wantBoundingBoxes = false
    assert.isTrue(models!.bboxes.every((bbox) => {
      const range = Range3d.fromJSON(bbox);
      return range.isAlmostZeroX && range.isAlmostZeroY && range.isAlmostZeroZ;
    }));

    // Destroy the cache
    cache.closeDb();
    cache.cleanCaches();
    ChangedElementsManager.cleanUp();
  });
});
