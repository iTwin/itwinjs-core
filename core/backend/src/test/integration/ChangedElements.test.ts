/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@bentley/bentleyjs-core";
import { ChangeSet } from "@bentley/imodelhub-client";
import { ChangedElements, IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { ChangedElementsManager } from "../../ChangedElementsManager";
import { AuthorizedBackendRequestContext, BriefcaseManager, ChangedElementsDb, IModelJsFs } from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

function setupTest(iModelId: string): void {
  const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModelId);
  if (IModelJsFs.existsSync(cacheFilePath))
    IModelJsFs.removeSync(cacheFilePath);
}

describe("ChangedElements (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;

  let testIModel: TestIModelInfo;

  before(async () => {
    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    testIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadOnlyTest");

    // Purge briefcases that are close to reaching the acquire limit
    const managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
  });

  it("Create ChangedElements Cache and process changesets", async () => {
    setupTest(testIModel.id);

    const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, testIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, testIModel.id);
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelId);
    if (IModelJsFs.existsSync(filePath))
      IModelJsFs.removeSync(filePath);

    let cache: ChangedElementsDb | undefined = ChangedElementsDb.createDb(iModel, filePath);
    const startChangesetId = changeSets[0].id!;
    const endChangesetId = changeSets[changeSets.length - 1].id!;
    // Check that the changesets have not been processed yet
    assert.isFalse(cache.isProcessed(startChangesetId));
    assert.isFalse(cache.isProcessed(endChangesetId));
    // Try getting changed elements, should fail because we haven't processed the changesets
    let changes: ChangedElements | undefined;
    try {
      changes = cache.getChangedElements(startChangesetId, endChangesetId);
      assert.isTrue(false);
    } catch {
      // Expected to fail
    }
    assert.isTrue(changes === undefined);
    // Process changesets with "Items" presentation rules
    const result: DbResult = await cache.processChangesets(requestContext, iModel, "Items", startChangesetId, endChangesetId);
    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed elements, it should work this time
    changes = cache.getChangedElements(startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.modelIds !== undefined);
    assert.isTrue(changes!.parentIds !== undefined);
    assert.isTrue(changes!.parentClassIds !== undefined);
    assert.isTrue(changes!.elements.length === changes!.classIds.length
      && changes!.elements.length === changes!.opcodes.length
      && changes!.elements.length === changes!.type.length
      && changes!.elements.length === changes!.modelIds!.length
      && changes!.elements.length === changes!.parentIds!.length
      && changes!.elements.length === changes!.parentClassIds!.length
    );
    // Try getting changed models
    const models = cache.getChangedModels(startChangesetId, endChangesetId);
    assert.isTrue(models !== undefined);
    assert.isTrue(models!.modelIds.length !== 0);
    assert.isTrue(models!.modelIds.length === models!.bboxes.length);

    // Destroy the cache
    cache = undefined;
    changes = undefined;
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
    assert.isTrue(changes!.elements.length === changes!.classIds.length
      && changes!.elements.length === changes!.opcodes.length
      && changes!.elements.length === changes!.type.length
      && changes!.elements.length === changes!.properties!.length
      && changes!.elements.length === changes!.modelIds!.length
      && changes!.elements.length === changes!.parentIds!.length
      && changes!.elements.length === changes!.parentClassIds!.length
    );
    // If model Ids are returned, check that they correspond to the right length
    if (changes!.modelIds)
      assert.isTrue(changes!.elements.length === changes!.modelIds.length);

    // Ensure we can clean hidden property caches without erroring out
    cache.cleanCaches();

    // Test the ChangedElementsManager
    cache = undefined;
    changes = undefined;
    // Check that the changesets should still be in the cache
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelId, startChangesetId));
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelId, endChangesetId));
    // Check that we can get elements
    changes = ChangedElementsManager.getChangedElements(iModel.iModelId, startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.elements.length === changes!.classIds.length
      && changes!.elements.length === changes!.opcodes.length
      && changes!.elements.length === changes!.type.length
      && changes!.elements.length === changes!.modelIds!.length
      && changes!.elements.length === changes!.properties!.length
      && changes!.elements.length === changes!.parentIds!.length
      && changes!.elements.length === changes!.parentClassIds!.length
    );
    if (changes!.modelIds)
      assert.isTrue(changes!.elements.length === changes!.modelIds.length);

    // Test change data full return type and ensure format is correct
    const changeData = ChangedElementsManager.getChangeData(iModel.iModelId, startChangesetId, endChangesetId);
    assert.isTrue(changeData !== undefined);
    assert.isTrue(changeData!.changedElements !== undefined);
    assert.isTrue(changeData!.changedModels !== undefined);
    assert.isTrue(changeData!.changedElements.elements.length === changeData!.changedElements.classIds.length
      && changeData!.changedElements.elements.length === changeData!.changedElements.opcodes.length
      && changeData!.changedElements.elements.length === changeData!.changedElements.type.length
      && changeData?.changedElements.elements.length === changeData!.changedElements.properties!.length
      && changeData?.changedElements.elements.length === changeData!.changedElements.modelIds!.length
      && changeData?.changedElements.elements.length === changeData!.changedElements.parentIds!.length
      && changeData?.changedElements.elements.length === changeData!.changedElements.parentClassIds!.length
    );
    assert.isTrue(changeData!.changedModels.modelIds.length === changeData!.changedModels.bboxes.length);
  });
});
