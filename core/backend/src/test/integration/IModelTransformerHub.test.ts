/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as semver from "semver";
import { DbResult, Guid, GuidString, Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ColorDef, IModel, PhysicalElementProps, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import {
  BackendLoggerCategory, BisCoreSchema, ConcurrencyControl, ECSqlStatement, Element, ElementRefersToElements, ExternalSourceAspect, GenericSchema,
  IModelDb, IModelExporter, IModelHost, IModelJsFs, IModelTransformer, NativeLoggerCategory, PhysicalModel, PhysicalObject, PhysicalPartition,
  SnapshotDb, SpatialCategory, Subject,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { CountingIModelImporter, IModelToTextFileExporter, IModelTransformerUtils, TestIModelTransformer } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

describe("IModelTransformerHub (#integration)", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "IModelTransformerHub");

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
      Logger.setLevel(NativeLoggerCategory.Changeset, LogLevel.Trace);
    }
  });

  it("Transform source iModel to target iModel", async () => {
    // Create and push seed of source IModel
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const projectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const sourceIModelName: string = HubUtility.generateUniqueName("TransformerSource");
    const sourceSeedFileName: string = path.join(outputDir, `${sourceIModelName}.bim`);
    if (IModelJsFs.existsSync(sourceSeedFileName)) {
      IModelJsFs.removeSync(sourceSeedFileName);
    }
    const sourceSeedDb = SnapshotDb.createEmpty(sourceSeedFileName, { rootSubject: { name: "TransformerSource" } });
    assert.isTrue(IModelJsFs.existsSync(sourceSeedFileName));
    await IModelTransformerUtils.prepareSourceDb(sourceSeedDb);
    sourceSeedDb.close();
    const sourceIModelId = await HubUtility.pushIModel(requestContext, projectId, sourceSeedFileName);
    assert.isTrue(Guid.isGuid(sourceIModelId));

    // Create and push seed of target IModel
    const targetIModelName: string = HubUtility.generateUniqueName("TransformerTarget");
    const targetSeedFileName: string = path.join(outputDir, `${targetIModelName}.bim`);
    if (IModelJsFs.existsSync(targetSeedFileName)) {
      IModelJsFs.removeSync(targetSeedFileName);
    }
    const targetSeedDb = SnapshotDb.createEmpty(targetSeedFileName, { rootSubject: { name: "TransformerTarget" } });
    assert.isTrue(IModelJsFs.existsSync(targetSeedFileName));
    await IModelTransformerUtils.prepareTargetDb(targetSeedDb);
    targetSeedDb.close();
    const targetIModelId = await HubUtility.pushIModel(requestContext, projectId, targetSeedFileName);
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      const sourceDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: sourceIModelId });
      const targetDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: targetIModelId });
      assert.isTrue(sourceDb.isBriefcaseDb());
      assert.isTrue(targetDb.isBriefcaseDb());
      assert.isFalse(sourceDb.isSnapshot);
      assert.isFalse(targetDb.isSnapshot);
      sourceDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
      targetDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

      if (true) { // initial import
        IModelTransformerUtils.populateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, "Populate source");

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(sourceExportFileName));
        const sourceDbChanges: any = (sourceExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(sourceDbChanges);
        // expect inserts and 1 update from populateSourceDb
        assert.isAtLeast(sourceDbChanges.codeSpec.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.element.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.aspect.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.model.insertIds.size, 1);
        assert.equal(sourceDbChanges.model.updateIds.size, 1, "Expect the RepositoryModel to be updated");
        assert.isTrue(sourceDbChanges.model.updateIds.has(IModel.repositoryModelId));
        assert.isAtLeast(sourceDbChanges.relationship.insertIds.size, 1);
        // expect no other updates nor deletes from populateSourceDb
        assert.equal(sourceDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(sourceDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(sourceDbChanges.element.updateIds.size, 0);
        assert.equal(sourceDbChanges.element.deleteIds.size, 0);
        assert.equal(sourceDbChanges.aspect.updateIds.size, 0);
        assert.equal(sourceDbChanges.aspect.deleteIds.size, 0);
        assert.equal(sourceDbChanges.model.deleteIds.size, 0);
        assert.equal(sourceDbChanges.relationship.updateIds.size, 0);
        assert.equal(sourceDbChanges.relationship.deleteIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        await transformer.processChanges(requestContext);
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, "Import #1");
        IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect inserts and a few updates from transforming the result of populateSourceDb
        assert.isAtLeast(targetDbChanges.codeSpec.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.element.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.insertIds.size, 1);
        assert.equal(targetDbChanges.model.updateIds.size, 1, "Expect the RepositoryModel to be updated");
        assert.isTrue(targetDbChanges.model.updateIds.has(IModel.repositoryModelId));
        assert.isAtLeast(targetDbChanges.relationship.insertIds.size, 1);
        // expect no other changes from transforming the result of populateSourceDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(targetDbChanges.element.updateIds.size, 0);
        assert.equal(targetDbChanges.element.deleteIds.size, 0);
        assert.equal(targetDbChanges.aspect.updateIds.size, 0);
        assert.equal(targetDbChanges.aspect.deleteIds.size, 0);
        assert.equal(targetDbChanges.model.deleteIds.size, 0);
        assert.equal(targetDbChanges.relationship.updateIds.size, 0);
        assert.equal(targetDbChanges.relationship.deleteIds.size, 0);
      }

      if (true) { // second import with no changes to source, should be a no-op
        const numTargetElements: number = count(targetDb, Element.classFullName);
        const numTargetExternalSourceAspects: number = count(targetDb, ExternalSourceAspect.classFullName);
        const numTargetRelationships: number = count(targetDb, ElementRefersToElements.classFullName);
        const targetImporter = new CountingIModelImporter(targetDb);
        const transformer = new TestIModelTransformer(sourceDb, targetImporter);
        await transformer.processChanges(requestContext);
        assert.equal(targetImporter.numModelsInserted, 0);
        assert.equal(targetImporter.numModelsUpdated, 0);
        assert.equal(targetImporter.numElementsInserted, 0);
        assert.equal(targetImporter.numElementsUpdated, 0);
        assert.equal(targetImporter.numElementsDeleted, 0);
        assert.equal(targetImporter.numElementAspectsInserted, 0);
        assert.equal(targetImporter.numElementAspectsUpdated, 0);
        assert.equal(targetImporter.numRelationshipsInserted, 0);
        assert.equal(targetImporter.numRelationshipsUpdated, 0);
        assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
        assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
        assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        assert.isFalse(targetDb.nativeDb.hasPendingTxns());
        await targetDb.pushChanges(requestContext, "Should not actually push because there are no changes");
      }

      if (true) { // update source db, then import again
        IModelTransformerUtils.updateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, "Update source");

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(sourceExportFileName));
        const sourceDbChanges: any = (sourceExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(sourceDbChanges);
        // expect some inserts from updateSourceDb
        assert.equal(sourceDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(sourceDbChanges.element.insertIds.size, 1);
        assert.equal(sourceDbChanges.aspect.insertIds.size, 0);
        assert.equal(sourceDbChanges.model.insertIds.size, 0);
        assert.equal(sourceDbChanges.relationship.insertIds.size, 2);
        // expect some updates from updateSourceDb
        assert.isAtLeast(sourceDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from updateSourceDb
        assert.isAtLeast(sourceDbChanges.element.deleteIds.size, 1);
        assert.equal(sourceDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from updateSourceDb
        assert.equal(sourceDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(sourceDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(sourceDbChanges.aspect.deleteIds.size, 0);
        assert.equal(sourceDbChanges.model.deleteIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        await transformer.processChanges(requestContext);
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, "Import #2");
        IModelTransformerUtils.assertUpdatesInDb(targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect some inserts from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(targetDbChanges.element.insertIds.size, 1);
        assert.equal(targetDbChanges.aspect.insertIds.size, 3);
        assert.equal(targetDbChanges.model.insertIds.size, 0);
        assert.equal(targetDbChanges.relationship.insertIds.size, 2);
        // expect some updates from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.element.deleteIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.deleteIds.size, 1);
        assert.equal(targetDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(targetDbChanges.model.deleteIds.size, 0);
      }

      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, sourceDb);
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, targetDb);

    } finally {
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });

  it("Clone/upgrade test", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const projectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const sourceIModelName: string = HubUtility.generateUniqueName("CloneSource");
    const sourceIModelId = await HubUtility.recreateIModel(requestContext, projectId, sourceIModelName);
    assert.isTrue(Guid.isGuid(sourceIModelId));
    const targetIModelName: string = HubUtility.generateUniqueName("CloneTarget");
    const targetIModelId = await HubUtility.recreateIModel(requestContext, projectId, targetIModelName);
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      // open/upgrade sourceDb
      const sourceDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: sourceIModelId });
      const seedBisCoreVersion = sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!;
      assert.isTrue(semver.satisfies(seedBisCoreVersion, ">= 1.0.1"));
      sourceDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
      assert.isFalse(sourceDb.concurrencyControl.locks.hasSchemaLock);
      await sourceDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(sourceDb.concurrencyControl.locks.hasSchemaLock);
      const updatedBisCoreVersion = sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!;
      assert.isTrue(semver.satisfies(updatedBisCoreVersion, ">= 1.0.10"));
      assert.isTrue(sourceDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");
      const expectedHasPendingTxns: boolean = seedBisCoreVersion !== updatedBisCoreVersion;

      // push sourceDb schema changes
      await sourceDb.concurrencyControl.request(requestContext);
      assert.equal(sourceDb.nativeDb.hasPendingTxns(), expectedHasPendingTxns, "Expect importSchemas to have saved changes");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect no unsaved changes after importSchemas");
      await sourceDb.pushChanges(requestContext, "Import schemas to upgrade BisCore"); // may push schema changes
      assert.isFalse(sourceDb.concurrencyControl.locks.hasSchemaLock);

      // import schemas again to test common scenario of not knowing whether schemas are up-to-date or not..
      await sourceDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(sourceDb.concurrencyControl.locks.hasSchemaLock);
      assert.isTrue(sourceDb.concurrencyControl.locks.hasSchemaLock);
      assert.isFalse(sourceDb.nativeDb.hasPendingTxns(), "Expect importSchemas to be a no-op");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect importSchemas to be a no-op");
      sourceDb.saveChanges(); // will be no changes to save in this case
      await sourceDb.pushChanges(requestContext, "Import schemas again"); // will be no changes to push in this case
      assert.isFalse(sourceDb.concurrencyControl.locks.hasSchemaLock);

      // populate sourceDb
      IModelTransformerUtils.populateTeamIModel(sourceDb, "Test", Point3d.createZero(), ColorDef.green);
      IModelTransformerUtils.assertTeamIModelContents(sourceDb, "Test");
      await sourceDb.concurrencyControl.request(requestContext);
      sourceDb.saveChanges();
      await sourceDb.pushChanges(requestContext, "Populate Source");
      assert.isFalse(sourceDb.concurrencyControl.locks.hasSchemaLock);

      // open/upgrade targetDb
      const targetDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: targetIModelId });
      targetDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
      await targetDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(targetDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");

      // push targetDb schema changes
      await targetDb.concurrencyControl.request(requestContext);
      targetDb.saveChanges();
      await targetDb.pushChanges(requestContext, "Upgrade BisCore");

      // import sourceDb changes into targetDb
      const transformer = new IModelTransformer(new IModelExporter(sourceDb), targetDb);
      await transformer.processAll();
      transformer.dispose();
      IModelTransformerUtils.assertTeamIModelContents(targetDb, "Test");
      await targetDb.concurrencyControl.request(requestContext);
      targetDb.saveChanges();
      await targetDb.pushChanges(requestContext, "Import changes from sourceDb");

      // close iModel briefcases
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, sourceDb);
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, targetDb);
    } finally {
      // delete iModel briefcases
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });

  it("should merge changes made on a branch back to master", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const projectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");

    // create and push master IModel
    const masterIModelName = HubUtility.generateUniqueName("Master");
    const masterSeedFileName = path.join(outputDir, `${masterIModelName}.bim`);
    if (IModelJsFs.existsSync(masterSeedFileName)) {
      IModelJsFs.removeSync(masterSeedFileName); // make sure file from last run does not exist
    }
    const state0 = [1, 2];
    const masterSeedDb = SnapshotDb.createEmpty(masterSeedFileName, { rootSubject: { name: "Master" } });
    populateMaster(masterSeedDb, state0);
    assert.isTrue(IModelJsFs.existsSync(masterSeedFileName));
    masterSeedDb.saveChanges();
    masterSeedDb.close();
    const masterIModelId = await HubUtility.pushIModel(requestContext, projectId, masterSeedFileName, masterIModelName, true);
    assert.isTrue(Guid.isGuid(masterIModelId));
    IModelJsFs.removeSync(masterSeedFileName); // now that iModel is pushed, can delete local copy of the seed
    const masterDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: masterIModelId });
    masterDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    assert.isTrue(masterDb.isBriefcaseDb());
    assert.equal(masterDb.contextId, projectId);
    assert.equal(masterDb.iModelId, masterIModelId);
    assertPhysicalObjects(masterDb, state0);
    const changeSetMasterFirst = masterDb.changeSetId;

    // can't copy the baseline version as a template, so create a changeSet
    const rootSubject = masterDb.elements.getElement<Subject>(IModel.rootSubjectId, Subject);
    rootSubject.description = new Date().toLocaleTimeString();
    rootSubject.update();
    await masterDb.concurrencyControl.request(requestContext);
    masterDb.saveChanges();
    await masterDb.pushChanges(requestContext, "State0");
    const changeSetMasterState0 = masterDb.changeSetId;
    assert.notEqual(changeSetMasterState0, changeSetMasterFirst);

    // create Branch1 iModel using Master as a template
    const branchIModelName1 = HubUtility.generateUniqueName("Branch1");
    await deleteIModelByName(requestContext, projectId, branchIModelName1);
    const branchIModel1 = await IModelHost.iModelClient.iModels.create(requestContext, projectId, branchIModelName1, {
      description: `Branch1 of ${masterIModelName}`,
      template: { imodelId: masterIModelId, changeSetId: changeSetMasterState0 },
    });
    assert.isDefined(branchIModel1?.id);
    const branchIModelId1: GuidString = branchIModel1!.id!; // eslint-disable-line
    const branchDb1 = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: branchIModelId1 });
    branchDb1.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    assert.isTrue(branchDb1.isBriefcaseDb());
    assert.equal(branchDb1.contextId, projectId);
    assertPhysicalObjects(branchDb1, state0);
    const changeSetBranch1First = branchDb1.changeSetId;

    // create Branch2 iModel using Master as a template
    const branchIModelName2 = HubUtility.generateUniqueName("Branch2");
    await deleteIModelByName(requestContext, projectId, branchIModelName2);
    const branchIModel2 = await IModelHost.iModelClient.iModels.create(requestContext, projectId, branchIModelName2, {
      description: `Branch2 of ${masterIModelName}`,
      template: { imodelId: masterIModelId, changeSetId: changeSetMasterState0 },
    });
    assert.isDefined(branchIModel2?.id);
    const branchIModelId2: GuidString = branchIModel2!.id!; // eslint-disable-line
    const branchDb2 = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: branchIModelId2 });
    branchDb2.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    assert.isTrue(branchDb2.isBriefcaseDb());
    assert.equal(branchDb2.contextId, projectId);
    assertPhysicalObjects(branchDb2, state0);
    const changeSetBranch2First = branchDb2.changeSetId;

    try {
      // record provenance in Branch1 and Branch2 iModels
      const provenanceInserterB1 = new IModelTransformer(masterDb, branchDb1, {
        wasSourceIModelCopiedToTarget: true,
      });
      const provenanceInserterB2 = new IModelTransformer(masterDb, branchDb2, {
        wasSourceIModelCopiedToTarget: true,
      });
      await provenanceInserterB1.processAll();
      await provenanceInserterB2.processAll();
      provenanceInserterB1.dispose();
      provenanceInserterB2.dispose();
      assert.equal(count(masterDb, ExternalSourceAspect.classFullName), 0);
      assert.isAbove(count(branchDb1, ExternalSourceAspect.classFullName), state0.length);
      assert.isAbove(count(branchDb2, ExternalSourceAspect.classFullName), state0.length);

      // push Branch1 and Branch2 provenance changes
      await branchDb1.concurrencyControl.request(requestContext);
      await branchDb2.concurrencyControl.request(requestContext);
      branchDb1.saveChanges();
      branchDb2.saveChanges();
      await branchDb1.pushChanges(requestContext, "State0");
      await branchDb2.pushChanges(requestContext, "State0");
      const changeSetBranch1State0 = branchDb1.changeSetId;
      const changeSetBranch2State0 = branchDb2.changeSetId;
      assert.notEqual(changeSetBranch1State0, changeSetBranch1First);
      assert.notEqual(changeSetBranch2State0, changeSetBranch2First);

      // push Branch1 State1
      const delta01 = [2, 3, 4]; // update 2, insert 3 and 4
      const state1 = [1, 2, 3, 4];
      maintainPhysicalObjects(branchDb1, delta01);
      assertPhysicalObjects(branchDb1, state1);
      await branchDb1.concurrencyControl.request(requestContext);
      branchDb1.saveChanges();
      await branchDb1.pushChanges(requestContext, "State0 -> State1");
      const changeSetBranch1State1 = branchDb1.changeSetId;
      assert.notEqual(changeSetBranch1State1, changeSetBranch1State0);

      // push Branch1 State2
      const delta12 = [1, -3, 5, 6]; // update 1, delete 3, insert 5 and 6
      const state2 = [1, 2, -3, 4, 5, 6];
      maintainPhysicalObjects(branchDb1, delta12);
      assertPhysicalObjects(branchDb1, state2);
      await branchDb1.concurrencyControl.request(requestContext);
      branchDb1.saveChanges();
      await branchDb1.pushChanges(requestContext, "State1 -> State2");
      const changeSetBranch1State2 = branchDb1.changeSetId;
      assert.notEqual(changeSetBranch1State2, changeSetBranch1State1);

      // merge changes made on Branch1 back to Master
      const branch1ToMaster = new IModelTransformer(branchDb1, masterDb, {
        isReverseSynchronization: true, // provenance stored in source/branch
      });
      await branch1ToMaster.processChanges(requestContext, changeSetBranch1State1);
      branch1ToMaster.dispose();
      assertPhysicalObjects(masterDb, state2);
      assertPhysicalObjectUpdated(masterDb, 1);
      assertPhysicalObjectUpdated(masterDb, 2);
      assert.equal(count(masterDb, ExternalSourceAspect.classFullName), 0);
      await masterDb.concurrencyControl.request(requestContext);
      masterDb.saveChanges();
      await masterDb.pushChanges(requestContext, "State0 -> State2"); // a squash of 2 branch changes into 1 in the masterDb change ledger
      const changeSetMasterState2 = masterDb.changeSetId;
      assert.notEqual(changeSetMasterState2, changeSetMasterState0);
      branchDb1.saveChanges(); // saves provenance locally in case of re-merge

      // merge changes from Master to Branch2
      const masterToBranch2 = new IModelTransformer(masterDb, branchDb2);
      await masterToBranch2.processChanges(requestContext, changeSetMasterState2);
      masterToBranch2.dispose();
      assertPhysicalObjects(branchDb2, state2);
      await branchDb2.concurrencyControl.request(requestContext);
      branchDb2.saveChanges();
      await branchDb2.pushChanges(requestContext, "State0 -> State2");
      const changeSetBranch2State2 = branchDb2.changeSetId;
      assert.notEqual(changeSetBranch2State2, changeSetBranch2State0);

      // make changes to Branch2
      const delta23 = [7, 8];
      const state3 = [1, 2, -3, 4, 5, 6, 7, 8];
      maintainPhysicalObjects(branchDb2, delta23);
      assertPhysicalObjects(branchDb2, state3);
      await branchDb2.concurrencyControl.request(requestContext);
      branchDb2.saveChanges();
      await branchDb2.pushChanges(requestContext, "State2 -> State3");
      const changeSetBranch2State3 = branchDb2.changeSetId;
      assert.notEqual(changeSetBranch2State3, changeSetBranch2State2);

      // merge changes made on Branch2 back to Master
      const branch2ToMaster = new IModelTransformer(branchDb2, masterDb, {
        isReverseSynchronization: true, // provenance stored in source/branch
      });
      await branch2ToMaster.processChanges(requestContext, changeSetBranch2State3);
      branch2ToMaster.dispose();
      assertPhysicalObjects(masterDb, state3);
      assert.equal(count(masterDb, ExternalSourceAspect.classFullName), 0);
      await masterDb.concurrencyControl.request(requestContext);
      masterDb.saveChanges();
      await masterDb.pushChanges(requestContext, "State2 -> State3");
      const changeSetMasterState3 = masterDb.changeSetId;
      assert.notEqual(changeSetMasterState3, changeSetMasterState2);
      branchDb2.saveChanges(); // saves provenance locally in case of re-merge

      // make change directly on Master
      const delta34 = [6, -7]; // update 6, delete 7
      const state4 = [1, 2, -3, 4, 5, 6, -7, 8];
      maintainPhysicalObjects(masterDb, delta34);
      assertPhysicalObjects(masterDb, state4);
      await masterDb.concurrencyControl.request(requestContext);
      masterDb.saveChanges();
      await masterDb.pushChanges(requestContext, "State3 -> State4");
      const changeSetMasterState4 = masterDb.changeSetId;
      assert.notEqual(changeSetMasterState4, changeSetMasterState3);

      // merge Master to Branch1
      const masterToBranch1 = new IModelTransformer(masterDb, branchDb1);
      await masterToBranch1.processChanges(requestContext, changeSetMasterState3);
      masterToBranch1.dispose();
      assertPhysicalObjects(branchDb1, state4);
      assertPhysicalObjectUpdated(branchDb1, 6);
      await branchDb1.concurrencyControl.request(requestContext);
      branchDb1.saveChanges();
      await branchDb1.pushChanges(requestContext, "State2 -> State4");
      const changeSetBranch1State4 = branchDb1.changeSetId;
      assert.notEqual(changeSetBranch1State4, changeSetBranch1State2);

      masterDb.close();
      branchDb1.close();
      branchDb2.close();

    } finally {
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, masterIModelId);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, branchIModelId1);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, branchIModelId2);
    }
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function populateMaster(iModelDb: IModelDb, numbers: number[]): void {
    SpatialCategory.insert(iModelDb, IModel.dictionaryId, "SpatialCategory", new SubCategoryAppearance());
    PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "PhysicalModel");
    maintainPhysicalObjects(iModelDb, numbers);
  }

  function assertPhysicalObjects(iModelDb: IModelDb, numbers: number[]): void {
    let numPhysicalObjects = 0;
    for (const n of numbers) {
      if (n > 0) { // negative "n" value means element was deleted
        ++numPhysicalObjects;
      }
      assertPhysicalObject(iModelDb, n);
    }
    assert.equal(numPhysicalObjects, count(iModelDb, PhysicalObject.classFullName));
  }

  function assertPhysicalObject(iModelDb: IModelDb, n: number): void {
    const physicalObjectId = getPhysicalObjectId(iModelDb, n);
    if (n > 0) {
      assert.isTrue(Id64.isValidId64(physicalObjectId), "Expected element to exist");
    } else {
      assert.equal(physicalObjectId, Id64.invalid, "Expected element to not exist"); // negative "n" means element was deleted
    }
  }

  function assertPhysicalObjectUpdated(iModelDb: IModelDb, n: number): void {
    assert.isTrue(n > 0);
    const physicalObjectId = getPhysicalObjectId(iModelDb, n);
    const physicalObject = iModelDb.elements.getElement(physicalObjectId, PhysicalObject);
    assert.isAtLeast(physicalObject.jsonProperties.updated, 1);
  }

  function getPhysicalObjectId(iModelDb: IModelDb, n: number): Id64String {
    const sql = `SELECT ECInstanceId FROM ${PhysicalObject.classFullName} WHERE UserLabel=:userLabel`;
    return iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String => {
      statement.bindString("userLabel", n.toString());
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }

  function maintainPhysicalObjects(iModelDb: IModelDb, numbers: number[]): void {
    const modelId = iModelDb.elements.queryElementIdByCode(PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, "PhysicalModel"))!;
    const categoryId = iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(iModelDb, IModel.dictionaryId, "SpatialCategory"))!;
    for (const n of numbers) {
      maintainPhysicalObject(iModelDb, modelId, categoryId, n);
    }
  }

  function maintainPhysicalObject(iModelDb: IModelDb, modelId: Id64String, categoryId: Id64String, n: number): Id64String {
    if (n > 0) { // positive "n" value means insert or update
      const physicalObjectId = getPhysicalObjectId(iModelDb, n);
      if (Id64.isValidId64(physicalObjectId)) { // if element exists, update it
        const physicalObject = iModelDb.elements.getElement(physicalObjectId, PhysicalObject);
        const numTimesUpdated: number = physicalObject.jsonProperties?.updated ?? 0;
        physicalObject.jsonProperties.updated = 1 + numTimesUpdated;
        physicalObject.update();
        return physicalObjectId;
      } else { // if element does not exist, insert it
        const physicalObjectProps: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: modelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: n.toString(),
          geom: IModelTransformerUtils.createBox(Point3d.create(1, 1, 1)),
          placement: {
            origin: Point3d.create(n, n, 0),
            angles: YawPitchRollAngles.createDegrees(0, 0, 0),
          },
        };
        return iModelDb.elements.insertElement(physicalObjectProps);
      }
    } else { // negative "n" value means delete
      const physicalObjectId = getPhysicalObjectId(iModelDb, -n);
      iModelDb.elements.deleteElement(physicalObjectId);
      return physicalObjectId;
    }
  }

  async function deleteIModelByName(requestContext: AuthorizedClientRequestContext, projectId: GuidString, iModelName: string): Promise<void> {
    try {
      const iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, iModelId);
    } catch (e) {
    }
  }
});

// cspell:words ecchange
