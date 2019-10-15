/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { AxisAlignedBox3d, Code, ColorDef, CreateIModelProps, GeometricElement3dProps, IModel, Placement3d } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { BackendLoggerCategory, BackendRequestContext, ECSqlStatement, Element, ElementMultiAspect, ElementRefersToElements, ElementUniqueAspect, ExternalSourceAspect, IModelDb, IModelJsFs, IModelTransformer, PhysicalModel, PhysicalObject, PhysicalPartition, SpatialCategory, Subject } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelTransformer3d, IModelTransformerUtils, IModelTransformerWithAsserts, TestIModelTransformer } from "../IModelTransformerUtils";
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
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }
  });

  it("should import", async () => {
    // Source IModelDb
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source.bim");
    const sourceDb: IModelDb = IModelDb.createSnapshot(sourceDbFile, { rootSubject: { name: "TestIModelTransformer-Source" } });
    await IModelTransformerUtils.prepareSourceDb(sourceDb);
    IModelTransformerUtils.populateSourceDb(sourceDb);
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Target.bim");
    const targetDb: IModelDb = IModelDb.createSnapshot(targetDbFile, { rootSubject: { name: "TestIModelTransformer-Target" } });
    await IModelTransformerUtils.prepareTargetDb(targetDb);
    targetDb.saveChanges();

    let numElementsExcluded: number;
    let numElementAspectsExcluded: number;
    let numRelationshipExcluded: number;
    const numSourceUniqueAspects: number = count(sourceDb, ElementUniqueAspect.classFullName);
    const numSourceMultiAspects: number = count(sourceDb, ElementMultiAspect.classFullName);
    const numSourceRelationships: number = count(sourceDb, ElementRefersToElements.classFullName);
    assert.isAbove(numSourceUniqueAspects, 0);
    assert.isAbove(numSourceMultiAspects, 0);
    assert.isAbove(numSourceRelationships, 0);

    if (true) { // initial import
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Initial Import");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      assert.isTrue(transformer.context.isBetweenIModels);
      transformer.importAll();
      assert.isAbove(transformer.numCodeSpecsExcluded, 0);
      assert.isAbove(transformer.numRelationshipsExcluded, 0);
      assert.isAbove(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.isAbove(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementProvenanceCalls);
      assert.isAbove(transformer.numElementsUpdated, 0);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementProvenanceCalls);
      assert.equal(transformer.numElementsDeleted, 0);
      assert.isAbove(transformer.numElementsExcluded, 0);
      assert.isAbove(transformer.numElementAspectsExcluded, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementCalls);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementCalls);
      assert.equal(transformer.numElementsExcluded, transformer.numExcludedElementCalls);
      assert.isAtLeast(count(targetDb, ElementRefersToElements.classFullName), 1);
      numElementsExcluded = transformer.numElementsExcluded;
      numElementAspectsExcluded = transformer.numElementAspectsExcluded;
      numRelationshipExcluded = transformer.numRelationshipsExcluded;
      targetDb.saveChanges();
      IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb);
      transformer.dispose();
    }

    const numTargetElements: number = count(targetDb, Element.classFullName);
    const numTargetUniqueAspects: number = count(targetDb, ElementUniqueAspect.classFullName);
    const numTargetMultiAspects: number = count(targetDb, ElementMultiAspect.classFullName);
    const numTargetExternalSourceAspects: number = count(targetDb, ExternalSourceAspect.classFullName);
    const numTargetRelationships: number = count(targetDb, ElementRefersToElements.classFullName);
    assert.isAbove(numTargetUniqueAspects, 0);
    assert.isAbove(numTargetMultiAspects, 0);
    assert.equal(numSourceUniqueAspects + numSourceMultiAspects, numTargetUniqueAspects + numTargetMultiAspects + numElementAspectsExcluded - numTargetExternalSourceAspects);
    assert.equal(numSourceRelationships, numTargetRelationships + numRelationshipExcluded);

    if (true) { // second import with no changes to source, should be a no-op
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport (no-op)");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      transformer.importAll();
      assert.equal(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsUpdated, 0);
      assert.equal(transformer.numElementsDeleted, 0);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      assert.equal(transformer.numInsertElementCalls, 0);
      assert.equal(transformer.numInsertElementProvenanceCalls, 0);
      assert.equal(transformer.numUpdateElementCalls, 0);
      assert.equal(transformer.numUpdateElementProvenanceCalls, 0);
      assert.equal(transformer.numExcludedElementCalls, numElementsExcluded);
      assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
      assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
      transformer.dispose();
    }

    if (true) { // update source db, then import again
      IModelTransformerUtils.updateSourceDb(sourceDb);
      sourceDb.saveChanges();
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport after sourceDb update");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      transformer.importAll();
      assert.equal(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementProvenanceCalls);
      assert.equal(transformer.numElementsUpdated, 3);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementProvenanceCalls);
      assert.equal(transformer.numElementsDeleted, 1);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      targetDb.saveChanges();
      IModelTransformerUtils.assertUpdatesInTargetDb(targetDb);
      const expectedNumTargetElements: number = numTargetElements + transformer.numElementsInserted - transformer.numElementsDeleted;
      const expectedNumExternalSourceAspects: number = numTargetExternalSourceAspects + transformer.numElementsInserted - transformer.numElementsDeleted;
      assert.equal(expectedNumTargetElements, count(targetDb, Element.classFullName), "Third import should not add elements");
      assert.equal(expectedNumExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Third import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Third import should not add relationships");
      transformer.dispose();
    }

    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
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
    const sourceDb: IModelDb = IModelDb.createSnapshot(sourceDbFile, { rootSubject: { name: "SourceImportSubject" } });
    await IModelTransformerUtils.prepareSourceDb(sourceDb);
    IModelTransformerUtils.populateSourceDb(sourceDb);
    const sourceSubjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TargetImportSubject.bim");
    const targetDb: IModelDb = IModelDb.createSnapshot(targetDbFile, { rootSubject: { name: "TargetImportSubject" } });
    await IModelTransformerUtils.prepareTargetDb(targetDb);
    const targetSubjectId = Subject.insert(targetDb, IModel.rootSubjectId, "Target Subject", "Target Subject Description");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    targetDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new TestIModelTransformer(sourceDb, targetDb);
    transformer.importFonts();
    transformer.importSubject(sourceSubjectId, targetSubjectId);
    transformer.importRelationships(ElementRefersToElements.classFullName);
    transformer.dispose();
    targetDb.saveChanges();
    IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb, "Target Subject");
    const targetSubject: Subject = targetDb.elements.getElement<Subject>(targetSubjectId);
    assert.equal(targetSubject.description, "Target Subject Description");
    // Close
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  // WIP: Using IModelTransformer within the same iModel is not yet supported
  it.skip("should clone Model within same iModel", async () => {
    // Set up the IModelDb with a populated source Subject and an "empty" target Subject
    const iModelFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneModel.bim");
    const iModelDb: IModelDb = IModelDb.createSnapshot(iModelFile, { rootSubject: { name: "CloneModel" } });
    await IModelTransformerUtils.prepareSourceDb(iModelDb);
    IModelTransformerUtils.populateSourceDb(iModelDb);
    const sourceSubjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    const targetSubjectId = Subject.insert(iModelDb, IModel.rootSubjectId, "Target Subject");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    iModelDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new IModelTransformerWithAsserts(iModelDb, iModelDb);
    transformer.importSubject(sourceSubjectId, targetSubjectId);
    transformer.dispose();
    iModelDb.saveChanges();
    iModelDb.closeSnapshot();
  });

  // WIP: Included as skipped until test file management strategy can be refined.
  it.skip("should successfully complete PlantSight workflow", async () => {
    // Source IModelDb
    const sourceFileName = "d:/data/DgnDb/PlantSight/PlantSightSource.bim";
    const sourceDb: IModelDb = IModelDb.openSnapshot(sourceFileName);
    const sourceModelId: Id64String = "0x20000000002";
    assert.doesNotThrow(() => sourceDb.elements.getElement<PhysicalPartition>(sourceModelId));
    assert.doesNotThrow(() => sourceDb.models.getModel<PhysicalModel>(sourceModelId));
    assert.isAtLeast(countElementsInModel(sourceDb, sourceModelId), 1, "Source Model should contain Elements");
    // Target IModelDb
    const targetFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "PlantSightTarget.bim");
    const targetDb: IModelDb = IModelDb.openSnapshot("d:/data/DgnDb/PlantSight/PlantSightTarget.bim").createSnapshot(targetFileName);
    // Import
    const transformer = new IModelTransformerWithAsserts(sourceDb, targetDb);
    if (true) {
      transformer.importAll();
    } else { // old test case
      const targetModelId: Id64String = "0x30000000002";
      assert.doesNotThrow(() => targetDb.elements.getElement<PhysicalPartition>(targetModelId));
      assert.doesNotThrow(() => targetDb.models.getModel<PhysicalModel>(targetModelId));
      assert.equal(countElementsInModel(targetDb, targetModelId), 0, "Target Model should not contain Elements yet");
      transformer.importModelContents(IModel.dictionaryId, IModel.dictionaryId, SpatialCategory.classFullName);
      transformer.importModelContents(sourceModelId, targetModelId);
      transformer.importSkippedElements();
    }
    transformer.dispose();
    // Close
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  it("should clone test file", async () => {
    // open source iModel
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb: IModelDb = IModelDb.openSnapshot(sourceFileName);
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
    const targetDb: IModelDb = IModelDb.createSnapshot(targetDbFile, targetDbProps);
    assert.exists(targetDb);
    // import
    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.importSchemas(new BackendRequestContext());
    transformer.importAll();
    transformer.dispose();
    const numTargetElements: number = count(targetDb, Element.classFullName);
    assert.isAtLeast(numTargetElements, numSourceElements);
    assert.deepEqual(sourceDb.ecefLocation, targetDb.ecefLocation);
    // clean up
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  it("should transform 3d elements in target iModel", async () => {
    // create source iModel
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Transform3d-Source.bim");
    const sourceDb: IModelDb = IModelDb.createSnapshot(sourceDbFile, { rootSubject: { name: "Transform3d-Source" } });
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
    const targetDb: IModelDb = IModelDb.createSnapshot(targetDbFile, { rootSubject: { name: "Transform3d-Target" } });
    // transform
    const transform3d: Transform = Transform.createTranslation(new Point3d(100, 200));
    const transformer = new IModelTransformer3d(sourceDb, targetDb, transform3d);
    transformer.importAll();
    const targetModelId: Id64String = transformer.context.findTargetElementId(sourceModelId);
    const targetModel: PhysicalModel = targetDb.models.getModel<PhysicalModel>(targetModelId);
    const targetModelExtents: AxisAlignedBox3d = targetModel.queryExtents();
    assert.deepEqual(targetModelExtents, new Range3d(101, 200, 0, 110, 209, 1));
    assert.deepEqual(targetModelExtents, transform3d.multiplyRange(sourceModelExtents));
    // clean up
    transformer.dispose();
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  it("should sync Team iModels into Shared", async () => {
    const iModelShared: IModelDb = IModelTransformerUtils.createSharedIModel(outputDir, ["A", "B"]);

    if (true) {
      const iModelA: IModelDb = IModelTransformerUtils.createTeamIModel(outputDir, "A", Point3d.create(0, 0, 0), ColorDef.green);
      IModelTransformerUtils.assertTeamIModelContents(iModelA, "A");
      const subjectId: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "A");
      const transformerA2S = new IModelTransformer(iModelA, iModelShared, { targetScopeElementId: subjectId });
      transformerA2S.context.remapElement(IModel.rootSubjectId, subjectId);
      transformerA2S.excludeSubject("/Context");
      transformerA2S.excludeElement(IModel.dictionaryId);
      transformerA2S.importAll();
      transformerA2S.dispose();
      iModelA.closeSnapshot();
      iModelShared.saveChanges("Imported A");
      IModelTransformerUtils.assertSharedIModelContents(iModelShared, ["A"]);
    }

    if (true) {
      const iModelB: IModelDb = IModelTransformerUtils.createTeamIModel(outputDir, "B", Point3d.create(0, 10, 0), ColorDef.blue);
      IModelTransformerUtils.assertTeamIModelContents(iModelB, "B");
      const subjectId: Id64String = IModelTransformerUtils.querySubjectId(iModelShared, "B");
      const transformerB2S = new IModelTransformer(iModelB, iModelShared, { targetScopeElementId: subjectId });
      transformerB2S.context.remapElement(IModel.rootSubjectId, subjectId);
      transformerB2S.excludeSubject("/Context");
      transformerB2S.excludeElement(IModel.dictionaryId);
      transformerB2S.importAll();
      transformerB2S.dispose();
      iModelB.closeSnapshot();
      iModelShared.saveChanges("Imported B");
      IModelTransformerUtils.assertSharedIModelContents(iModelShared, ["B"]);
    }

    if (true) {
      const iModelConsolidated: IModelDb = IModelTransformerUtils.createConsolidatedIModel(outputDir, "Consolidated");
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
      transformerS2C.importModel(definitionA);
      transformerS2C.importModel(definitionB);
      transformerS2C.importModel(physicalA);
      transformerS2C.importModel(physicalB);
      transformerS2C.importSkippedElements();
      transformerS2C.importRelationships(ElementRefersToElements.classFullName);
      transformerS2C.dispose();
      IModelTransformerUtils.assertConsolidatedIModelContents(iModelConsolidated, "Consolidated");
      iModelConsolidated.closeSnapshot();
    }

    iModelShared.closeSnapshot();
  });
});
