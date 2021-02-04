/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Angle, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  AxisAlignedBox3d, Code, ColorDef, CreateIModelProps, IModel, PhysicalElementProps, Placement2d, Placement3d,
} from "@bentley/imodeljs-common";
import {
  BackendLoggerCategory, BackendRequestContext, CategorySelector, DefinitionPartition, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory,
  ECSqlStatement, Element, ElementMultiAspect, ElementRefersToElements, ElementUniqueAspect, ExternalSourceAspect, IModelCloneContext, IModelDb,
  IModelExporter, IModelExportHandler, IModelJsFs, IModelTransformer, InformationRecordModel, InformationRecordPartition, Model, ModelSelector,
  OrthographicViewDefinition, PhysicalModel, PhysicalObject, PhysicalPartition, PhysicalType, Relationship, SnapshotDb, SpatialCategory, Subject,
  TemplateModelCloner, TemplateRecipe2d, TemplateRecipe3d,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import {
  ClassCounter, FilterByViewTransformer, IModelToTextFileExporter, IModelTransformer3d, IModelTransformerUtils, PhysicalModelConsolidator,
  RecordingIModelImporter, TestIModelTransformer,
} from "../IModelTransformerUtils";
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
      transformer.context.dump(`${targetDbFile}.context.txt`);
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

  it("should initialize from iModel copy", async () => {
    // Initialize targetDb to be a copy of the populated sourceDb
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "InitFromCopy-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "InitFromCopy-Source" } });
    await IModelTransformerUtils.prepareSourceDb(sourceDb);
    IModelTransformerUtils.populateSourceDb(sourceDb);
    sourceDb.saveChanges();
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "InitFromCopy-Target.bim");
    const targetDb = SnapshotDb.createFrom(sourceDb, targetDbFile, { createClassViews: true });

    const numSourceElements = count(sourceDb, Element.classFullName);
    const numSourceRelationships = count(sourceDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numSourceElements, 12);
    assert.isAtLeast(numSourceRelationships, 1);
    assert.equal(numSourceElements, count(targetDb, Element.classFullName));
    assert.equal(numSourceRelationships, count(targetDb, ElementRefersToElements.classFullName));
    assert.equal(0, count(targetDb, ExternalSourceAspect.classFullName));

    const transformer = new IModelTransformer(sourceDb, targetDb, { wasSourceIModelCopiedToTarget: true });
    transformer.processAll();
    transformer.dispose();

    assert.equal(numSourceElements, count(targetDb, Element.classFullName));
    assert.equal(numSourceRelationships, count(targetDb, ElementRefersToElements.classFullName));
    assert.isAtLeast(count(targetDb, ExternalSourceAspect.classFullName), numSourceElements + numSourceRelationships - 1); // provenance not recorded for the root Subject

    const sql = `SELECT aspect.Identifier,aspect.Element.Id FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Kind=:kind`;
    targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceElementId = statement.getValue(0).getString(); // ExternalSourceAspect.Identifier is of type string
        const targetElementId = statement.getValue(1).getId();
        assert.equal(sourceElementId, targetElementId);
      }
    });

    sourceDb.close();
    targetDb.close();
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should clone from a component library", async () => {
    const componentLibraryDb: SnapshotDb = IModelTransformerUtils.createComponentLibrary(outputDir);
    const sourceLibraryModelId = componentLibraryDb.elements.queryElementIdByCode(DefinitionPartition.createCode(componentLibraryDb, IModel.rootSubjectId, "Components"))!;
    assert.isTrue(Id64.isValidId64(sourceLibraryModelId));
    const sourceSpatialCategoryId = componentLibraryDb.elements.queryElementIdByCode(SpatialCategory.createCode(componentLibraryDb, IModel.dictionaryId, "Components"))!;
    assert.isTrue(Id64.isValidId64(sourceSpatialCategoryId));
    const sourceDrawingCategoryId = componentLibraryDb.elements.queryElementIdByCode(DrawingCategory.createCode(componentLibraryDb, IModel.dictionaryId, "Components"))!;
    assert.isTrue(Id64.isValidId64(sourceDrawingCategoryId));
    const cylinderTemplateId = componentLibraryDb.elements.queryElementIdByCode(TemplateRecipe3d.createCode(componentLibraryDb, sourceLibraryModelId, "Cylinder"))!;
    assert.isTrue(Id64.isValidId64(cylinderTemplateId));
    const assemblyTemplateId = componentLibraryDb.elements.queryElementIdByCode(TemplateRecipe3d.createCode(componentLibraryDb, sourceLibraryModelId, "Assembly"))!;
    assert.isTrue(Id64.isValidId64(assemblyTemplateId));
    const drawingGraphicTemplateId = componentLibraryDb.elements.queryElementIdByCode(TemplateRecipe2d.createCode(componentLibraryDb, sourceLibraryModelId, "DrawingGraphic"))!;
    assert.isTrue(Id64.isValidId64(drawingGraphicTemplateId));
    const targetTeamName = "Target";
    const targetDb: SnapshotDb = IModelTransformerUtils.createTeamIModel(outputDir, targetTeamName, Point3d.createZero(), ColorDef.green);
    const targetPhysicalModelId = targetDb.elements.queryElementIdByCode(PhysicalPartition.createCode(targetDb, IModel.rootSubjectId, `Physical${targetTeamName}`))!;
    assert.isTrue(Id64.isValidId64(targetPhysicalModelId));
    const targetDefinitionModelId = targetDb.elements.queryElementIdByCode(DefinitionPartition.createCode(targetDb, IModel.rootSubjectId, `Definition${targetTeamName}`))!;
    assert.isTrue(Id64.isValidId64(targetDefinitionModelId));
    const targetSpatialCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, targetDefinitionModelId, `SpatialCategory${targetTeamName}`))!;
    assert.isTrue(Id64.isValidId64(targetSpatialCategoryId));
    const targetDrawingCategoryId = targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(targetDb, IModel.dictionaryId, "DrawingCategoryShared"))!;
    assert.isTrue(Id64.isValidId64(targetDrawingCategoryId));
    const targetDrawingListModelId = DocumentListModel.insert(targetDb, IModel.rootSubjectId, "Drawings");
    const targetDrawingId = Drawing.insert(targetDb, targetDrawingListModelId, "Drawing1");
    const cloner = new TemplateModelCloner(componentLibraryDb, targetDb);
    assert.throws(() => cloner.placeTemplate3d(cylinderTemplateId, targetPhysicalModelId, Placement3d.fromJSON())); // expect error since category not remapped
    cloner.context.remapElement(sourceSpatialCategoryId, targetSpatialCategoryId);
    const cylinderLocations: Point3d[] = [
      Point3d.create(10, 10), Point3d.create(20, 10), Point3d.create(30, 10),
      Point3d.create(10, 20), Point3d.create(20, 20), Point3d.create(30, 20),
      Point3d.create(10, 30), Point3d.create(20, 30), Point3d.create(30, 30),
    ];
    cylinderLocations.forEach((location: Point3d) => {
      const placement = new Placement3d(location, new YawPitchRollAngles(), new Range3d());
      const sourceIdToTargetIdMap = cloner.placeTemplate3d(cylinderTemplateId, targetPhysicalModelId, placement);
      for (const sourceElementId of sourceIdToTargetIdMap.keys()) {
        const sourceElement = componentLibraryDb.elements.getElement(sourceElementId);
        const targetElement = targetDb.elements.getElement(sourceIdToTargetIdMap.get(sourceElementId)!);
        assert.equal(sourceElement.classFullName, targetElement.classFullName);
      }
    });
    const assemblyLocations: Point3d[] = [Point3d.create(-10, 0), Point3d.create(-20, 0), Point3d.create(-30, 0)];
    assemblyLocations.forEach((location: Point3d) => {
      const placement = new Placement3d(location, new YawPitchRollAngles(), new Range3d());
      const sourceIdToTargetIdMap = cloner.placeTemplate3d(assemblyTemplateId, targetPhysicalModelId, placement);
      for (const sourceElementId of sourceIdToTargetIdMap.keys()) {
        const sourceElement = componentLibraryDb.elements.getElement(sourceElementId);
        const targetElement = targetDb.elements.getElement(sourceIdToTargetIdMap.get(sourceElementId)!);
        assert.equal(sourceElement.classFullName, targetElement.classFullName);
        assert.equal(sourceElement.parent?.id ? true : false, targetElement.parent?.id ? true : false);
      }
    });
    assert.throws(() => cloner.placeTemplate2d(drawingGraphicTemplateId, targetDrawingId, Placement2d.fromJSON())); // expect error since category not remapped
    cloner.context.remapElement(sourceDrawingCategoryId, targetDrawingCategoryId);
    const drawingGraphicLocations: Point2d[] = [
      Point2d.create(10, 10), Point2d.create(20, 10), Point2d.create(30, 10),
      Point2d.create(10, 20), Point2d.create(20, 20), Point2d.create(30, 20),
      Point2d.create(10, 30), Point2d.create(20, 30), Point2d.create(30, 30),
    ];
    drawingGraphicLocations.forEach((location: Point2d) => {
      const placement = new Placement2d(location, Angle.zero(), new Range2d());
      cloner.placeTemplate2d(drawingGraphicTemplateId, targetDrawingId, placement);
    });
    cloner.dispose();
    componentLibraryDb.close();
    targetDb.close();
  });

  it("should combine models", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "source-separate-models.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Separate Models" } });
    const sourceCategoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "Category", {});
    const sourceModelId1 = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "M1");
    const sourceModelId2 = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "M2");
    const elementProps11: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: sourceModelId1,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject-M1-E1",
      category: sourceCategoryId,
      geom: IModelTransformerUtils.createBox(new Point3d(1, 1, 1)),
      placement: Placement3d.fromJSON({ origin: { x: 1, y: 1 }, angles: {} }),
    };
    const sourceElementId11 = sourceDb.elements.insertElement(elementProps11);
    const elementProps21: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: sourceModelId2,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject-M2-E1",
      category: sourceCategoryId,
      geom: IModelTransformerUtils.createBox(new Point3d(2, 2, 2)),
      placement: Placement3d.fromJSON({ origin: { x: 2, y: 2 }, angles: {} }),
    };
    const sourceElementId21 = sourceDb.elements.insertElement(elementProps21);
    sourceDb.saveChanges();

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "target-combined-model.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Combined Model" } });
    const targetModelId = PhysicalModel.insert(targetDb, IModel.rootSubjectId, "PhysicalModel-Combined");

    const transformer = new IModelTransformer(sourceDb, targetDb);
    transformer.context.remapElement(sourceModelId1, targetModelId);
    transformer.context.remapElement(sourceModelId2, targetModelId);
    transformer.importer.doNotUpdateElementIds.add(targetModelId); // don't want the target partition CodeValue, etc. to be updated from either source partition
    transformer.processAll();
    targetDb.saveChanges();

    const targetElement11 = targetDb.elements.getElement(transformer.context.findTargetElementId(sourceElementId11));
    assert.equal(targetElement11.userLabel, "PhysicalObject-M1-E1");
    assert.equal(targetElement11.model, targetModelId);
    const targetElement21 = targetDb.elements.getElement(transformer.context.findTargetElementId(sourceElementId21));
    assert.equal(targetElement21.userLabel, "PhysicalObject-M2-E1");
    assert.equal(targetElement21.model, targetModelId);
    const targetPartition = targetDb.elements.getElement(targetModelId);
    assert.equal(targetPartition.code.value, "PhysicalModel-Combined", "Original CodeValue should be retained");

    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  });

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

  /** @note For debugging/testing purposes, you can use `it.only` and hard-code `sourceFileName` to test cloning of a particular iModel. */
  it("should clone test file", async () => {
    // open source iModel
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.openFile(sourceFileName);
    const numSourceElements: number = count(sourceDb, Element.classFullName);
    assert.exists(sourceDb);
    assert.isAtLeast(numSourceElements, 12);
    // create target iModel
    const targetDbFile: string = path.join(KnownTestLocations.outputDir, "IModelTransformer", "Clone-Target.bim");
    if (IModelJsFs.existsSync(targetDbFile)) {
      IModelJsFs.removeSync(targetDbFile);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: `Cloned target of ${sourceDb.elements.getRootSubject().code.getValue()}` },
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
    const categoryId: Id64String = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    const sourceModelId: Id64String = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "Physical");
    const xArray: number[] = [1, 3, 5, 7, 9];
    const yArray: number[] = [0, 2, 4, 6, 8];
    for (const x of xArray) {
      for (const y of yArray) {
        const physicalObjectProps1: PhysicalElementProps = {
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

  it("should consolidate PhysicalModels", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "MultiplePhysicalModels.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Multiple PhysicalModels" } });
    const categoryId: Id64String = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    for (let i = 0; i < 5; i++) {
      const sourceModelId: Id64String = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, `PhysicalModel${i}`);
      const xArray: number[] = [20 * i + 1, 20 * i + 3, 20 * i + 5, 20 * i + 7, 20 * i + 9];
      const yArray: number[] = [0, 2, 4, 6, 8];
      for (const x of xArray) {
        for (const y of yArray) {
          const physicalObjectProps1: PhysicalElementProps = {
            classFullName: PhysicalObject.classFullName,
            model: sourceModelId,
            category: categoryId,
            code: Code.createEmpty(),
            userLabel: `M${i}-PhysicalObject(${x},${y})`,
            geom: IModelTransformerUtils.createBox(Point3d.create(1, 1, 1)),
            placement: Placement3d.fromJSON({ origin: { x, y }, angles: {} }),
          };
          sourceDb.elements.insertElement(physicalObjectProps1);
        }
      }
    }
    sourceDb.saveChanges();
    assert.equal(5, count(sourceDb, PhysicalModel.classFullName));
    assert.equal(125, count(sourceDb, PhysicalObject.classFullName));

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "OnePhysicalModel.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "One PhysicalModel" }, createClassViews: true });
    const targetModelId: Id64String = PhysicalModel.insert(targetDb, IModel.rootSubjectId, "PhysicalModel");
    assert.isTrue(Id64.isValidId64(targetModelId));
    targetDb.saveChanges();
    const consolidator = new PhysicalModelConsolidator(sourceDb, targetDb, targetModelId);
    consolidator.processAll();
    consolidator.dispose();
    assert.equal(1, count(targetDb, PhysicalModel.classFullName));
    const targetPartition = targetDb.elements.getElement<PhysicalPartition>(targetModelId);
    assert.equal(targetPartition.code.getValue(), "PhysicalModel", "Target PhysicalModel name should not be overwritten during consolidation");
    assert.equal(125, count(targetDb, PhysicalObject.classFullName));
    const aspects = targetDb.elements.getAspects(targetPartition.id, ExternalSourceAspect.classFullName);
    assert.isAtLeast(aspects.length, 5, "Provenance should be recorded for each source PhysicalModel");

    const sql = `SELECT ECInstanceId FROM ${PhysicalObject.classFullName}`;
    targetDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const targetElementId = statement.getValue(0).getId();
        const targetElement = targetDb.elements.getElement<PhysicalObject>({ id: targetElementId, wantGeometry: true });
        assert.exists(targetElement.geom);
        assert.isFalse(targetElement.calculateRange3d().isNull);
      }
    });

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

  it("should clone across schema versions", async () => {
    // NOTE: schema differences between 01.00.00 and 01.00.01 were crafted to reproduce a cloning bug. The goal of this test is to prevent regressions.
    const cloneTestSchema100: string = path.join(KnownTestLocations.assetsDir, "CloneTest.01.00.00.ecschema.xml");
    const cloneTestSchema101: string = path.join(KnownTestLocations.assetsDir, "CloneTest.01.00.01.ecschema.xml");

    const seedDb = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneWithSchemaChanges-Source.bim");
    const sourceDb = SnapshotDb.createFrom(seedDb, sourceDbFile);
    await sourceDb.importSchemas(new BackendRequestContext(), [cloneTestSchema100]);
    const sourceElementProps = {
      classFullName: "CloneTest:PhysicalType",
      model: IModel.dictionaryId,
      code: PhysicalType.createCode(sourceDb, IModel.dictionaryId, "Type1"),
      string1: "a",
      string2: "b",
    };
    const sourceElementId = sourceDb.elements.insertElement(sourceElementProps);
    const sourceElement = sourceDb.elements.getElement(sourceElementId);
    assert.equal(sourceElement.asAny.string1, "a");
    assert.equal(sourceElement.asAny.string2, "b");
    sourceDb.saveChanges();

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneWithSchemaChanges-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "CloneWithSchemaChanges-Target" } });
    await targetDb.importSchemas(new BackendRequestContext(), [cloneTestSchema101]);

    const transformer = new IModelTransformer(sourceDb, targetDb);
    transformer.processElement(sourceElementId);
    targetDb.saveChanges();

    const targetElementId = transformer.context.findTargetElementId(sourceElementId);
    const targetElement = targetDb.elements.getElement(targetElementId);
    assert.equal(targetElement.asAny.string1, "a");
    assert.equal(targetElement.asAny.string2, "b");

    seedDb.close();
    sourceDb.close();
    targetDb.close();
  });

  it("Should not visit elements or relationships", async () => {
    // class that asserts if it encounters an element or relationship
    class TestExporter extends IModelExportHandler {
      public iModelExporter: IModelExporter;
      public modelCount: number = 0;
      public constructor(iModelDb: IModelDb) {
        super();
        this.iModelExporter = new IModelExporter(iModelDb);
        this.iModelExporter.registerHandler(this);
      }
      protected onExportModel(_model: Model, _isUpdate: boolean | undefined): void {
        ++this.modelCount;
      }
      protected onExportElement(_element: Element, _isUpdate: boolean | undefined): void {
        assert.fail("Should not visit element when visitElements=false");
      }
      protected onExportRelationship(_relationship: Relationship, _isUpdate: boolean | undefined): void {
        assert.fail("Should not visit relationship when visitRelationship=false");
      }
    }
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb: SnapshotDb = SnapshotDb.openFile(sourceFileName);
    const exporter = new TestExporter(sourceDb);
    exporter.iModelExporter.visitElements = false;
    exporter.iModelExporter.visitRelationships = false;
    // call various methods to make sure the onExport* callbacks don't assert
    exporter.iModelExporter.exportAll();
    exporter.iModelExporter.exportElement(IModel.rootSubjectId);
    exporter.iModelExporter.exportChildElements(IModel.rootSubjectId);
    exporter.iModelExporter.exportRepositoryLinks();
    exporter.iModelExporter.exportModelContents(IModel.repositoryModelId);
    exporter.iModelExporter.exportRelationships(ElementRefersToElements.classFullName);
    // make sure the exporter actually visited something
    assert.isAtLeast(exporter.modelCount, 4);
    sourceDb.close();
  });

  it("Should filter by ViewDefinition", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "FilterByView-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "FilterByView-Source" } });
    const categoryNames: string[] = ["C1", "C2", "C3", "C4", "C5"];
    categoryNames.forEach((categoryName) => {
      const categoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, categoryName, {});
      CategorySelector.insert(sourceDb, IModel.dictionaryId, categoryName, [categoryId]);
    });
    const modelNames: string[] = ["MA", "MB", "MC", "MD"];
    modelNames.forEach((modelName) => {
      const modelId = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, modelName);
      ModelSelector.insert(sourceDb, IModel.dictionaryId, modelName, [modelId]);

    });
    const projectExtents = new Range3d();
    const displayStyleId = DisplayStyle3d.insert(sourceDb, IModel.dictionaryId, "DisplayStyle");
    for (let x = 0; x < categoryNames.length; x++) { // eslint-disable-line @typescript-eslint/prefer-for-of
      const categoryId = sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[x]))!;
      const categorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, IModel.dictionaryId, categoryNames[x]))!;
      for (let y = 0; y < modelNames.length; y++) { // eslint-disable-line @typescript-eslint/prefer-for-of
        const modelId = sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[y]))!;
        const modelSelectorId = sourceDb.elements.queryElementIdByCode(ModelSelector.createCode(sourceDb, IModel.dictionaryId, modelNames[y]))!;
        const physicalObjectProps: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: modelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: `${PhysicalObject.className}-${categoryNames[x]}-${modelNames[y]}`,
          geom: IModelTransformerUtils.createBox(Point3d.create(1, 1, 1), categoryId),
          placement: {
            origin: Point3d.create(x * 2, y * 2, 0),
            angles: YawPitchRollAngles.createDegrees(0, 0, 0),
          },
        };
        const physicalObjectId = sourceDb.elements.insertElement(physicalObjectProps);
        const physicalObject = sourceDb.elements.getElement<PhysicalObject>(physicalObjectId, PhysicalObject);
        const viewExtents = physicalObject.placement.calculateRange();
        OrthographicViewDefinition.insert(
          sourceDb,
          IModel.dictionaryId,
          `View-${categoryNames[x]}-${modelNames[y]}`,
          modelSelectorId,
          categorySelectorId,
          displayStyleId,
          viewExtents,
          StandardViewIndex.Iso
        );
        projectExtents.extendRange(viewExtents);
      }
    }
    sourceDb.updateProjectExtents(projectExtents);
    const exportCategorySelectorId = CategorySelector.insert(sourceDb, IModel.dictionaryId, "Export", [
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[0]))!,
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[2]))!,
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[4]))!,
    ]);
    const exportModelSelectorId = ModelSelector.insert(sourceDb, IModel.dictionaryId, "Export", [
      sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[1]))!,
      sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[3]))!,
    ]);
    const exportViewId = OrthographicViewDefinition.insert(
      sourceDb,
      IModel.dictionaryId,
      "Export",
      exportModelSelectorId,
      exportCategorySelectorId,
      displayStyleId,
      projectExtents,
      StandardViewIndex.Iso
    );
    sourceDb.saveChanges();

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "FilterByView-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "FilterByView-Target" } });
    targetDb.updateProjectExtents(sourceDb.projectExtents);

    const transformer = new FilterByViewTransformer(sourceDb, targetDb, exportViewId);
    await transformer.processSchemas(new BackendRequestContext());
    transformer.processAll();
    transformer.dispose();

    targetDb.saveChanges();
    targetDb.close();
    sourceDb.close();
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
    IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes

    // Import campus
    if (true) {
      const campusIModelFileName = "D:/data/bim/MergeTest/Campus.bim";
      const campusDb = SnapshotDb.openFile(campusIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(campusDb);
      const transformer = new IModelTransformer(campusDb, mergedDb, { targetScopeElementId: campusSubjectId });
      await transformer.processSchemas(new BackendRequestContext());
      transformer.context.remapElement(IModel.rootSubjectId, campusSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Campus");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      campusDb.close();
    }

    // Import garage
    if (true) {
      const garageIModelFileName = "D:/data/bim/MergeTest/Garage.bim";
      const garageDb = SnapshotDb.openFile(garageIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(garageDb);
      const transformer = new IModelTransformer(garageDb, mergedDb, { targetScopeElementId: garageSubjectId });
      transformer.context.remapElement(IModel.rootSubjectId, garageSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Garage");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      garageDb.close();
    }

    // Import building
    if (true) {
      const buildingIModelFileName = "D:/data/bim/MergeTest/Building.bim";
      const buildingDb = SnapshotDb.openFile(buildingIModelFileName);
      IModelTransformerUtils.dumpIModelInfo(buildingDb);
      const transformer = new IModelTransformer(buildingDb, mergedDb, { targetScopeElementId: buildingSubjectId });
      await transformer.processSchemas(new BackendRequestContext());
      transformer.context.remapElement(IModel.rootSubjectId, buildingSubjectId);
      transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Building");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      buildingDb.close();
    }

    IModelTransformerUtils.dumpIModelInfo(mergedDb);
    mergedDb.close();
  });
});
