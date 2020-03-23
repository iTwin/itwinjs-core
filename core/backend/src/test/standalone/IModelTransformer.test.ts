/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { AxisAlignedBox3d, Code, ColorDef, CreateIModelProps, GeometricElement3dProps, IModel, Placement3d } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import {
  BackendLoggerCategory, BackendRequestContext, BriefcaseManager, ECSqlStatement, Element, ElementMultiAspect, ElementRefersToElements, ElementUniqueAspect, ExternalSourceAspect,
  IModelCloneContext, IModelDb, IModelExporter, IModelJsFs, IModelTransformer, InformationRecordModel, InformationRecordPartition,
  PhysicalModel, PhysicalObject, PhysicalPartition, SpatialCategory, Subject, SnapshotDb,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { ClassCounter, IModelToTextFileExporter, IModelTransformer3d, IModelTransformerUtils, RecordingIModelImporter, TestIModelTransformer } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("IModelTransformer", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "IModelTransformer");

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
    }
  });

  it("should import", async () => {
    // Source IModelDb
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "TestIModelTransformer-Source" } });
    await IModelTransformerUtils.prepareSourceDb(sourceDb);
    IModelTransformerUtils.populateSourceDb(sourceDb);
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "TestIModelTransformer-Target" } });
    await IModelTransformerUtils.prepareTargetDb(targetDb);
    targetDb.saveChanges();

    const numSourceUniqueAspects: number = count(sourceDb, ElementUniqueAspect.classFullName);
    const numSourceMultiAspects: number = count(sourceDb, ElementMultiAspect.classFullName);
    const numSourceRelationships: number = count(sourceDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numSourceUniqueAspects, 1);
    assert.isAtLeast(numSourceMultiAspects, 1);
    assert.isAtLeast(numSourceRelationships, 1);

    if (true) { // initial import
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Initial Import");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      assert.isTrue(transformer.context.isBetweenIModels);
      transformer.processAll();
      assert.isAtLeast(targetImporter.numModelsInserted, 1);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.isAtLeast(targetImporter.numElementsInserted, 1);
      assert.isAtLeast(targetImporter.numElementsUpdated, 1);
      assert.equal(targetImporter.numElementsDeleted, 0);
      assert.isAtLeast(targetImporter.numElementAspectsInserted, 1);
      assert.equal(targetImporter.numElementAspectsUpdated, 0);
      assert.isAtLeast(targetImporter.numRelationshipsInserted, 1);
      assert.equal(targetImporter.numRelationshipsUpdated, 0);
      assert.isAtLeast(count(targetDb, ElementRefersToElements.classFullName), 1);
      assert.isAtLeast(count(targetDb, InformationRecordPartition.classFullName), 1);
      assert.isAtLeast(count(targetDb, InformationRecordModel.classFullName), 1);
      assert.isAtLeast(count(targetDb, "TestTransformerTarget:PhysicalPartitionIsTrackedByRecords"), 1);
      assert.isAtLeast(count(targetDb, "TestTransformerTarget:AuditRecord"), 1);
      assert.equal(3, count(targetDb, "TestTransformerTarget:TargetInformationRecord"));
      targetDb.saveChanges();
      IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb);
      transformer.context.dump(targetDbFile + ".context.txt");
      transformer.dispose();
    }

    const numTargetElements: number = count(targetDb, Element.classFullName);
    const numTargetUniqueAspects: number = count(targetDb, ElementUniqueAspect.classFullName);
    const numTargetMultiAspects: number = count(targetDb, ElementMultiAspect.classFullName);
    const numTargetExternalSourceAspects: number = count(targetDb, ExternalSourceAspect.classFullName);
    const numTargetRelationships: number = count(targetDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numTargetUniqueAspects, 1);
    assert.isAtLeast(numTargetMultiAspects, 1);

    if (true) { // tests of IModelExporter
      // test #1 - export structure
      const exportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source-Export.txt");
      assert.isFalse(IModelJsFs.existsSync(exportFileName));
      const exporter = new IModelToTextFileExporter(sourceDb, exportFileName);
      exporter.export();
      assert.isTrue(IModelJsFs.existsSync(exportFileName));

      // test #2 - count occurrences of classFullNames
      const classCountsFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source-Counts.txt");
      assert.isFalse(IModelJsFs.existsSync(classCountsFileName));
      const classCounter = new ClassCounter(sourceDb, classCountsFileName);
      classCounter.count();
      assert.isTrue(IModelJsFs.existsSync(classCountsFileName));
    }

    if (true) { // second import with no changes to source, should be a no-op
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport (no-op)");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      transformer.processAll();
      assert.equal(targetImporter.numModelsInserted, 0);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.equal(targetImporter.numElementsInserted, 0);
      assert.equal(targetImporter.numElementsUpdated, 0);
      assert.equal(targetImporter.numElementsDeleted, 0);
      assert.equal(targetImporter.numElementAspectsInserted, 0);
      assert.equal(targetImporter.numElementAspectsUpdated, 0);
      assert.equal(targetImporter.numRelationshipsInserted, 0);
      assert.equal(targetImporter.numRelationshipsUpdated, 0);
      assert.equal(targetImporter.numRelationshipsDeleted, 0);
      assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
      assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
      assert.equal(3, count(targetDb, "TestTransformerTarget:TargetInformationRecord"));
      transformer.dispose();
    }

    if (true) { // update source db, then import again
      IModelTransformerUtils.updateSourceDb(sourceDb);
      sourceDb.saveChanges();
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport after sourceDb update");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      transformer.processAll();
      assert.equal(targetImporter.numModelsInserted, 0);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.equal(targetImporter.numElementsInserted, 0);
      assert.equal(targetImporter.numElementsUpdated, 5);
      assert.equal(targetImporter.numElementsDeleted, 2);
      assert.equal(targetImporter.numElementAspectsInserted, 0);
      assert.equal(targetImporter.numElementAspectsUpdated, 2);
      assert.equal(targetImporter.numRelationshipsInserted, 0);
      assert.equal(targetImporter.numRelationshipsUpdated, 1);
      assert.equal(targetImporter.numRelationshipsDeleted, 1);
      targetDb.saveChanges();
      IModelTransformerUtils.assertUpdatesInTargetDb(targetDb);
      assert.equal(numTargetRelationships - targetImporter.numRelationshipsDeleted, count(targetDb, ElementRefersToElements.classFullName));
      assert.equal(2, count(targetDb, "TestTransformerTarget:TargetInformationRecord"));
      transformer.dispose();
    }

    IModelTransformerUtils.dumpIModelInfo(sourceDb);
    IModelTransformerUtils.dumpIModelInfo(targetDb);
    sourceDb.close();
    targetDb.close();
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function countElementsInModel(iModelDb: IModelDb, modelId: Id64String): number {
    const sql = `SELECT COUNT(*) FROM ${Element.classFullName} WHERE Model.Id=:modelId`;
    return iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): number => {
      statement.bindId("modelId", modelId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should import everything below a Subject", async () => {
    // Source IModelDb
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "SourceImportSubject.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "SourceImportSubject" } });
    await IModelTransformerUtils.prepareSourceDb(sourceDb);
    IModelTransformerUtils.populateSourceDb(sourceDb);
    const sourceSubjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TargetImportSubject.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "TargetImportSubject" } });
    await IModelTransformerUtils.prepareTargetDb(targetDb);
    const targetSubjectId = Subject.insert(targetDb, IModel.rootSubjectId, "Target Subject", "Target Subject Description");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    targetDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new TestIModelTransformer(sourceDb, targetDb);
    transformer.processFonts();
    transformer.processSubject(sourceSubjectId, targetSubjectId);
    transformer.processRelationships(ElementRefersToElements.classFullName);
    transformer.dispose();
    targetDb.saveChanges();
    IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb, "Target Subject");
    const targetSubject: Subject = targetDb.elements.getElement<Subject>(targetSubjectId);
    assert.equal(targetSubject.description, "Target Subject Description");
    // Close
    sourceDb.close();
    targetDb.close();
  });

  // WIP: Using IModelTransformer within the same iModel is not yet supported
  it.skip("should clone Model within same iModel", async () => {
    // Set up the IModelDb with a populated source Subject and an "empty" target Subject
    const iModelFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneModel.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "CloneModel" } });
    await IModelTransformerUtils.prepareSourceDb(iModelDb);
    IModelTransformerUtils.populateSourceDb(iModelDb);
    const sourceSubjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    const targetSubjectId = Subject.insert(iModelDb, IModel.rootSubjectId, "Target Subject");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    iModelDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new IModelTransformer(iModelDb, iModelDb);
    transformer.processSubject(sourceSubjectId, targetSubjectId);
    transformer.dispose();
    iModelDb.saveChanges();
    iModelDb.close();
  });

  // WIP: Included as skipped until test file management strategy can be refined.
  it.skip("should successfully complete PlantSight workflow", async () => {
    // Source IModelDb
    const sourceFileName = "d:/data/DgnDb/PlantSight/PlantSightSource.bim";
    const sourceDb = SnapshotDb.open(sourceFileName);
    const sourceModelId: Id64String = "0x20000000002";
    assert.doesNotThrow(() => sourceDb.elements.getElement<PhysicalPartition>(sourceModelId));
    assert.doesNotThrow(() => sourceDb.models.getModel<PhysicalModel>(sourceModelId));
    assert.isAtLeast(countElementsInModel(sourceDb, sourceModelId), 1, "Source Model should contain Elements");
    // Target IModelDb
    const targetFileName = IModelTestUtils.prepareOutputFile("IModelTransformer", "PlantSightTarget.bim");
    const targetDb = SnapshotDb.createFrom(SnapshotDb.open("d:/data/DgnDb/PlantSight/PlantSightTarget.bim"), targetFileName);
    // Import
    const transformer = new IModelTransformer(sourceDb, targetDb);
    transformer.processAll();
    transformer.dispose();
    // Close
    sourceDb.close();
    targetDb.close();
  });

  it("should clone test file", async () => {
    // open source iModel
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.open(sourceFileName);
    const numSourceElements: number = count(sourceDb, Element.classFullName);
    assert.exists(sourceDb);
    assert.isAtLeast(numSourceElements, 12);
    // create target iModel
    const targetDbFile: string = path.join(KnownTestLocations.outputDir, "Clone-Target.bim");
    if (IModelJsFs.existsSync(targetDbFile)) {
      IModelJsFs.removeSync(targetDbFile);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: "Clone-Target" },
      ecefLocation: sourceDb.ecefLocation,
    };
    const targetDb = SnapshotDb.createEmpty(targetDbFile, targetDbProps);
    assert.exists(targetDb);
    // import
    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processSchemas(new BackendRequestContext());
    transformer.processAll();
    transformer.dispose();
    const numTargetElements: number = count(targetDb, Element.classFullName);
    assert.isAtLeast(numTargetElements, numSourceElements);
    assert.deepEqual(sourceDb.ecefLocation, targetDb.ecefLocation);
    // clean up
    sourceDb.close();
    targetDb.close();
  });

  it("should transform 3d elements in target iModel", async () => {
    // create source iModel
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Transform3d-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Transform3d-Source" } });
    const categoryId: Id64String = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green });
    const sourceModelId: Id64String = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "Physical");
    const xArray: number[] = [1, 3, 5, 7, 9];
    const yArray: number[] = [0, 2, 4, 6, 8];
    for (const x of xArray) {
      for (const y of yArray) {
        const physicalObjectProps1: GeometricElement3dProps = {
          classFullName: PhysicalObject.classFullName,
          model: sourceModelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: `PhysicalObject(${x},${y})`,
          geom: IModelTransformerUtils.createBox(Point3d.create(1, 1, 1)),
          placement: Placement3d.fromJSON({ origin: { x, y }, angles: {} }),
        };
        sourceDb.elements.insertElement(physicalObjectProps1);
      }
    }
    const sourceModel: PhysicalModel = sourceDb.models.getModel<PhysicalModel>(sourceModelId);
    const sourceModelExtents: AxisAlignedBox3d = sourceModel.queryExtents();
    assert.deepEqual(sourceModelExtents, new Range3d(1, 0, 0, 10, 9, 1));
    // create target iModel
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Transform3d-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Transform3d-Target" } });
    // transform
    const transform3d: Transform = Transform.createTranslation(new Point3d(100, 200));
    const transformer = new IModelTransformer3d(sourceDb, targetDb, transform3d);
    transformer.processAll();
    const targetModelId: Id64String = transformer.context.findTargetElementId(sourceModelId);
    const targetModel: PhysicalModel = targetDb.models.getModel<PhysicalModel>(targetModelId);
    const targetModelExtents: AxisAlignedBox3d = targetModel.queryExtents();
    assert.deepEqual(targetModelExtents, new Range3d(101, 200, 0, 110, 209, 1));
    assert.deepEqual(targetModelExtents, transform3d.multiplyRange(sourceModelExtents));
    // clean up
    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  });

  it("should sync Team iModels into Shared", async () => {
    const iModelShared: SnapshotDb = IModelTransformerUtils.createSharedIModel(outputDir, ["A", "B"]);

    if (true) {
      const iModelA: SnapshotDb = IModelTransformerUtils.createTeamIModel(outputDir, "A", Point3d.create(0, 0, 0), ColorDef.green);
      IModelTransformerUtils.assertTeamIModelContents(iModelA, "A");
      const iModelExporterA = new IModelExporter(iModelA);
      iModelExporterA.excludeElement(iModelA.elements.queryElementIdByCode(Subject.createCode(iModelA, IModel.rootSubjectId, "Context"))!);
      const subjectId: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "A");
      const transformerA2S = new IModelTransformer(iModelExporterA, iModelShared, { targetScopeElementId: subjectId });
      transformerA2S.context.remapElement(IModel.rootSubjectId, subjectId);
      transformerA2S.processAll();
      transformerA2S.dispose();
      IModelTransformerUtils.dumpIModelInfo(iModelA);
      iModelA.close();
      iModelShared.saveChanges("Imported A");
      IModelTransformerUtils.assertSharedIModelContents(iModelShared, ["A"]);
    }

    if (true) {
      const iModelB: SnapshotDb = IModelTransformerUtils.createTeamIModel(outputDir, "B", Point3d.create(0, 10, 0), ColorDef.blue);
      IModelTransformerUtils.assertTeamIModelContents(iModelB, "B");
      const iModelExporterB = new IModelExporter(iModelB);
      iModelExporterB.excludeElement(iModelB.elements.queryElementIdByCode(Subject.createCode(iModelB, IModel.rootSubjectId, "Context"))!);
      const subjectId: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "B");
      const transformerB2S = new IModelTransformer(iModelExporterB, iModelShared, { targetScopeElementId: subjectId });
      transformerB2S.context.remapElement(IModel.rootSubjectId, subjectId);
      transformerB2S.processAll();
      transformerB2S.dispose();
      IModelTransformerUtils.dumpIModelInfo(iModelB);
      iModelB.close();
      iModelShared.saveChanges("Imported B");
      IModelTransformerUtils.assertSharedIModelContents(iModelShared, ["A", "B"]);
    }

    if (true) {
      const iModelConsolidated: SnapshotDb = IModelTransformerUtils.createConsolidatedIModel(outputDir, "Consolidated");
      const transformerS2C = new IModelTransformer(iModelShared, iModelConsolidated);
      const subjectA: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "A");
      const subjectB: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "B");
      const definitionA: Id64String = IModelTransformerUtils.queryDefinitionPartitionId(iModelShared, subjectA, "A");
      const definitionB: Id64String = IModelTransformerUtils.queryDefinitionPartitionId(iModelShared, subjectB, "B");
      const definitionC: Id64String = IModelTransformerUtils.queryDefinitionPartitionId(iModelConsolidated, IModel.rootSubjectId, "Consolidated");
      transformerS2C.context.remapElement(definitionA, definitionC);
      transformerS2C.context.remapElement(definitionB, definitionC);
      const physicalA: Id64String = IModelTransformerUtils.queryPhysicalPartitionId(iModelShared, subjectA, "A");
      const physicalB: Id64String = IModelTransformerUtils.queryPhysicalPartitionId(iModelShared, subjectB, "B");
      const physicalC: Id64String = IModelTransformerUtils.queryPhysicalPartitionId(iModelConsolidated, IModel.rootSubjectId, "Consolidated");
      transformerS2C.context.remapElement(physicalA, physicalC);
      transformerS2C.context.remapElement(physicalB, physicalC);
      transformerS2C.processModel(definitionA);
      transformerS2C.processModel(definitionB);
      transformerS2C.processModel(physicalA);
      transformerS2C.processModel(physicalB);
      transformerS2C.processDeferredElements();
      transformerS2C.processRelationships(ElementRefersToElements.classFullName);
      transformerS2C.dispose();
      IModelTransformerUtils.assertConsolidatedIModelContents(iModelConsolidated, "Consolidated");
      IModelTransformerUtils.dumpIModelInfo(iModelConsolidated);
      iModelConsolidated.close();
    }

    IModelTransformerUtils.dumpIModelInfo(iModelShared);
    iModelShared.close();
  });

  it("IModelCloneContext remap tests", async () => {
    const iModelDb: SnapshotDb = IModelTransformerUtils.createTeamIModel(outputDir, "Test", Point3d.create(0, 0, 0), ColorDef.green);
    const cloneContext = new IModelCloneContext(iModelDb);
    const sourceId: Id64String = Id64.fromLocalAndBriefcaseIds(1, 1);
    const targetId: Id64String = Id64.fromLocalAndBriefcaseIds(1, 2);
    cloneContext.remapElement(sourceId, targetId);
    assert.equal(targetId, cloneContext.findTargetElementId(sourceId));
    assert.equal(Id64.invalid, cloneContext.findTargetElementId(targetId));
    assert.equal(Id64.invalid, cloneContext.findTargetCodeSpecId(targetId));
    assert.throws(() => cloneContext.remapCodeSpec("SourceNotFound", "TargetNotFound"));
    cloneContext.dispose();
    iModelDb.close();
  });

  // WIP: Included as skipped until test file management strategy can be refined.
  it.skip("Merge test", async () => {
    const mergedIModelFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "MergeTest.bim");
    const mergedDb = SnapshotDb.createEmpty(mergedIModelFileName, { rootSubject: { name: "Merge Test" } });
    const campusSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Campus");
    assert.isTrue(Id64.isValidId64(campusSubjectId));
    const garageSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Garage");
    assert.isTrue(Id64.isValidId64(garageSubjectId));
    const buildingSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Building");
    assert.isTrue(Id64.isValidId64(buildingSubjectId));
    mergedDb.saveChanges("Create Subject hierarchy");
    BriefcaseManager.createStandaloneChangeSet(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes

    // Import campus
    if (true) {
      const campusIModelFileName = "D:/data/bim/MergeTest/Campus.bim";
      const campusDb = SnapshotDb.open(campusIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(campusDb);
      const transformer = new IModelTransformer(campusDb, mergedDb, { targetScopeElementId: campusSubjectId });
      await transformer.processSchemas(new BackendRequestContext());
      transformer.context.remapElement(IModel.rootSubjectId, campusSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Campus");
      BriefcaseManager.createStandaloneChangeSet(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      campusDb.close();
    }

    // Import garage
    if (true) {
      const garageIModelFileName = "D:/data/bim/MergeTest/Garage.bim";
      const garageDb = SnapshotDb.open(garageIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(garageDb);
      const transformer = new IModelTransformer(garageDb, mergedDb, { targetScopeElementId: garageSubjectId });
      transformer.context.remapElement(IModel.rootSubjectId, garageSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Garage");
      BriefcaseManager.createStandaloneChangeSet(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      garageDb.close();
    }

    // Import building
    if (true) {
      const buildingIModelFileName = "D:/data/bim/MergeTest/Building.bim";
      const buildingDb = SnapshotDb.open(buildingIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(buildingDb);
      const transformer = new IModelTransformer(buildingDb, mergedDb, { targetScopeElementId: buildingSubjectId });
      await transformer.processSchemas(new BackendRequestContext());
      transformer.context.remapElement(IModel.rootSubjectId, buildingSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Building");
      BriefcaseManager.createStandaloneChangeSet(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      buildingDb.close();
    }

    IModelTransformerUtils.dumpIModelInfo(mergedDb);
    mergedDb.close();
  });
});
