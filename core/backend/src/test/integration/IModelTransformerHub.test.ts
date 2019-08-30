/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Guid, GuidString, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import { ChangeOpCode, IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { ChangeSummaryExtractOptions, InstanceChange } from "../../ChangeSummaryManager";
import { Entity } from "../../Entity";
import { AuthorizedBackendRequestContext, BriefcaseManager, ChangeSummary, ChangeSummaryManager, ConcurrencyControl, Element, IModelDb, IModelJsFs, KeepBriefcase, OpenParams } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { assertTargetDbContents, assertUpdatesInTargetDb, populateSourceDb, prepareSourceDb, prepareTargetDb, TestIModelTransformer, updateSourceDb } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUsers } from "../TestUsers";
import { HubUtility } from "./HubUtility";
import { Model } from "../../Model";
import { Relationship } from "../../Relationship";
import { ElementAspect } from "../../ElementAspect";

class EntityTypeChanges {
  public insertedIds: Id64Set = new Set<Id64String>();
  public updatedIds: Id64Set = new Set<Id64String>();
  public deletedIds: Id64Set = new Set<Id64String>();
  public addChange(changeOpCode: ChangeOpCode, id: Id64String): void {
    switch (changeOpCode) {
      case ChangeOpCode.Insert: this.insertedIds.add(id); break;
      case ChangeOpCode.Update: this.updatedIds.add(id); break;
      case ChangeOpCode.Delete: this.deletedIds.add(id); break;
      default: throw new Error(`Unexpected ChangedOpCode ${changeOpCode}`);
    }
  }
}

class EntityChanges {
  public codeSpecs: EntityTypeChanges = new EntityTypeChanges();
  public elements: EntityTypeChanges = new EntityTypeChanges();
  public elementAspects: EntityTypeChanges = new EntityTypeChanges();
  public models: EntityTypeChanges = new EntityTypeChanges();
  public relationships: EntityTypeChanges = new EntityTypeChanges();
  private constructor() { }
  public static async initialize(requestContext: AuthorizedBackendRequestContext, iModelDb: IModelDb, options: ChangeSummaryExtractOptions): Promise<EntityChanges> {
    const entityChanges = new EntityChanges();
    const changeSummaryIds: Id64String[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModelDb, options);
    assert.strictEqual(changeSummaryIds.length, 1);
    ChangeSummaryManager.attachChangeCache(iModelDb);
    assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModelDb));
    const changeSummary: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModelDb, changeSummaryIds[0]);
    iModelDb.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=?", (statement) => {
      statement.bindId(1, changeSummary.id);
      while (statement.step() === DbResult.BE_SQLITE_ROW) {
        const instanceId: Id64String = statement.getValue(0).getId();
        const instanceChange: InstanceChange = ChangeSummaryManager.queryInstanceChange(iModelDb, instanceId);
        const entityClassFullName: string = EntityChanges._toClassFullName(instanceChange.changedInstance.className);
        try {
          const entityType: typeof Entity = iModelDb.getJsClass<typeof Entity>(entityClassFullName);
          if (entityType.prototype instanceof Element) {
            // const propertyNames: string[] = ChangeSummaryManager.getChangedPropertyValueNames(iModelDb, instanceChange.id);
            entityChanges.elements.addChange(instanceChange.opCode, instanceChange.changedInstance.id);
          } else if (entityType.prototype instanceof ElementAspect) {
            entityChanges.elementAspects.addChange(instanceChange.opCode, instanceChange.changedInstance.id);
          } else if (entityType.prototype instanceof Model) {
            entityChanges.models.addChange(instanceChange.opCode, instanceChange.changedInstance.id);
          } else if (entityType.prototype instanceof Relationship) {
            entityChanges.relationships.addChange(instanceChange.opCode, instanceChange.changedInstance.id);
          }
        } catch (error) {
          if ("BisCore:CodeSpec" === entityClassFullName) {
            // In TypeScript, CodeSpec is not a subclass of Entity (should it be?), so must be handled separately.
            entityChanges.codeSpecs.addChange(instanceChange.opCode, instanceChange.changedInstance.id);
          } else {
            // Changes to *navigation* relationship are also tracked (should they be?), but can be ignored
            // console.log(`Ignoring ${entityClassFullName}`); // tslint:disable-line
          }
        }
      }
    });
    return entityChanges;
  }
  /** Converts string from ChangedInstance format to classFullName format. For example: "[BisCore].[PhysicalElement]" --> "BisCore:PhysicalElement" */
  private static _toClassFullName(changedInstanceClassName: string): string {
    return changedInstanceClassName.replace(/\[|\]/g, "").replace(".", ":");
  }
}

