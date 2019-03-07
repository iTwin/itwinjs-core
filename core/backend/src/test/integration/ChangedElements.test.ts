/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion, ChangedElements } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "../../BriefcaseManager";
import { IModelDb, OpenParams } from "../../IModelDb";
import { IModelTestUtils, TestUsers, TestIModelInfo } from "../IModelTestUtils";
import { IModelJsFs } from "../../IModelJsFs";
import { HubUtility } from "./HubUtility";
import { ChangedElementsDb } from "../../imodeljs-backend";
import { ChangedElementsManager } from "../../ChangedElementsManager";

function setupTest(iModelId: string): void {
  const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModelId);
  if (IModelJsFs.existsSync(cacheFilePath))
    IModelJsFs.removeSync(cacheFilePath);
}

describe("ChangedElements (#integration)", () => {
  let accessToken: AccessToken;
  let testProjectId: string;

  let testIModel: TestIModelInfo;

  const actx = new ActivityLoggingContext("");

  before(async () => {
    accessToken = await HubUtility.login(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(accessToken, "iModelJsIntegrationTest");
    testIModel = await IModelTestUtils.getTestModelInfo(accessToken, testProjectId, "ReadOnlyTest");

    // Purge briefcases that are close to reaching the acquire limit
    const managerAccessToken: AccessToken = await HubUtility.login(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerAccessToken, "iModelJsIntegrationTest", "ReadOnlyTest");
  });

  it("Create ChangedElements Cache and process changesets", async () => {
    setupTest(testIModel.id);

    const iModel: IModelDb = await IModelDb.open(actx, accessToken, testProjectId, testIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(actx, accessToken, testIModel.id);
    assert.exists(iModel);

    const filePath = ChangedElementsManager.getChangedElementsPathName(iModel.iModelToken.iModelId!);
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
    const result: DbResult = await cache.processChangesets(accessToken, iModel, "Items", startChangesetId, endChangesetId);
    assert.equal(result, DbResult.BE_SQLITE_OK);
    // Check that the changesets should have been processed now
    assert.isTrue(cache.isProcessed(startChangesetId));
    assert.isTrue(cache.isProcessed(endChangesetId));
    // Try getting changed elements, it should work this time
    changes = cache.getChangedElements(startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.elements.length === changes!.classIds.length && changes!.elements.length === changes!.opcodes.length);

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
    assert.isTrue(changes!.elements.length === changes!.classIds.length && changes!.elements.length === changes!.opcodes.length);

    // Test the ChangedElementsManager
    cache = undefined;
    changes = undefined;
    // Check that the changesets should still be in the cache
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelToken.iModelId!, startChangesetId));
    assert.isTrue(ChangedElementsManager.isProcessed(iModel.iModelToken.iModelId!, endChangesetId));
    // Check that we can get elements
    changes = ChangedElementsManager.getChangedElements(iModel.iModelToken.iModelId!, startChangesetId, endChangesetId);
    assert.isTrue(changes !== undefined);
    assert.isTrue(changes!.elements.length !== 0);
    assert.isTrue(changes!.elements.length === changes!.classIds.length && changes!.elements.length === changes!.opcodes.length);
  });
});
