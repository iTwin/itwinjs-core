/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { AuthorizedBackendRequestContext, BriefcaseManager, ConcurrencyControl, IModelDb, IModelJsFs, KeepBriefcase, OpenParams } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { assertTargetDbContents, assertUpdatesInTargetDb, populateSourceDb, prepareSourceDb, prepareTargetDb, TestIModelTransformer, updateSourceDb } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUsers } from "../TestUsers";
import { HubUtility } from "./HubUtility";

describe("IModelTransformer (#integration)", () => {

  it("Transform source iModel to target iModel", async () => {
    const requestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    const projectId: GuidString = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }

    // Create and push seed of source IModel
    const sourceIModelName: string = HubUtility.generateUniqueName("TransformerSource");
    const sourceSeedFileName: string = path.join(outputDir, `${sourceIModelName}.bim`);
    if (IModelJsFs.existsSync(sourceSeedFileName)) {
      IModelJsFs.removeSync(sourceSeedFileName);
    }
    const sourceSeedDb: IModelDb = IModelDb.createSnapshot(sourceSeedFileName, { rootSubject: { name: "TransformerSource" } });
    assert.isTrue(IModelJsFs.existsSync(sourceSeedFileName));
    await prepareSourceDb(sourceSeedDb);
    sourceSeedDb.closeSnapshot();
    const sourceIModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, sourceSeedFileName);
    assert.isTrue(Guid.isGuid(sourceIModelId));

    // Create and push seed of target IModel
    const targetIModelName: string = HubUtility.generateUniqueName("TransformerTarget");
    const targetSeedFileName: string = path.join(outputDir, `${targetIModelName}.bim`);
    if (IModelJsFs.existsSync(targetSeedFileName)) {
      IModelJsFs.removeSync(targetSeedFileName);
    }
    const targetSeedDb: IModelDb = IModelDb.createSnapshot(targetSeedFileName, { rootSubject: { name: "TransformerTarget" } });
    assert.isTrue(IModelJsFs.existsSync(targetSeedFileName));
    await prepareTargetDb(targetSeedDb);
    targetSeedDb.closeSnapshot();
    const targetIModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, targetSeedFileName);
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      const sourceDb: IModelDb = await IModelDb.open(requestContext, projectId, sourceIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      const targetDb: IModelDb = await IModelDb.open(requestContext, projectId, targetIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.exists(sourceDb);
      assert.exists(targetDb);
      sourceDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);
      targetDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);

      // Import #1
      if (true) {
        populateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, () => "Populate source");

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        transformer.importAll();
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #1");
        assertTargetDbContents(sourceDb, targetDb);
      }

      // Import #2
      if (true) {
        updateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, () => "Update source");

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        transformer.importAll();
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #2");
        assertUpdatesInTargetDb(targetDb);
      }

      await sourceDb.close(requestContext, KeepBriefcase.No);
      await targetDb.close(requestContext, KeepBriefcase.No);
    } finally {
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });
});