describe("IModelTransformerHub (#integration)", () => {

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

        const sourceDbChanges: EntityChanges = await EntityChanges.initialize(requestContext, sourceDb, { currentVersionOnly: true });
        // expect inserts from populateSourceDb
        assert.isAtLeast(sourceDbChanges.codeSpecs.insertedIds.size, 1);
        assert.isAtLeast(sourceDbChanges.elements.insertedIds.size, 1);
        assert.isAtLeast(sourceDbChanges.elementAspects.insertedIds.size, 1);
        assert.isAtLeast(sourceDbChanges.models.insertedIds.size, 1);
        assert.isAtLeast(sourceDbChanges.relationships.insertedIds.size, 1);
        // expect no update nor deletes from populateSourceDb
        assert.equal(sourceDbChanges.codeSpecs.updatedIds.size, 0);
        assert.equal(sourceDbChanges.codeSpecs.deletedIds.size, 0);
        assert.equal(sourceDbChanges.elements.updatedIds.size, 0);
        assert.equal(sourceDbChanges.elements.deletedIds.size, 0);
        assert.equal(sourceDbChanges.elementAspects.updatedIds.size, 0);
        assert.equal(sourceDbChanges.elementAspects.deletedIds.size, 0);
        assert.equal(sourceDbChanges.models.updatedIds.size, 0);
        assert.equal(sourceDbChanges.models.deletedIds.size, 0);
        assert.equal(sourceDbChanges.relationships.updatedIds.size, 0);
        assert.equal(sourceDbChanges.relationships.deletedIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        transformer.importAll();
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #1");
        assertTargetDbContents(sourceDb, targetDb);

        const targetDbChanges: EntityChanges = await EntityChanges.initialize(requestContext, targetDb, { currentVersionOnly: true });
        // expect inserts and a few FederationGuid updates from transforming the result of populateSourceDb
        assert.isAtLeast(targetDbChanges.elements.insertedIds.size, 1);
        assert.equal(targetDbChanges.elements.updatedIds.size, 2); // FederationGuid updated for the Dictionary and RealityDataSources InformationPartitionElements
        assert.isAtLeast(targetDbChanges.elementAspects.insertedIds.size, 1);
        assert.isAtLeast(targetDbChanges.models.insertedIds.size, 1);
        assert.isAtLeast(targetDbChanges.relationships.insertedIds.size, 1);
        // expect no other changes from transforming the result of populateSourceDb
        assert.equal(targetDbChanges.codeSpecs.insertedIds.size, 0);
        assert.equal(targetDbChanges.codeSpecs.updatedIds.size, 0);
        assert.equal(targetDbChanges.codeSpecs.deletedIds.size, 0);
        assert.equal(targetDbChanges.elements.deletedIds.size, 0);
        assert.equal(targetDbChanges.elementAspects.updatedIds.size, 0);
        assert.equal(targetDbChanges.elementAspects.deletedIds.size, 0);
        assert.equal(targetDbChanges.models.updatedIds.size, 0);
        assert.equal(targetDbChanges.models.deletedIds.size, 0);
        assert.equal(targetDbChanges.relationships.updatedIds.size, 0);
        assert.equal(targetDbChanges.relationships.deletedIds.size, 0);
      }

      // Import #2
      if (true) {
        updateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, () => "Update source");

        const sourceDbChanges: EntityChanges = await EntityChanges.initialize(requestContext, sourceDb, { currentVersionOnly: true });
        // expect no inserts from updateSourceDb
        assert.equal(sourceDbChanges.codeSpecs.insertedIds.size, 0);
        assert.equal(sourceDbChanges.elements.insertedIds.size, 0);
        assert.equal(sourceDbChanges.elementAspects.insertedIds.size, 0);
        assert.equal(sourceDbChanges.models.insertedIds.size, 0);
        assert.equal(sourceDbChanges.relationships.insertedIds.size, 0);
        // expect some updates from updateSourceDb
        assert.isAtLeast(sourceDbChanges.elements.updatedIds.size, 1);
        assert.isAtLeast(sourceDbChanges.elementAspects.updatedIds.size, 1);
        assert.equal(sourceDbChanges.models.updatedIds.size, 0); // WIP: will be at least 1 after GeometricModel.GeometryGuid changes are merged in
        assert.isAtLeast(sourceDbChanges.relationships.updatedIds.size, 1);
        // expect some deletes from updateSourceDb
        assert.isAtLeast(sourceDbChanges.elements.deletedIds.size, 1);
        // don't expect other changes from updateSourceDb
        assert.equal(sourceDbChanges.codeSpecs.updatedIds.size, 0);
        assert.equal(sourceDbChanges.codeSpecs.deletedIds.size, 0);
        assert.equal(sourceDbChanges.elementAspects.deletedIds.size, 0);
        assert.equal(sourceDbChanges.models.deletedIds.size, 0);
        assert.equal(sourceDbChanges.relationships.deletedIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        transformer.importAll();
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #2");
        assertUpdatesInTargetDb(targetDb);

        const targetDbChanges: EntityChanges = await EntityChanges.initialize(requestContext, targetDb, { currentVersionOnly: true });
        // expect no inserts from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpecs.insertedIds.size, 0);
        assert.equal(targetDbChanges.elements.insertedIds.size, 0);
        assert.equal(targetDbChanges.elementAspects.insertedIds.size, 0);
        assert.equal(targetDbChanges.models.insertedIds.size, 0);
        assert.equal(targetDbChanges.relationships.insertedIds.size, 0);
        // expect some updates from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.elements.updatedIds.size, 1);
        assert.isAtLeast(targetDbChanges.elementAspects.updatedIds.size, 1);
        assert.equal(targetDbChanges.models.updatedIds.size, 0); // WIP: will be at least 1 after GeometricModel.GeometryGuid changes are merged in
        assert.isAtLeast(targetDbChanges.relationships.updatedIds.size, 1);
        // expect some deletes from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.elements.deletedIds.size, 1);
        assert.isAtLeast(targetDbChanges.elementAspects.deletedIds.size, 1);
        // don't expect other changes from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpecs.updatedIds.size, 0);
        assert.equal(targetDbChanges.codeSpecs.deletedIds.size, 0);
        assert.equal(targetDbChanges.models.deletedIds.size, 0);
        assert.equal(targetDbChanges.relationships.deletedIds.size, 0);
      }

      await sourceDb.close(requestContext, KeepBriefcase.No);
      await targetDb.close(requestContext, KeepBriefcase.No);
    } finally {
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });
});

// cspell:words ecchange
