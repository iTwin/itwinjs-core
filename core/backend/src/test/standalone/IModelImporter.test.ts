/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Box, LineString3d, Point3d, Range2d, Vector3d, YawPitchRollAngles, Point2d, StandardViewIndex } from "@bentley/geometry-core";
import { AxisAlignedBox3d, CodeScopeSpec, ColorDef, FontType, GeometricElement2dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, SubCategoryAppearance, Code, GeometricElement3dProps, CategorySelectorProps, SubjectProps, SpatialViewDefinitionProps, ModelSelectorProps, AuxCoordSystem2dProps } from "@bentley/imodeljs-common";
import {
  AuxCoordSystem2d, CategorySelector, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel,
  Drawing, DrawingCategory, DrawingGraphic, DrawingGraphicRepresentsElement, DrawingViewDefinition, IModelDb, IModelImporter, IModelJsFs, InformationPartitionElement,
  ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalObject, Platform, SpatialCategory, SubCategory, Subject,
} from "../../imodeljs-backend";
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
    this.sourceDb = IModelDb.createStandalone(createdOutputFile, { rootSubject: { name: "TestIModelImporter-Source" } });
    assert.isTrue(IModelJsFs.existsSync(createdOutputFile));
    // Target IModelDb
    const importedOutputFile: string = path.join(outputDir, "TestIModelImporter-Target.bim");
    if (IModelJsFs.existsSync(importedOutputFile))
      IModelJsFs.removeSync(importedOutputFile);
    this.targetDb = IModelDb.createStandalone(importedOutputFile, { rootSubject: { name: "TestIModelImporter-Target" } });
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
    const projectExtents = new AxisAlignedBox3d(new Point3d(-1000, -1000, -1000), new Point3d(1000, 1000, 1000));
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
    const physicalModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Physical"))!;
    const documentListModelId = this.targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.targetDb, subjectId, "Document"))!;
    assert.isTrue(Id64.isValidId64(definitionModelId));
    assert.isTrue(Id64.isValidId64(physicalModelId));
    assert.isTrue(Id64.isValidId64(documentListModelId));
    // SpatialCategory
    const spatialCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, definitionModelId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const spatialCategoryProps = this.targetDb.elements.getElementProps(spatialCategoryId);
    assert.equal(definitionModelId, spatialCategoryProps.model);
    assert.equal(definitionModelId, spatialCategoryProps.code.scope);
    const subCategoryId = this.targetDb.elements.queryElementIdByCode(SubCategory.createCode(this.targetDb, spatialCategoryId, "SubCategory"))!;
    assert.isTrue(Id64.isValidId64(subCategoryId));
    // DrawingCategory
    const drawingCategoryId = this.targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(this.targetDb, definitionModelId, "DrawingCategory"))!;
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    const drawingCategoryProps = this.targetDb.elements.getElementProps(drawingCategoryId);
    assert.equal(definitionModelId, drawingCategoryProps.model);
    assert.equal(definitionModelId, drawingCategoryProps.code.scope);
    // Spatial CategorySelector
    const spatialCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "SpatialCategories"))!;
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const spatialCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(spatialCategorySelectorId);
    assert.isTrue(spatialCategorySelectorProps.categories.includes(spatialCategoryId));
    // Drawing CategorySelector
    const drawingCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "DrawingCategories"))!;
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const drawingCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(drawingCategorySelectorId);
    assert.isTrue(drawingCategorySelectorProps.categories.includes(drawingCategoryId));
    // ModelSelector
    const modelSelectorId = this.targetDb.elements.queryElementIdByCode(ModelSelector.createCode(this.targetDb, definitionModelId, "PhysicalModels"))!;
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    const modelSelectorProps = this.targetDb.elements.getElementProps<ModelSelectorProps>(modelSelectorId);
    assert.isTrue(modelSelectorProps.models.includes(physicalModelId));
    // DisplayStyle
    const displayStyle3dId = this.targetDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(this.targetDb, definitionModelId, "DisplayStyle3d"))!;
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    // ViewDefinition
    const viewId = this.targetDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(this.targetDb, definitionModelId, "Orthographic View"))!;
    assert.isTrue(Id64.isValidId64(viewId));
    const viewProps = this.targetDb.elements.getElementProps<SpatialViewDefinitionProps>(viewId);
    assert.equal(viewProps.displayStyleId, displayStyle3dId);
    assert.equal(viewProps.categorySelectorId, spatialCategorySelectorId);
    assert.equal(viewProps.modelSelectorId, modelSelectorId);
    // AuxCoordSystem2d
    assert.equal(undefined, this.targetDb.elements.queryElementIdByCode(AuxCoordSystem2d.createCode(this.targetDb, definitionModelId, "AuxCoordSystem2d")));
  }
}

describe("IModelImporter", () => {
  it("should import", async () => {
    const manager = new TestDataManager();
    manager.createSourceDb();
    manager.testIdMaps();
    manager.importIntoTargetDb();
    manager.assertTargetDbContents();
  });
});
