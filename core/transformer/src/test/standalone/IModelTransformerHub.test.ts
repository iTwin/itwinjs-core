/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import * as semver from "semver";
import {
  BisCoreSchema, BriefcaseDb, BriefcaseManager, deleteElementTree, ECSqlStatement, Element, ElementOwnsChildElements, ElementRefersToElements,
  ExternalSourceAspect, GenericSchema, HubMock, IModelDb, IModelHost, IModelJsFs, IModelJsNative, ModelSelector, NativeLoggerCategory, PhysicalModel,
  PhysicalObject, PhysicalPartition, SnapshotDb, SpatialCategory, Subject,
} from "@itwin/core-backend";

import * as BackendTestUtils from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbResult, Guid, GuidString, Id64, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, Code, ColorDef, ElementProps, IModel, IModelVersion, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelExporter, IModelImporter, IModelTransformer, TransformerLoggerCategory } from "../../core-transformer";
import {
  CountingIModelImporter, HubWrappers, IModelToTextFileExporter, IModelTransformerTestUtils, TestIModelTransformer,
  TransformerExtensiveTestScenario as TransformerExtensiveTestScenario,
} from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import "./TransformerTestStartup"; // calls startup/shutdown IModelHost before/after all tests
import * as sinon from "sinon";

describe("IModelTransformerHub", () => {
  const outputDir = join(KnownTestLocations.outputDir, "IModelTransformerHub");
  let iTwinId: GuidString;
  let accessToken: AccessToken;

  before(async () => {
    HubMock.startup("IModelTransformerHub", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
    IModelJsFs.recursiveMkDirSync(outputDir);

    accessToken = await HubWrappers.getAccessToken(BackendTestUtils.TestUserType.Regular);

    // initialize logging
    if (process.env.TRANSFORMER_TESTS_USE_LOG) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(TransformerLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelTransformer, LogLevel.Trace);
      Logger.setLevel(NativeLoggerCategory.Changeset, LogLevel.Trace);
    }
  });
  after(() => HubMock.shutdown());

  it("Transform source iModel to target iModel", async () => {
    // Create and push seed of source IModel
    const sourceIModelName = "TransformerSource";
    const sourceSeedFileName = join(outputDir, `${sourceIModelName}.bim`);
    if (IModelJsFs.existsSync(sourceSeedFileName))
      IModelJsFs.removeSync(sourceSeedFileName);

    const sourceSeedDb = SnapshotDb.createEmpty(sourceSeedFileName, { rootSubject: { name: "TransformerSource" } });
    assert.isTrue(IModelJsFs.existsSync(sourceSeedFileName));
    await BackendTestUtils.ExtensiveTestScenario.prepareDb(sourceSeedDb);
    sourceSeedDb.saveChanges();
    sourceSeedDb.close();

    const sourceIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: sourceIModelName, description: "source", version0: sourceSeedFileName, noLocks: true });

    // Create and push seed of target IModel
    const targetIModelName = "TransformerTarget";
    const targetSeedFileName = join(outputDir, `${targetIModelName}.bim`);
    if (IModelJsFs.existsSync(targetSeedFileName)) {
      IModelJsFs.removeSync(targetSeedFileName);
    }
    const targetSeedDb = SnapshotDb.createEmpty(targetSeedFileName, { rootSubject: { name: "TransformerTarget" } });
    assert.isTrue(IModelJsFs.existsSync(targetSeedFileName));
    await TransformerExtensiveTestScenario.prepareTargetDb(targetSeedDb);
    assert.isTrue(targetSeedDb.codeSpecs.hasName("TargetCodeSpec")); // inserted by prepareTargetDb
    targetSeedDb.saveChanges();
    targetSeedDb.close();
    const targetIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: targetIModelName, description: "target", version0: targetSeedFileName, noLocks: true });

    try {
      const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceIModelId });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetIModelId });
      assert.isTrue(sourceDb.isBriefcaseDb());
      assert.isTrue(targetDb.isBriefcaseDb());
      assert.isFalse(sourceDb.isSnapshot);
      assert.isFalse(targetDb.isSnapshot);
      assert.isTrue(targetDb.codeSpecs.hasName("TargetCodeSpec")); // make sure prepareTargetDb changes were saved and pushed to iModelHub

      if (true) { // initial import
        BackendTestUtils.ExtensiveTestScenario.populateDb(sourceDb);
        sourceDb.saveChanges();
        await sourceDb.pushChanges({ accessToken, description: "Populate source" });

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTransformerTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(accessToken);
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
        await transformer.processChanges(accessToken);
        transformer.dispose();
        targetDb.saveChanges();
        await targetDb.pushChanges({ accessToken, description: "Import #1" });
        TransformerExtensiveTestScenario.assertTargetDbContents(sourceDb, targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTransformerTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(accessToken);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect inserts and a few updates from transforming the result of populateSourceDb
        assert.isAtLeast(targetDbChanges.codeSpec.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.element.insertIds.size, 1);
        assert.isAtMost(targetDbChanges.element.updateIds.size, 1, "Expect the root Subject to be updated");
        assert.isAtLeast(targetDbChanges.aspect.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.insertIds.size, 1);
        assert.isAtMost(targetDbChanges.model.updateIds.size, 1, "Expect the RepositoryModel to be updated");
        assert.isTrue(targetDbChanges.model.updateIds.has(IModel.repositoryModelId));
        assert.isAtLeast(targetDbChanges.relationship.insertIds.size, 1);
        // expect no other changes from transforming the result of populateSourceDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
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
        await transformer.processChanges(accessToken);
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
        targetDb.saveChanges();
        assert.isFalse(targetDb.nativeDb.hasPendingTxns());
        await targetDb.pushChanges({ accessToken, description: "Should not actually push because there are no changes" });
      }

      if (true) { // update source db, then import again
        BackendTestUtils.ExtensiveTestScenario.updateDb(sourceDb);
        sourceDb.saveChanges();
        await sourceDb.pushChanges({ accessToken, description: "Update source" });

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTransformerTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(accessToken);
        assert.isTrue(IModelJsFs.existsSync(sourceExportFileName));
        const sourceDbChanges: any = (sourceExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(sourceDbChanges);
        // expect some inserts from updateDb
        assert.equal(sourceDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(sourceDbChanges.element.insertIds.size, 1);
        assert.equal(sourceDbChanges.aspect.insertIds.size, 0);
        assert.equal(sourceDbChanges.model.insertIds.size, 0);
        assert.equal(sourceDbChanges.relationship.insertIds.size, 2);
        // expect some updates from updateDb
        assert.isAtLeast(sourceDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from updateDb
        assert.isAtLeast(sourceDbChanges.element.deleteIds.size, 1);
        assert.equal(sourceDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from updateDb
        assert.equal(sourceDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(sourceDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(sourceDbChanges.aspect.deleteIds.size, 0);
        assert.equal(sourceDbChanges.model.deleteIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        await transformer.processChanges(accessToken);
        transformer.dispose();
        targetDb.saveChanges();
        await targetDb.pushChanges({ accessToken, description: "Import #2" });
        BackendTestUtils.ExtensiveTestScenario.assertUpdatesInDb(targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTransformerTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(accessToken);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect some inserts from transforming the result of updateDb
        assert.equal(targetDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(targetDbChanges.element.insertIds.size, 1);
        assert.equal(targetDbChanges.aspect.insertIds.size, 3);
        assert.equal(targetDbChanges.model.insertIds.size, 0);
        assert.equal(targetDbChanges.relationship.insertIds.size, 2);
        // expect some updates from transforming the result of updateDb
        assert.isAtLeast(targetDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from transforming the result of updateDb
        assert.isAtLeast(targetDbChanges.element.deleteIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.deleteIds.size, 1);
        assert.equal(targetDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from transforming the result of updateDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(targetDbChanges.model.deleteIds.size, 0);
      }

      const sourceIModelChangeSets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: sourceIModelId });
      const targetIModelChangeSets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: targetIModelId });
      assert.equal(sourceIModelChangeSets.length, 2);
      assert.equal(targetIModelChangeSets.length, 2);

      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    } finally {
      try {
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: sourceIModelId });
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: targetIModelId });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log("can't destroy", err);
      }
    }
  });

  it("Clone/upgrade test", async () => {
    const sourceIModelName: string = IModelTransformerTestUtils.generateUniqueName("CloneSource");
    const sourceIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: sourceIModelName, noLocks: true });
    assert.isTrue(Guid.isGuid(sourceIModelId));
    const targetIModelName: string = IModelTransformerTestUtils.generateUniqueName("CloneTarget");
    const targetIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: targetIModelName, noLocks: true });
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      // open/upgrade sourceDb
      const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceIModelId });
      const seedBisCoreVersion = sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!;
      assert.isTrue(semver.satisfies(seedBisCoreVersion, ">= 1.0.1"));
      await sourceDb.importSchemas([BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      const updatedBisCoreVersion = sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!;
      assert.isTrue(semver.satisfies(updatedBisCoreVersion, ">= 1.0.10"));
      assert.isTrue(sourceDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");
      const expectedHasPendingTxns: boolean = seedBisCoreVersion !== updatedBisCoreVersion;

      // push sourceDb schema changes
      assert.equal(sourceDb.nativeDb.hasPendingTxns(), expectedHasPendingTxns, "Expect importSchemas to have saved changes");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect no unsaved changes after importSchemas");
      await sourceDb.pushChanges({ accessToken, description: "Import schemas to upgrade BisCore" }); // may push schema changes

      // import schemas again to test common scenario of not knowing whether schemas are up-to-date or not..
      await sourceDb.importSchemas([BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isFalse(sourceDb.nativeDb.hasPendingTxns(), "Expect importSchemas to be a no-op");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect importSchemas to be a no-op");
      sourceDb.saveChanges(); // will be no changes to save in this case
      await sourceDb.pushChanges({ accessToken, description: "Import schemas again" }); // will be no changes to push in this case

      // populate sourceDb
      IModelTransformerTestUtils.populateTeamIModel(sourceDb, "Test", Point3d.createZero(), ColorDef.green);
      IModelTransformerTestUtils.assertTeamIModelContents(sourceDb, "Test");
      sourceDb.saveChanges();
      await sourceDb.pushChanges({ accessToken, description: "Populate Source" });

      // open/upgrade targetDb
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetIModelId });
      await targetDb.importSchemas([BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(targetDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");

      // push targetDb schema changes
      targetDb.saveChanges();
      await targetDb.pushChanges({ accessToken, description: "Upgrade BisCore" });

      // import sourceDb changes into targetDb
      const transformer = new IModelTransformer(new IModelExporter(sourceDb), targetDb);
      await transformer.processAll();
      transformer.dispose();
      IModelTransformerTestUtils.assertTeamIModelContents(targetDb, "Test");
      targetDb.saveChanges();
      await targetDb.pushChanges({ accessToken, description: "Import changes from sourceDb" });

      // close iModel briefcases
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    } finally {
      try {
        // delete iModel briefcases
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: sourceIModelId });
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: targetIModelId });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log("can't destroy", err);
      }
    }
  });

  it("should merge changes made on a branch back to master", async () => {
    const masterIModelName = "Master";
    const masterSeedFileName = join(outputDir, `${masterIModelName}.bim`);
    if (IModelJsFs.existsSync(masterSeedFileName))
      IModelJsFs.removeSync(masterSeedFileName);
    const masterSeedState = {1:1, 2:1, 20:1, 21:1};
    const masterSeedDb = SnapshotDb.createEmpty(masterSeedFileName, { rootSubject: { name: masterIModelName } });
    populateTimelineSeed(masterSeedDb, masterSeedState);
    assert(IModelJsFs.existsSync(masterSeedFileName));
    masterSeedDb.nativeDb.setITwinId(iTwinId); // WIP: attempting a workaround for "ContextId was not properly setup in the checkpoint" issue
    masterSeedDb.performCheckpoint();

    const masterSeed: TimelineIModelState = {
      // HACK: we know this will only be used for seeding via its path
      db: { pathName:  masterSeedFileName } as any as BriefcaseDb,
      id: "master-seed",
      state: masterSeedState,
    };

    const timeline: Timeline = {
      0: { master: { seed: masterSeed } }, // above: masterSeedState = {1:1, 2:1, 20:1, 21:1};
      1: { branch1: { branch: "master" }, branch2: { branch: "master" } },
      2: { branch1: { 1:1, 2:2, 3:1, 4:1, 20:1, 21:1 } },
      3: { branch1: { 1:2, 2:2, 4:1, 5:1, 6:1, 21:1 } },
      4: { branch1: { 1:2, 2:2, 4:1, 5:1, 6:1, 30:1 } },
      5: { master: { sync: ["branch1", 2] } },
      6: { branch2: { sync: ["master", 0] } },
      7: { branch2: { 1:2, 2:2, 4:1, 5:1, 6:1, 7:1, 8:1, 30:1 } }, // add 7 and 8
      // insert 9 and a conflicting state for 7 on master
      8: { master: { 1:2, 2:2, 4:1, 5:1, 6:1, 7:2, 9:1, 30:1 } },
      9: { master: { sync: ["branch2", 7] } },
      10: {
        assert({master}) {
          assert.equal(count(master.db, ExternalSourceAspect.classFullName), 0);
          // FIXME: why is this different from master?
          // branch2 won the conflict
          assertPhysicalObjects(master.db, {7:1}, { subset: true });
        },
      },
      11: { master: { 1:2, 2:2, 4:1, 5:1, 6:2, 8:1, 9:1, 30:1 } },
      12: { branch1: { sync: ["master", 4] } },
    };

    const { trackedIModels, tearDown } = await runTimeline(timeline);

    // create empty iModel meant to contain replayed master history
    const replayedIModelName = "Replayed";
    const replayedIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: replayedIModelName, description: "blank", noLocks: true });

    const replayedDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: replayedIModelId });
    assert.isTrue(replayedDb.isBriefcaseDb());
    assert.equal(replayedDb.iTwinId, iTwinId);

    try {
      const master = trackedIModels.get("master");
      assert(master);

      const masterDbChangesets = await IModelHost.hubAccess.downloadChangesets({ accessToken, iModelId: master.id, targetDir: BriefcaseManager.getChangeSetsPath(master.id) });
      assert.equal(masterDbChangesets.length, 4);
      const masterDeletedElementIds = new Set<Id64String>();
      for (const masterDbChangeset of masterDbChangesets) {
        assert.isDefined(masterDbChangeset.id);
        assert.isDefined(masterDbChangeset.description); // test code above always included a change description when pushChanges was called
        const changesetPath = masterDbChangeset.pathname;
        assert.isTrue(IModelJsFs.existsSync(changesetPath));
        // below is one way of determining the set of elements that were deleted in a specific changeset
        const statusOrResult = master.db.nativeDb.extractChangedInstanceIdsFromChangeSets([changesetPath]);
        assert.isUndefined(statusOrResult.error);
        const result = statusOrResult.result;
        if (result === undefined)
          throw Error("expected to be defined");

        assert.isDefined(result.element);
        if (result.element?.delete) {
          result.element.delete.forEach((id: Id64String) => masterDeletedElementIds.add(id));
        }
      }
      assert.isAtLeast(masterDeletedElementIds.size, 1);

      // replay master history to create replayed iModel
      const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: master.id, asOf: IModelVersion.first().toJSON() });
      const replayTransformer = new IModelTransformer(sourceDb, replayedDb);
      // this replay strategy pretends that deleted elements never existed
      for (const elementId of masterDeletedElementIds) {
        replayTransformer.exporter.excludeElement(elementId);
      }
      // note: this test knows that there were no schema changes, so does not call `processSchemas`
      await replayTransformer.processAll(); // process any elements that were part of the "seed"
      await saveAndPushChanges(replayedDb, "changes from source seed");
      for (const masterDbChangeset of masterDbChangesets) {
        await sourceDb.pullChanges({ accessToken, toIndex: masterDbChangeset.index });
        await replayTransformer.processChanges(accessToken, sourceDb.changeset.id);
        await saveAndPushChanges(replayedDb, masterDbChangeset.description ?? "");
      }
      replayTransformer.dispose();
      sourceDb.close();
      assertPhysicalObjects(replayedDb, master.state); // should have same ending state as masterDb

      // make sure there are no deletes in the replay history (all elements that were eventually deleted from masterDb were excluded)
      const replayedDbChangesets = await IModelHost.hubAccess.downloadChangesets({ accessToken, iModelId: replayedIModelId, targetDir: BriefcaseManager.getChangeSetsPath(replayedIModelId) });
      assert.isAtLeast(replayedDbChangesets.length, masterDbChangesets.length); // replayedDb will have more changesets when seed contains elements
      const replayedDeletedElementIds = new Set<Id64String>();
      for (const replayedDbChangeset of replayedDbChangesets) {
        assert.isDefined(replayedDbChangeset.id);
        const changesetPath = replayedDbChangeset.pathname;
        assert.isTrue(IModelJsFs.existsSync(changesetPath));
        // below is one way of determining the set of elements that were deleted in a specific changeset
        const statusOrResult = replayedDb.nativeDb.extractChangedInstanceIdsFromChangeSets([changesetPath]);
        const result = statusOrResult.result;
        if (result === undefined)
          throw Error("expected to be defined");

        assert.isDefined(result.element);
        if (result.element?.delete) {
          result.element.delete.forEach((id: Id64String) => replayedDeletedElementIds.add(id));
        }
      }
      assert.equal(replayedDeletedElementIds.size, 0);
    } finally {
      await tearDown();
      replayedDb.close();
      await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: replayedIModelId });
    }
  });

  it("ModelSelector processChanges", async () => {
    const sourceIModelName = "ModelSelectorSource";
    const sourceIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: sourceIModelName, noLocks: true });
    let targetIModelId!: GuidString;
    assert.isTrue(Guid.isGuid(sourceIModelId));

    try {
      const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceIModelId });

      // setup source
      const physModel1Id = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "phys-model-1");
      const physModel2Id = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "phys-model-2");
      const modelSelectorInSource = ModelSelector.create(sourceDb, IModelDb.dictionaryId, "model-selector", [physModel1Id]);
      const modelSelectorCode = modelSelectorInSource.code;
      const modelSelectorId = modelSelectorInSource.insert();
      sourceDb.saveChanges();
      await sourceDb.pushChanges({ accessToken, description: "setup source models and selector" });

      // create target branch
      const targetIModelName = "ModelSelectorTarget";
      sourceDb.performCheckpoint();

      targetIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: targetIModelName, noLocks: true, version0: sourceDb.pathName });
      assert.isTrue(Guid.isGuid(targetIModelId));
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetIModelId });
      await targetDb.importSchemas([BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(targetDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");
      const provenanceInitializer = new IModelTransformer(sourceDb, targetDb, { wasSourceIModelCopiedToTarget: true });
      await provenanceInitializer.processSchemas();
      await provenanceInitializer.processAll();
      provenanceInitializer.dispose();

      // update source (add model2 to model selector)
      // (it's important that we only change the model selector here to keep the changes isolated)
      const modelSelectorUpdate = sourceDb.elements.getElement<ModelSelector>(modelSelectorId, ModelSelector);
      modelSelectorUpdate.models = [...modelSelectorUpdate.models, physModel2Id];
      modelSelectorUpdate.update();
      sourceDb.saveChanges();
      await sourceDb.pushChanges({ accessToken, description: "add model2 to model selector" });

      // check that the model selector has the expected change in the source
      const modelSelectorUpdate2 = sourceDb.elements.getElement<ModelSelector>(modelSelectorId, ModelSelector);
      expect(modelSelectorUpdate2.models).to.have.length(2);

      // test extracted changed ids
      const sourceDbChangesets = await IModelHost.hubAccess.downloadChangesets({ accessToken, iModelId: sourceIModelId, targetDir: BriefcaseManager.getChangeSetsPath(sourceIModelId) });
      expect(sourceDbChangesets).to.have.length(2);
      const latestChangeset = sourceDbChangesets[1];
      const extractedChangedIds = sourceDb.nativeDb.extractChangedInstanceIdsFromChangeSets([latestChangeset.pathname]);
      const expectedChangedIds: IModelJsNative.ChangedInstanceIdsProps = {
        element: { update: [modelSelectorId] },
        model: { update: [IModel.dictionaryId] }, // containing model will also get last modification time updated
      };
      expect(extractedChangedIds.result).to.deep.equal(expectedChangedIds);

      // synchronize
      let didExportModelSelector = false, didImportModelSelector = false;
      class IModelImporterInjected extends IModelImporter {
        public override importElement(sourceElement: ElementProps): Id64String {
          if (sourceElement.id === modelSelectorId)
            didImportModelSelector = true;
          return super.importElement(sourceElement);
        }
      }
      class IModelTransformerInjected extends IModelTransformer {
        public override async onExportElement(sourceElement: Element) {
          if (sourceElement.id === modelSelectorId)
            didExportModelSelector = true;
          return super.onExportElement(sourceElement);
        }
      }
      const synchronizer = new IModelTransformerInjected(sourceDb, new IModelImporterInjected(targetDb));
      await synchronizer.processChanges(accessToken);
      expect(didExportModelSelector).to.be.true;
      expect(didImportModelSelector).to.be.true;
      synchronizer.dispose();
      targetDb.saveChanges();
      await targetDb.pushChanges({ accessToken, description: "synchronize" });

      // check that the model selector has the expected change in the target
      const modelSelectorInTargetId = targetDb.elements.queryElementIdByCode(modelSelectorCode);
      assert(modelSelectorInTargetId !== undefined, `expected obj ${modelSelectorInTargetId} to be defined`);

      const modelSelectorInTarget = targetDb.elements.getElement<ModelSelector>(modelSelectorInTargetId, ModelSelector);
      expect(modelSelectorInTarget.models).to.have.length(2);

      // close iModel briefcases
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    } finally {
      try {
        // delete iModel briefcases
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: sourceIModelId });
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: targetIModelId });
      } catch (err) {
        assert.fail(err, undefined, "failed to clean up");
      }
    }
  });

  it("should delete branch-deleted elements in reverse synchronization", async () => {
    const masterIModelName = "ReSyncDeleteMaster";
    const masterIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: masterIModelName, noLocks: true });
    let branchIModelId!: GuidString;
    assert.isTrue(Guid.isGuid(masterIModelId));

    try {
      const masterDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: masterIModelId });

      // populate master
      const categId = SpatialCategory.insert(masterDb, IModel.dictionaryId, "category", new SubCategoryAppearance());
      const modelToDeleteWithElemId = PhysicalModel.insert(masterDb, IModel.rootSubjectId, "model-to-delete-with-elem");
      const makePhysObjCommonProps = (num: number) => ({
        classFullName: PhysicalObject.classFullName,
        category: categId,
        geom: IModelTransformerTestUtils.createBox(Point3d.create(num, num, num)),
        placement: {
          origin: Point3d.create(num, num, num),
          angles: YawPitchRollAngles.createDegrees(num, num, num),
        },
      } as const);
      const elemInModelToDeleteId = new PhysicalObject({
        ...makePhysObjCommonProps(1),
        model: modelToDeleteWithElemId,
        code: new Code({ spec: IModelDb.rootSubjectId, scope: IModelDb.rootSubjectId, value: "elem-in-model-to-delete" }),
        userLabel: "elem-in-model-to-delete",
      }, masterDb).insert();
      const notDeletedModelId = PhysicalModel.insert(masterDb, IModel.rootSubjectId, "not-deleted-model");
      const elemToDeleteWithChildrenId = new PhysicalObject({
        ...makePhysObjCommonProps(2),
        model: notDeletedModelId,
        code: new Code({ spec: IModelDb.rootSubjectId, scope: IModelDb.rootSubjectId, value: "deleted-elem-with-children" }),
        userLabel: "deleted-elem-with-children",
      }, masterDb).insert();
      const childElemOfDeletedId = new PhysicalObject({
        ...makePhysObjCommonProps(3),
        model: notDeletedModelId,
        code: new Code({ spec: IModelDb.rootSubjectId, scope: IModelDb.rootSubjectId, value: "child-elem-of-deleted" }),
        userLabel: "child-elem-of-deleted",
        parent: new ElementOwnsChildElements(elemToDeleteWithChildrenId),
      }, masterDb).insert();
      const childSubjectId = Subject.insert(masterDb, IModel.rootSubjectId, "child-subject");
      const modelInChildSubjectId = PhysicalModel.insert(masterDb, childSubjectId, "model-in-child-subject");
      const childSubjectChildId = Subject.insert(masterDb, childSubjectId, "child-subject-child");
      const modelInChildSubjectChildId = PhysicalModel.insert(masterDb, childSubjectChildId, "model-in-child-subject-child");
      masterDb.performCheckpoint();
      await masterDb.pushChanges({ accessToken, description: "setup master" });

      // create and initialize branch from master
      const branchIModelName = "RevSyncDeleteBranch";
      branchIModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName: branchIModelName, noLocks: true, version0: masterDb.pathName });
      assert.isTrue(Guid.isGuid(branchIModelId));
      const branchDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: branchIModelId });
      await branchDb.importSchemas([BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(branchDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");
      const provenanceInitializer = new IModelTransformer(masterDb, branchDb, { wasSourceIModelCopiedToTarget: true });
      await provenanceInitializer.processSchemas();
      await provenanceInitializer.processAll();
      provenanceInitializer.dispose();
      branchDb.saveChanges();
      await branchDb.pushChanges({ accessToken, description: "setup branch" });

      const modelToDeleteWithElem = {
        entity: branchDb.models.getModel(modelToDeleteWithElemId),
        aspects: branchDb.elements.getAspects(modelToDeleteWithElemId),
      };
      const elemToDeleteWithChildren = {
        entity: branchDb.elements.getElement(elemToDeleteWithChildrenId),
        aspects: branchDb.elements.getAspects(elemToDeleteWithChildrenId),
      };
      const childElemOfDeleted = {
        aspects: branchDb.elements.getAspects(childElemOfDeletedId),
      };
      const elemInModelToDelete = {
        aspects: branchDb.elements.getAspects(elemInModelToDeleteId),
      };
      const childSubject = {
        entity: branchDb.elements.getElement(childSubjectId),
        aspects: branchDb.elements.getAspects(childSubjectId),
      };
      const modelInChildSubject = {
        entity: branchDb.models.getModel(modelInChildSubjectId),
        aspects: branchDb.elements.getAspects(modelInChildSubjectId),
      };
      const childSubjectChild = {
        entity: branchDb.elements.getElement(childSubjectChildId),
        aspects: branchDb.elements.getAspects(childSubjectChildId),
      };
      const modelInChildSubjectChild = {
        entity: branchDb.models.getModel(modelInChildSubjectChildId),
        aspects: branchDb.elements.getAspects(modelInChildSubjectChildId),
      };

      elemToDeleteWithChildren.entity.delete();
      modelToDeleteWithElem.entity.delete();
      deleteElementTree(branchDb, modelToDeleteWithElemId);
      deleteElementTree(branchDb, childSubjectId);
      branchDb.saveChanges();
      await branchDb.pushChanges({ accessToken, description: "branch deletes" });

      // verify the branch state
      expect(branchDb.models.tryGetModel(modelToDeleteWithElemId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(elemInModelToDeleteId)).to.be.undefined;
      expect(branchDb.models.tryGetModel(notDeletedModelId)).not.to.be.undefined;
      expect(branchDb.elements.tryGetElement(elemToDeleteWithChildrenId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(childElemOfDeletedId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(childSubjectId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(modelInChildSubjectId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(childSubjectChildId)).to.be.undefined;
      expect(branchDb.elements.tryGetElement(modelInChildSubjectChildId)).to.be.undefined;

      // expected extracted changed ids
      const branchDbChangesets = await IModelHost.hubAccess.downloadChangesets({ accessToken, iModelId: branchIModelId, targetDir: BriefcaseManager.getChangeSetsPath(branchIModelId) });
      expect(branchDbChangesets).to.have.length(2);
      const latestChangeset = branchDbChangesets[1];
      const extractedChangedIds = branchDb.nativeDb.extractChangedInstanceIdsFromChangeSets([latestChangeset.pathname]);
      const expectedChangedIds: IModelJsNative.ChangedInstanceIdsProps = {
        aspect: {
          delete: [
            ...modelToDeleteWithElem.aspects,
            ...childSubject.aspects,
            ...modelInChildSubject.aspects,
            ...childSubjectChild.aspects,
            ...modelInChildSubjectChild.aspects,
            ...elemInModelToDelete.aspects,
            ...elemToDeleteWithChildren.aspects,
            ...childElemOfDeleted.aspects,
          ].map((a) => a.id),
        },
        element: {
          delete: [
            modelToDeleteWithElemId,
            elemInModelToDeleteId,
            elemToDeleteWithChildrenId,
            childElemOfDeletedId,
            childSubjectId,
            modelInChildSubjectId,
            childSubjectChildId,
            modelInChildSubjectChildId,
          ],
        },
        model: {
          update: [IModelDb.rootSubjectId, notDeletedModelId], // containing model will also get last modification time updated
          delete: [modelToDeleteWithElemId, modelInChildSubjectId, modelInChildSubjectChildId],
        },
      };
      expect(extractedChangedIds.result).to.deep.equal(expectedChangedIds);

      const synchronizer = new IModelTransformer(branchDb, masterDb, {
        // NOTE: not using a targetScopeElementId because this test deals with temporary dbs, but that is a bad practice, use one
        isReverseSynchronization: true,
      });
      await synchronizer.processChanges(accessToken);
      branchDb.saveChanges();
      await branchDb.pushChanges({ accessToken, description: "synchronize" });
      synchronizer.dispose();

      const getFromTarget = (sourceEntityId: Id64String, type: "elem" | "model") => {
        const sourceEntity = masterDb.elements.tryGetElement(sourceEntityId);
        if (sourceEntity === undefined)
          return undefined;
        const codeVal = sourceEntity.code.value;
        assert(codeVal !== undefined, "all tested elements must have a code value");
        const targetId = IModelTransformerTestUtils.queryByCodeValue(masterDb, codeVal);
        if (Id64.isInvalid(targetId))
          return undefined;
        return type === "model"
          ? masterDb.models.tryGetModel(targetId)
          : masterDb.elements.tryGetElement(targetId);
      };

      // verify the master state
      expect(getFromTarget(modelToDeleteWithElemId, "model")).to.be.undefined;
      expect(getFromTarget(elemInModelToDeleteId, "elem")).to.be.undefined;
      expect(getFromTarget(notDeletedModelId, "model")).not.to.be.undefined;
      expect(getFromTarget(elemToDeleteWithChildrenId, "elem")).to.be.undefined;
      expect(getFromTarget(childElemOfDeletedId, "elem")).to.be.undefined;
      expect(getFromTarget(childSubjectId, "elem")).to.be.undefined;
      expect(getFromTarget(modelInChildSubjectId, "model")).to.be.undefined;
      expect(getFromTarget(childSubjectChildId, "elem")).to.be.undefined;
      expect(getFromTarget(modelInChildSubjectChildId, "model")).to.be.undefined;

      // close iModel briefcases
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, masterDb);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, branchDb);
    } finally {
      // delete iModel briefcases
      await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: masterIModelId });
      if (branchIModelId) {
        await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: branchIModelId });
      }
    }
  });

  it("should not download more changesets than necessary", async () => {
    const timeline: Timeline = {
      0: { master: { 1:1 } },
      1: { branch: { branch: "master" } },
      2: { branch: { 1:2, 2:1 } },
      3: { branch: { 1:2, 3:3 } },
    };

    const { trackedIModels, timelineStates, tearDown } = await runTimeline(timeline);

    const master = trackedIModels.get("master")!;
    const branch = trackedIModels.get("branch")!;
    const branchAt2Changeset = timelineStates.get(2)?.changesets.branch;
    assert(branchAt2Changeset?.index);
    const branchAt2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: branch.id, asOf: { first: true } });
    await branchAt2.pullChanges({ toIndex: branchAt2Changeset.index, accessToken });

    const syncer = new IModelTransformer(branchAt2, master.db, {
      isReverseSynchronization: true,
    });
    const queryChangeset = sinon.spy(HubMock, "queryChangeset");
    await syncer.processChanges(accessToken, branchAt2Changeset.id);
    expect(queryChangeset.alwaysCalledWith({
      accessToken,
      iModelId: branch.id,
      changeset: {
        id: branchAt2Changeset.id,
      },
    })).to.be.true;

    syncer.dispose();
    await tearDown();
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  async function saveAndPushChanges(briefcaseDb: BriefcaseDb, description: string): Promise<void> {
    briefcaseDb.saveChanges(description);
    await briefcaseDb.pushChanges({ accessToken, description });
  }

  function getPhysicalObjects(iModelDb: IModelDb): Record<number, number> {
    return iModelDb.withPreparedStatement(
      `SELECT UserLabel, JsonProperties FROM ${PhysicalObject.classFullName}`,
      (s) =>
        Object.fromEntries(
          [...s].map((r) => [r.userLabel, r.jsonProperties && JSON.parse(r.jsonProperties).updateState])
        )
    );
  }

  function populateTimelineSeed(db: IModelDb, state: Record<number, number>): void {
    SpatialCategory.insert(db, IModel.dictionaryId, "SpatialCategory", new SubCategoryAppearance());
    PhysicalModel.insert(db, IModel.rootSubjectId, "PhysicalModel");
    maintainPhysicalObjects(db, state);
    db.performCheckpoint();
  }

  function assertPhysicalObjects(iModelDb: IModelDb, numbers: Record<number, number>, { subset = false } = {}): void {
    if (subset) {
      for (const n in numbers) {
        if (typeof n !== "string")
          continue;
        assertPhysicalObject(iModelDb, Number(n));
      }
    } else {
      assert.deepEqual(getPhysicalObjects(iModelDb), numbers);
    }
  }

  function assertPhysicalObject(iModelDb: IModelDb, n: number): void {
    const physicalObjectId = getPhysicalObjectId(iModelDb, n);
    if (n > 0) {
      assert.isTrue(Id64.isValidId64(physicalObjectId), `Expected element ${n} to exist`);
    } else {
      assert.equal(physicalObjectId, Id64.invalid, `Expected element ${n} to not exist`); // negative "n" means element was deleted
    }
  }

  function getPhysicalObjectId(iModelDb: IModelDb, n: number): Id64String {
    const sql = `SELECT ECInstanceId FROM ${PhysicalObject.classFullName} WHERE UserLabel=:userLabel`;
    return iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String => {
      statement.bindString("userLabel", n.toString());
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }

  function maintainPhysicalObjects(iModelDb: IModelDb, numbers: Record<number, number>): void {
    const modelId = iModelDb.elements.queryElementIdByCode(PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, "PhysicalModel"))!;
    const categoryId = iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(iModelDb, IModel.dictionaryId, "SpatialCategory"))!;
    const currentObjs = getPhysicalObjects(iModelDb);
    const objsToDelete = Object.keys(currentObjs).filter((n) => !(n in numbers));
    for (const obj of objsToDelete) {
      const id = getPhysicalObjectId(iModelDb, Number(obj));
      iModelDb.elements.deleteElement(id);
    }
    for (const i in numbers) {
      if (typeof i !== "string")
        continue;
      const n = Number(i);
      const value = numbers[i];
      const physicalObjectId = getPhysicalObjectId(iModelDb, n);
      if (Id64.isValidId64(physicalObjectId)) { // if element exists, update it
        const physicalObject = iModelDb.elements.getElement(physicalObjectId, PhysicalObject);
        physicalObject.jsonProperties.updateState = value;
        physicalObject.update();
      } else { // if element does not exist, insert it
        const physicalObjectProps: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: modelId,
          category: categoryId,
          code: new Code({ spec: IModelDb.rootSubjectId, scope: IModelDb.rootSubjectId, value: n.toString() }),
          userLabel: n.toString(),
          geom: IModelTransformerTestUtils.createBox(Point3d.create(1, 1, 1)),
          placement: {
            origin: Point3d.create(n, n, 0),
            angles: YawPitchRollAngles.createDegrees(0, 0, 0),
          },
          jsonProperties: {
            updateState: value,
          },
        };
        iModelDb.elements.insertElement(physicalObjectProps);
      }
    }
    // TODO: iModelDb.performCheckpoint?
    iModelDb.saveChanges();
  }

  interface TimelineIModelState {
    state: Record<number, number>;
    id: string;
    db: BriefcaseDb;
  }

  type TimelineStateChange =
    // update the state of that model to match and push a changeset
    | Record<number, number>
    // create a new iModel from a seed
    | { seed: TimelineIModelState }
    // create a branch from an existing iModel with a given name
    | { branch: string }
    // synchronize with the changes in an iModel of a given name from a starting timeline point
    // to the given ending point, inclusive. (end defaults to current point in time)
    | { sync: [string, number] };

  /** For each step in timeline, an object of iModels mapping to the event that occurs for them:
   * - a 'seed' event with an iModel to seed from, creating the iModel
   * - a 'branch' event with the name of an iModel to seed from, creating the iModel
   * - a 'sync' event with the name of an iModel and timeline point to sync from
   * - an object containing the content of the iModel that it updates to,
   *   creating the iModel with this initial state if it didn't exist before
   * - an 'assert' function to run on the state of all the iModels in the timeline
   *
   * @note because the timeline manages PhysicalObjects for the state, any seed must contain the necessary
   * model and category, which can be added to your seed by calling @see populateTimelineSeed
   */
  type Timeline = Record<number, {
    assert?: (imodels: Record<string, TimelineIModelState>) => void;
    [modelName: string]: | undefined // only necessary for the previous optional properties
    | ((imodels: Record<string, TimelineIModelState>) => void) // only necessary for the assert property
    | TimelineStateChange;
  }>;

  /**
   * Run the branching and synchronization events in a @see Timeline object
   * you can print additional debug info from this by setting in your env TRANSFORMER_BRANCH_TEST_DEBUG=1
   */
  async function runTimeline(timeline: Timeline) {
    const trackedIModels = new Map<string, TimelineIModelState>();
    const masterOfBranch = new Map<string, string>();

    /* eslint-disable @typescript-eslint/indent */
    const timelineStates = new Map<
      number,
      {
        states: { [iModelName: string]: Record<number, number> };
        changesets: { [iModelName: string]: ChangesetIdWithIndex };
      }
    >();
    /* eslint-enable @typescript-eslint/indent */

    for (let i = 0; i < Object.values(timeline).length; ++i) {
      const pt = timeline[i];
      const iModelChanges = Object.entries(pt)
        .filter((entry): entry is [string, TimelineStateChange] => entry[0] !== "assert" && trackedIModels.has(entry[0]));

      const newIModels = Object.keys(pt).filter((s) => s !== "assert" && !trackedIModels.has(s));

      for (const newIModelName of newIModels) {
        assert(newIModelName !== "assert", "should have already been filtered out");

        const newIModelEvent = pt[newIModelName];
        assert(typeof newIModelEvent === "object");
        assert(!("sync" in newIModelEvent), "cannot sync an iModel that hasn't been created yet!");

        const seed
          = "seed" in newIModelEvent
            ? newIModelEvent.seed
            : "branch" in newIModelEvent
              ? trackedIModels.get(newIModelEvent.branch)!
              : undefined;

        const newIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: newIModelName, version0: seed?.db.pathName, noLocks: true });

        const newIModelDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: newIModelId });
        assert.isTrue(newIModelDb.isBriefcaseDb());
        assert.equal(newIModelDb.iTwinId, iTwinId);

        trackedIModels.set(newIModelName, {
          state: seed?.state ?? newIModelEvent as number[],
          db: newIModelDb,
          id: newIModelId,
        });

        const isNewBranch = "branch" in newIModelEvent;
        if (isNewBranch) {
          assert(seed);
          masterOfBranch.set(newIModelName, newIModelEvent.branch);
          const master = seed;
          const branchDb = newIModelDb;
          // record branch provenance
          const provenanceInserter = new IModelTransformer(master.db, branchDb, { wasSourceIModelCopiedToTarget: true });
          await provenanceInserter.processAll();
          provenanceInserter.dispose();
          assert.equal(count(master.db, ExternalSourceAspect.classFullName), 0);
          assert.isAbove(count(branchDb, ExternalSourceAspect.classFullName), Object.keys(master.state).length);
          await saveAndPushChanges(branchDb, "initialized branch provenance");
        } else if ("seed" in newIModelEvent) {
          await saveAndPushChanges(newIModelDb, `seeded from '${newIModelEvent.seed.id}' at point ${i}`);
        } else {
          populateTimelineSeed(newIModelDb, newIModelEvent);
          await saveAndPushChanges(newIModelDb, `new with state [${newIModelEvent}] at point ${i}`);
        }

        if (seed) {
          assertPhysicalObjects(newIModelDb, seed.state);
        }
      }

      for (const [iModelName, event] of iModelChanges) {
        if ("branch" in event || "seed" in event) {
          // "branch" and "seed" event has already been handled in the new imodels loop above
          continue;
        } else if ("sync" in event) {
          const [syncSource, startIndex] = event.sync;
          // if the synchronization source is master, it's a normal sync
          const isForwardSync = masterOfBranch.get(iModelName) === syncSource;
          const target = trackedIModels.get(iModelName)!;
          const source = trackedIModels.get(syncSource)!;
          const targetStateBefore = getPhysicalObjects(target.db);
          const syncer = new IModelTransformer(source.db, target.db, { isReverseSynchronization: !isForwardSync });
          const startChangesetId = timelineStates.get(startIndex)?.changesets[syncSource].id;
          await syncer.processChanges(accessToken, startChangesetId);
          syncer.dispose();

          const stateMsg = `synced changes from ${syncSource} to ${iModelName} at ${i}`;
          if (process.env.TRANSFORMER_BRANCH_TEST_DEBUG) {
            /* eslint-disable no-console */
            console.log(stateMsg);
            console.log(` source range state: ${JSON.stringify(source.state)}`);
            const targetState = getPhysicalObjects(target.db);
            console.log(`target before state: ${JSON.stringify(targetStateBefore)}`);
            console.log(` target after state: ${JSON.stringify(targetState)}`);
            /* eslint-enable no-console */
          }
          // subset because we don't care about elements that the target added itself
          assertPhysicalObjects(target.db, source.state, { subset: true });
          target.state = source.state; // update the tracking state

          await saveAndPushChanges(target.db, stateMsg);
        } else {
          const newState = event;
          const alreadySeenIModel = trackedIModels.get(iModelName)!;
          const prevState = alreadySeenIModel.state;
          alreadySeenIModel.state = event;
          // `(maintain|assert)PhysicalObjects` use negative to mean deleted
          const additions = Object.keys(newState).filter((s) => !(s in prevState)).map(Number);
          const deletions = Object.keys(prevState).filter((s) => !(s in newState)).map(Number);
          const delta = [...additions, ...deletions.map((d) => -d)];

          const stateMsg = `${iModelName} becomes: ${JSON.stringify(event)}, delta: [${delta}], at ${i}`;
          if (process.env.TRANSFORMER_BRANCH_TEST_DEBUG) {
            console.log(stateMsg); // eslint-disable-line no-console
          }

          maintainPhysicalObjects(alreadySeenIModel.db, newState);
          await saveAndPushChanges(alreadySeenIModel.db, stateMsg);
        }
      }

      if (pt.assert) {
        pt.assert(Object.fromEntries(trackedIModels));
      }

      timelineStates.set(
        i,
        {
          changesets: Object.fromEntries([...trackedIModels].map(([name, state]) => [name, state.db.changeset])),
          states: Object.fromEntries([...trackedIModels].map(([name, state]) => [name, state.state])),
        }
      );
    }

    return {
      trackedIModels,
      timelineStates,
      tearDown: async () => {
        for (const [, state] of trackedIModels) {
          state.db.close();
          await IModelHost.hubAccess.deleteIModel({ iTwinId, iModelId: state.id });
        }
      },
    };
  }
});
