/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String, DbResult, Guid } from "@bentley/bentleyjs-core";
import { Box, LineString3d, LowAndHighXYZ, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Vector3d, XYZProps, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  AuxCoordSystem2dProps, CategorySelectorProps, Code, CodeScopeSpec, ColorDef, FontType,
  GeometricElement2dProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, ModelSelectorProps,
  Placement3d, Placement3dProps, SpatialViewDefinitionProps, SubCategoryAppearance, SubjectProps,
} from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as hash from "object-hash";
import * as path from "path";
import { ExternalSourceAspect } from "../../ElementAspect";
import {
  AuxCoordSystem2d, CategorySelector, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel,
  Drawing, DrawingCategory, DrawingGraphic, DrawingGraphicRepresentsElement, DrawingViewDefinition, Element, GroupModel,
  IModelDb, IModelImporter, IModelJsFs, InformationPartitionElement, InformationRecordModel, ModelSelector, OrthographicViewDefinition,
  PhysicalModel, PhysicalObject, Platform, SpatialCategory, SubCategory, Subject, ECSqlStatement,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

class TestDataManager {
  public sourceDb: IModelDb;
  public targetDb: IModelDb;

  public constructor() {
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
    // Source IModelDb
    const createdOutputFile: string = path.join(outputDir, "TestIModelImporter-Source.bim");
    if (IModelJsFs.existsSync(createdOutputFile))
      IModelJsFs.removeSync(createdOutputFile);
    this.sourceDb = IModelDb.createSnapshot(createdOutputFile, { rootSubject: { name: "TestIModelImporter-Source" } });
    assert.isTrue(IModelJsFs.existsSync(createdOutputFile));
    // Target IModelDb
    const importedOutputFile: string = path.join(outputDir, "TestIModelImporter-Target.bim");
    if (IModelJsFs.existsSync(importedOutputFile))
      IModelJsFs.removeSync(importedOutputFile);
    this.targetDb = IModelDb.createSnapshot(importedOutputFile, { rootSubject: { name: "TestIModelImporter-Target" } });
    assert.isTrue(IModelJsFs.existsSync(importedOutputFile));
    // insert some elements to avoid getting same IDs for sourceDb and targetDb
    const subjectId = Subject.insert(this.targetDb, IModel.rootSubjectId, "Only in Target");
    Subject.insert(this.targetDb, subjectId, "1");
    Subject.insert(this.targetDb, subjectId, "2");
    Subject.insert(this.targetDb, subjectId, "3");
    Subject.insert(this.targetDb, subjectId, "4");
  }

  public createSourceDb(): void {
    if (Platform.platformName.startsWith("win")) {
      this.sourceDb.embedFont({ id: 1, type: FontType.TrueType, name: "Arial" });
      assert.exists(this.sourceDb.fontMap.getFont("Arial"));
      assert.exists(this.sourceDb.fontMap.getFont(1));
    }
    const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
    this.sourceDb.updateProjectExtents(projectExtents);
    const codeSpecId1: Id64String = this.sourceDb.codeSpecs.insert("CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId2: Id64String = this.sourceDb.codeSpecs.insert("CodeSpec2", CodeScopeSpec.Type.ParentElement);
    assert.isTrue(Id64.isValidId64(codeSpecId1));
    assert.isTrue(Id64.isValidId64(codeSpecId2));
    const subjectId = Subject.insert(this.sourceDb, IModel.rootSubjectId, "Subject", "Subject description");
    assert.isTrue(Id64.isValidId64(subjectId));
    const sourceOnlySubjectId = Subject.insert(this.sourceDb, IModel.rootSubjectId, "Only in Source");
    assert.isTrue(Id64.isValidId64(sourceOnlySubjectId));
    const definitionModelId = DefinitionModel.insert(this.sourceDb, subjectId, "Definition");
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const informationModelId = InformationRecordModel.insert(this.sourceDb, subjectId, "Information");
    assert.isTrue(Id64.isValidId64(informationModelId));
    const groupModelId = GroupModel.insert(this.sourceDb, subjectId, "Group");
    assert.isTrue(Id64.isValidId64(groupModelId));
    const physicalModelId = PhysicalModel.insert(this.sourceDb, subjectId, "Physical");
    assert.isTrue(Id64.isValidId64(physicalModelId));
    const documentListModelId = DocumentListModel.insert(this.sourceDb, subjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingId = Drawing.insert(this.sourceDb, documentListModelId, "Drawing");
    assert.isTrue(Id64.isValidId64(drawingId));
    const modelSelectorId = ModelSelector.insert(this.sourceDb, definitionModelId, "PhysicalModels", [physicalModelId]);
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    const defaultAppearance: SubCategoryAppearance.Props = {
      color: ColorDef.green,
      transp: 0,
      invisible: false,
    };
    defaultAppearance.color = ColorDef.green;
    const spatialCategoryId = SpatialCategory.insert(this.sourceDb, definitionModelId, "SpatialCategory", defaultAppearance);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const subCategoryId = SubCategory.insert(this.sourceDb, spatialCategoryId, "SubCategory", { color: ColorDef.blue });
    assert.isTrue(Id64.isValidId64(subCategoryId));
    const physicalObjectProps1: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject1",
      geom: TestDataManager.createBox(Point3d.create(1, 1, 1)),
      placement: {
        origin: Point3d.create(2, 2, 2),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1: Id64String = this.sourceDb.elements.insertElement(physicalObjectProps1);
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    const hash1: string = this.sourceDb.elements.getElement<Element>({ id: physicalObjectId1, wantGeometry: true }).computeHash();
    const hash2: string = this.sourceDb.elements.getElement<PhysicalObject>({ id: physicalObjectId1, wantGeometry: true }).computeHash();
    assert.exists(hash1);
    assert.equal(hash1, hash2);
    const drawingCategoryId = DrawingCategory.insert(this.sourceDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    const drawingGraphicProps: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic",
      geom: TestDataManager.createRectangle(Point2d.create(1, 1)),
      placement: {
        origin: Point2d.create(2, 2),
        angle: 0,
      },
    };
    const drawingGraphicId = this.sourceDb.elements.insertElement(drawingGraphicProps);
    assert.isTrue(Id64.isValidId64(drawingGraphicId));
    const drawingGraphicRepresentsId = DrawingGraphicRepresentsElement.insert(this.sourceDb, drawingGraphicId, physicalObjectId1);
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId));
    const spatialCategorySelectorId = CategorySelector.insert(this.sourceDb, definitionModelId, "SpatialCategories", [spatialCategoryId]);
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId = CategorySelector.insert(this.sourceDb, definitionModelId, "DrawingCategories", [drawingCategoryId]);
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const displayStyle2dId = DisplayStyle2d.insert(this.sourceDb, definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValidId64(displayStyle2dId));
    const displayStyle3dId = DisplayStyle3d.insert(this.sourceDb, definitionModelId, "DisplayStyle3d");
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    const viewId = OrthographicViewDefinition.insert(this.sourceDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, projectExtents, StandardViewIndex.Iso);
    assert.isTrue(Id64.isValidId64(viewId));
    this.sourceDb.views.setDefaultViewId(viewId);
    const drawingViewRange = new Range2d(0, 0, 100, 100);
    const drawingViewId = DrawingViewDefinition.insert(this.sourceDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
    assert.isTrue(Id64.isValidId64(drawingViewId));
    const auxCoordSystemProps: AuxCoordSystem2dProps = {
      classFullName: AuxCoordSystem2d.classFullName,
      model: definitionModelId,
      code: AuxCoordSystem2d.createCode(this.sourceDb, definitionModelId, "AuxCoordSystem2d"),
    };
    const auxCoordSystemId = this.sourceDb.elements.insertElement(auxCoordSystemProps);
    assert.isTrue(Id64.isValidId64(auxCoordSystemId));
    this.sourceDb.saveChanges();
  }

  public static createBox(size: Point3d): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(Box.createDgnBox(
      Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
      size.x, size.y, size.x, size.y, true,
    )!);
    return geometryStreamBuilder.geometryStream;
  }

  public static createRectangle(size: Point2d): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(LineString3d.createPoints([
      new Point3d(0, 0),
      new Point3d(size.x, 0),
      new Point3d(size.x, size.y),
      new Point3d(0, size.y),
      new Point3d(0, 0),
    ]));
    return geometryStreamBuilder.geometryStream;
  }

  public testIdMaps(): void {
    const remapTester = new IModelImporter(this.sourceDb, this.targetDb);
    const id1 = "0x1";
    const id2 = "0x2";
    remapTester.addCodeSpecId(id1, id2);
    assert.equal(id2, remapTester.findCodeSpecId(id1));
    remapTester.addElementId(id1, id2);
    assert.equal(id2, remapTester.findElementId(id1));
    remapTester.dispose();
  }

  public importIntoTargetDb(): void {
    const importer = new IModelImporter(this.sourceDb, this.targetDb);
    importer.excludeCodeSpec("CodeSpec2");
    importer.excludeElementClass(AuxCoordSystem2d.classFullName);
    importer.excludeSubject("/Only in Source");
    importer.import();
    importer.dispose();
    this.targetDb.saveChanges();
  }

  public assertTargetDbContents(): void {
    // CodeSpec
    assert.isTrue(this.targetDb.codeSpecs.hasName("CodeSpec1"));
    assert.isFalse(this.targetDb.codeSpecs.hasName("CodeSpec2"));
    // Font
    if (Platform.platformName.startsWith("win")) {
      assert.exists(this.targetDb.fontMap.getFont("Arial"));
    }
    // Subject
    const subjectId = this.targetDb.elements.queryElementIdByCode(Subject.createCode(this.targetDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subjectProps: SubjectProps = this.targetDb.elements.getElementProps(subjectId) as SubjectProps;
    assert.equal(subjectProps.description, "Subject description"); // description is an auto-handled property
    const sourceOnlySubjectId = this.targetDb.elements.queryElementIdByCode(Subject.createCode(this.targetDb, IModel.rootSubjectId, "Only in Source"));
    assert.equal(undefined, sourceOnlySubjectId);
    const targetOnlySubjectId = this.targetDb.elements.queryElementIdByCode(Subject.createCode(this.targetDb, IModel.rootSubjectId, "Only in Target"))!;
    assert.isTrue(Id64.isValidId64(targetOnlySubjectId));
    // Partitions / Models
    const definitionModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Definition"))!;
    const informationModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Information"))!;
    const groupModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Group"))!;
    const physicalModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Physical"))!;
    const documentListModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Document"))!;
    this.assertExternalSourceAspect(definitionModelId);
    this.assertExternalSourceAspect(informationModelId);
    this.assertExternalSourceAspect(groupModelId);
    this.assertExternalSourceAspect(physicalModelId);
    this.assertExternalSourceAspect(documentListModelId);
    // SpatialCategory
    const spatialCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, definitionModelId, "SpatialCategory"))!;
    this.assertExternalSourceAspect(spatialCategoryId);
    const spatialCategoryProps = this.targetDb.elements.getElementProps(spatialCategoryId);
    assert.equal(definitionModelId, spatialCategoryProps.model);
    assert.equal(definitionModelId, spatialCategoryProps.code.scope);
    // SubCategory
    const subCategoryId = this.targetDb.elements.queryElementIdByCode(SubCategory.createCode(this.targetDb, spatialCategoryId, "SubCategory"))!;
    this.assertExternalSourceAspect(subCategoryId);
    // DrawingCategory
    const drawingCategoryId = this.targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(this.targetDb, definitionModelId, "DrawingCategory"))!;
    this.assertExternalSourceAspect(drawingCategoryId);
    const drawingCategoryProps = this.targetDb.elements.getElementProps(drawingCategoryId);
    assert.equal(definitionModelId, drawingCategoryProps.model);
    assert.equal(definitionModelId, drawingCategoryProps.code.scope);
    // Spatial CategorySelector
    const spatialCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "SpatialCategories"))!;
    this.assertExternalSourceAspect(spatialCategorySelectorId);
    const spatialCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(spatialCategorySelectorId);
    assert.isTrue(spatialCategorySelectorProps.categories.includes(spatialCategoryId));
    // Drawing CategorySelector
    const drawingCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "DrawingCategories"))!;
    this.assertExternalSourceAspect(drawingCategorySelectorId);
    const drawingCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(drawingCategorySelectorId);
    assert.isTrue(drawingCategorySelectorProps.categories.includes(drawingCategoryId));
    // ModelSelector
    const modelSelectorId = this.targetDb.elements.queryElementIdByCode(ModelSelector.createCode(this.targetDb, definitionModelId, "PhysicalModels"))!;
    this.assertExternalSourceAspect(modelSelectorId);
    const modelSelectorProps = this.targetDb.elements.getElementProps<ModelSelectorProps>(modelSelectorId);
    assert.isTrue(modelSelectorProps.models.includes(physicalModelId));
    // DisplayStyle
    const displayStyle3dId = this.targetDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(this.targetDb, definitionModelId, "DisplayStyle3d"))!;
    this.assertExternalSourceAspect(displayStyle3dId);
    // ViewDefinition
    const viewId = this.targetDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(this.targetDb, definitionModelId, "Orthographic View"))!;
    this.assertExternalSourceAspect(viewId);
    const viewProps = this.targetDb.elements.getElementProps<SpatialViewDefinitionProps>(viewId);
    assert.equal(viewProps.displayStyleId, displayStyle3dId);
    assert.equal(viewProps.categorySelectorId, spatialCategorySelectorId);
    assert.equal(viewProps.modelSelectorId, modelSelectorId);
    // AuxCoordSystem2d
    assert.equal(undefined, this.targetDb.elements.queryElementIdByCode(AuxCoordSystem2d.createCode(this.targetDb, definitionModelId, "AuxCoordSystem2d")));
  }

  public assertExternalSourceAspect(targetElementId: Id64String): void {
    assert.isTrue(Id64.isValidId64(targetElementId));
    const aspect: ExternalSourceAspect = this.targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName)[0] as ExternalSourceAspect;
    assert.exists(aspect);
    assert.equal(aspect.kind, Element.className);
    assert.equal(aspect.scope.id, IModel.rootSubjectId);
    assert.exists(aspect.version);
    const targetLastMod: string = this.targetDb.elements.queryLastModifiedTime(targetElementId);
    assert.notEqual(aspect.version, targetLastMod);
    const sourceElement: Element = this.sourceDb.elements.getElement({ id: aspect.identifier, wantGeometry: true });
    assert.exists(sourceElement);
    assert.equal(sourceElement.computeHash(), aspect.checksum);
  }

  public updateSourceDb(): void {
    const subjectId = this.sourceDb.elements.queryElementIdByCode(Subject.createCode(this.sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subject: Subject = this.sourceDb.elements.getElement<Subject>(subjectId);
    subject.description = "Subject description (Updated)";
    this.sourceDb.elements.updateElement(subject);
    const definitionModelId = this.sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.sourceDb, subjectId, "Definition"))!;
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const spatialCategoryId = this.sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.sourceDb, definitionModelId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const spatialCategory: SpatialCategory = this.sourceDb.elements.getElement<SpatialCategory>(spatialCategoryId);
    spatialCategory.federationGuid = Guid.createValue();
    this.sourceDb.elements.updateElement(spatialCategory);
    this.sourceDb.saveChanges();
  }

  public assertUpdatesInTargetDb(): void {
    // assert Subject was updated
    const subjectId = this.targetDb.elements.queryElementIdByCode(Subject.createCode(this.targetDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subject: Subject = this.targetDb.elements.getElement<Subject>(subjectId);
    assert.equal(subject.description, "Subject description (Updated)");
    // assert SpatialCategory was updated
    const definitionModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Definition"))!;
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const spatialCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, definitionModelId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const spatialCategory: SpatialCategory = this.targetDb.elements.getElement<SpatialCategory>(spatialCategoryId);
    assert.exists(spatialCategory.federationGuid);
  }
}

describe("IModelImporter", () => {
  it("should import", async () => {
    const manager = new TestDataManager();
    manager.createSourceDb();
    manager.testIdMaps();
    manager.importIntoTargetDb();
    manager.assertTargetDbContents();

    // re-import to ensure no additional elements are imported
    const elementCount: number = countElements(manager.targetDb);
    const aspectCount: number = countExternalSourceAspects(manager.targetDb);
    manager.importIntoTargetDb(); // second import should be a no-op
    assert.equal(elementCount, countElements(manager.targetDb), "Second import should not add elements");
    assert.equal(aspectCount, countExternalSourceAspects(manager.targetDb), "Second import should not add aspects");

    manager.updateSourceDb();
    manager.importIntoTargetDb();
    manager.assertUpdatesInTargetDb();
    assert.equal(elementCount, countElements(manager.targetDb), "Third import should not add elements");
    assert.equal(aspectCount, countExternalSourceAspects(manager.targetDb), "Third import should not add aspects");
  });

  function countElements(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${Element.classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function countExternalSourceAspects(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${ExternalSourceAspect.classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function isEqualHash(object1: object, object2: object): boolean {
    const options: object = { respectType: false };
    const hash1: string = hash(object1, options);
    const hash2: string = hash(object2, options);
    assert.exists(hash1);
    assert.exists(hash2);
    // console.log("==="); // tslint:disable-line:no-console
    // (hash as any).writeToStream(object1, options, process.stdout);
    // console.log("\n==="); // tslint:disable-line:no-console
    // (hash as any).writeToStream(object2, options, process.stdout);
    // console.log("\n==="); // tslint:disable-line:no-console
    return hash1 === hash2;
  }

  it("test object-hash", async () => {
    assert.isTrue(isEqualHash({ a: 1, b: "B" }, { b: "B", a: 1 }), "Object member order should not matter");
    assert.isFalse(isEqualHash([1, 2], [2, 1]), "Array entry order should matter");
    const point1: Point3d = new Point3d(1, 2, 3);
    const point2: Point3d = new Point3d(1, 2, 3);
    const range1: Range3d = new Range3d(1, 1, 1, 2, 2, 2);
    const range2: Range3d = new Range3d(1, 1, 1, 2, 2, 2);
    const placement1: Placement3d = new Placement3d(point1, new YawPitchRollAngles(), range1);
    const placement2: Placement3d = new Placement3d(point2, new YawPitchRollAngles(), range2);
    assert.isTrue(isEqualHash(placement1, placement2), "Should have same hash");
    placement2.bbox.high.z = 3;
    assert.isFalse(isEqualHash(placement1, placement2), "Should recurse into nested objects to detect difference");
    const pointProps1: XYZProps = { x: 1, y: 2, z: 3 };
    const pointProps2: XYZProps = { x: 1, y: 2, z: 3 };
    const rangeProps1: LowAndHighXYZ = { low: { x: 1, y: 1, z: 1 }, high: { x: 2, y: 2, z: 2 } };
    const rangeProps2: LowAndHighXYZ = { low: { x: 1, y: 1, z: 1 }, high: { x: 2, y: 2, z: 2 } };
    const placementProps1: Placement3dProps = { origin: pointProps1, angles: {}, bbox: rangeProps1 };
    const placementProps2: Placement3dProps = { origin: pointProps2, angles: {}, bbox: rangeProps2 };
    assert.isTrue(isEqualHash(placementProps1, placementProps2), "Should have same hash");
    placementProps2.bbox!.high.z = 3;
    assert.isFalse(isEqualHash(placementProps1, placementProps2), "Should recurse into nested objects to detect difference");
  });

  it.skip("OPData", async () => {
    const seedDataDirectory = "d:/temp/importer/";
    const sourceDbFileName = "OPData.bim";
    const targetDbFileName = "OPDataTrg.bim";
    const dgnV8CodeSpecName = "DgnV8LW";
    const functionalPartitionName = "ProcessFunctionalModel";

    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);

    const sourceDb: IModelDb = IModelDb.openSnapshot(path.join(seedDataDirectory, sourceDbFileName));
    const targetDb: IModelDb = IModelTestUtils.createSnapshotFromSeed(path.join(outputDir, targetDbFileName), path.join(seedDataDirectory, targetDbFileName));
    assert.exists(sourceDb);
    assert.exists(targetDb);
    assert.isTrue(sourceDb.codeSpecs.hasName(dgnV8CodeSpecName));
    assert.isFalse(targetDb.codeSpecs.hasName(dgnV8CodeSpecName));

    const importer: IModelImporter = new IModelImporter(sourceDb, targetDb);
    const targetScopeElementId: Id64String = IModel.rootSubjectId; // WIP - Needs to be Element in target IModelDb that represents the source repository
    assert.exists(importer);
    importer.importCodeSpecs();
    targetDb.saveChanges("Import CodeSpecs");
    assert.isTrue(targetDb.codeSpecs.hasName(dgnV8CodeSpecName));

    const sourceFunctionalPartitionCode: Code = InformationPartitionElement.createCode(sourceDb, IModel.rootSubjectId, functionalPartitionName);
    const targetFunctionalPartitionCode: Code = InformationPartitionElement.createCode(targetDb, IModel.rootSubjectId, functionalPartitionName);
    const sourceFunctionalPartitionId: Id64String = sourceDb.elements.queryElementIdByCode(sourceFunctionalPartitionCode)!;
    const targetFunctionalPartitionId: Id64String = targetDb.elements.queryElementIdByCode(targetFunctionalPartitionCode)!;
    assert.isTrue(Id64.isValidId64(sourceFunctionalPartitionId));
    assert.isTrue(Id64.isValidId64(targetFunctionalPartitionId));
    assert.exists(sourceDb.models.getModel(sourceFunctionalPartitionId));
    assert.exists(targetDb.models.getModel(targetFunctionalPartitionId));
    importer.addElementId(sourceFunctionalPartitionId, targetFunctionalPartitionId);

    const sourceFunctionalElementCount: number = await sourceDb.queryRowCount(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE Model.Id=${sourceFunctionalPartitionId}`);
    let targetFunctionalElementCount: number = await targetDb.queryRowCount(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE Model.Id=${targetFunctionalPartitionId}`);
    assert.isAtLeast(sourceFunctionalElementCount, 1);
    assert.equal(targetFunctionalElementCount, 0);
    importer.importModelContents(sourceFunctionalPartitionId, targetScopeElementId);
    targetDb.saveChanges("Import FunctionalModel contents");
    targetFunctionalElementCount = await targetDb.queryRowCount(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE Model.Id=${targetFunctionalPartitionId}`);
    assert.equal(sourceFunctionalElementCount, targetFunctionalElementCount);

    importer.dispose();
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
    console.log("IMPORTER-1"); // tslint:disable-line:no-console
  });
});
