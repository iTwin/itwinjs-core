/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Guid, Id64, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { Box, LineString3d, LowAndHighXYZ, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Vector3d, XYZProps, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  AuxCoordSystem2dProps, CategorySelectorProps, Code, CodeScopeSpec, ColorDef, ElementProps, ExternalSourceAspectProps, FontType,
  GeometricElement2dProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps,
  IModel, ModelSelectorProps, Placement3d, Placement3dProps, SpatialViewDefinitionProps, SubCategoryAppearance, SubjectProps, BisCodeSpec,
} from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as hash from "object-hash";
import * as path from "path";
import {
  AuxCoordSystem, AuxCoordSystem2d, BackendRequestContext, BriefcaseManager, CategorySelector, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel,
  Drawing, DrawingCategory, DrawingGraphic, DrawingGraphicRepresentsElement, DrawingViewDefinition, ECSqlStatement, Element, ExternalSourceAspect, FunctionalModel, FunctionalSchema,
  GroupModel, IModelDb, IModelJsFs, IModelTransformer, InformationPartitionElement, InformationRecordModel, ModelSelector, OrthographicViewDefinition,
  PhysicalElement, PhysicalModel, PhysicalObject, Platform, SpatialCategory, SubCategory, Subject,
} from "../../imodeljs-backend";
import { KnownTestLocations } from "../KnownTestLocations";

/** Specialization of IModelTransformer for testing */
class TestIModelTransformer extends IModelTransformer {
  public numInsertElementCalls = 0;
  public numUpdateElementCalls = 0;
  public numExcludedElementCalls = 0;

  public numElementsInserted = 0;
  public numElementsUpdated = 0;
  public numElementsExcluded = 0;

  public numCodeSpecsExcluded = 0;

  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb);
    this.initExclusions();
    this.initCodeSpecRemapping();
    this.initCategoryRemapping();
    this.initClassRemapping();
  }

  /** Initialize some sample exclusion rules for testing */
  private initExclusions(): void {
    super.excludeCodeSpec("ExtraCodeSpec");
    super.excludeElementClass(AuxCoordSystem.classFullName); // want to exclude AuxCoordSystem2d/3d
    super.excludeSubject("/Only in Source");
  }

  /** Initialize some CodeSpec remapping rules for testing */
  private initCodeSpecRemapping(): void {
    this.remapCodeSpec("SourceCodeSpec", "TargetCodeSpec");
  }

  /** Initialize some category remapping rules for testing */
  private initCategoryRemapping(): void {
    const subjectId = this._sourceDb.elements.queryElementIdByCode(Subject.createCode(this._sourceDb, IModel.rootSubjectId, "Subject"))!;
    const definitionModelId = this._sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this._sourceDb, subjectId, "Definition"))!;
    const sourceCategoryId = this._sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(this._sourceDb, definitionModelId, "SourcePhysicalCategory"))!;
    const targetCategoryId = this._targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this._targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
    assert.isTrue(Id64.isValidId64(subjectId) && Id64.isValidId64(definitionModelId) && Id64.isValidId64(sourceCategoryId) && Id64.isValidId64(targetCategoryId));
    this.remapElement(sourceCategoryId, targetCategoryId);
    this.excludeElement(sourceCategoryId); // Don't process a specifically remapped element
  }

  /** Initialize some class remapping rules for testing */
  private initClassRemapping(): void {
    this.remapElementClass("TestTransformerSource:SourcePhysicalElement", "TestTransformerTarget:TargetPhysicalElement");
  }

  /** Override insertElement to count calls */
  protected insertElement(targetElementProps: ElementProps, sourceAspectProps: ExternalSourceAspectProps): void {
    this.numInsertElementCalls++;
    super.insertElement(targetElementProps, sourceAspectProps);
  }

  /** Override updateElement to count calls */
  protected updateElement(targetElementProps: ElementProps, sourceAspectProps: ExternalSourceAspectProps): void {
    this.numUpdateElementCalls++;
    super.updateElement(targetElementProps, sourceAspectProps);
  }

  /** Override shouldExcludeElement to count calls and exclude all Element from the Functional schema */
  protected shouldExcludeElement(sourceElement: Element): boolean {
    const excluded: boolean =
      super.shouldExcludeElement(sourceElement) ||
      sourceElement.classFullName.startsWith(FunctionalSchema.schemaName);

    if (excluded) { this.numExcludedElementCalls++; }
    return excluded;
  }

  /** Count the number of CodeSpecs excluded in this callback */
  protected onCodeSpecExcluded(codeSpecName: string): void {
    this.numCodeSpecsExcluded++;
    super.onCodeSpecExcluded(codeSpecName);
  }

  /** Count the number of Elements inserted in this callback */
  protected onElementInserted(sourceElement: Element, targetElementIds: Id64Array): void {
    this.numElementsInserted += targetElementIds.length;
    super.onElementInserted(sourceElement, targetElementIds);
  }

  /** Count the number of Elements updated in this callback */
  protected onElementUpdated(sourceElement: Element, targetElementIds: Id64Array): void {
    this.numElementsUpdated += targetElementIds.length;
    super.onElementUpdated(sourceElement, targetElementIds);
  }

  /** Count the number of Elements excluded in this callback */
  protected onElementExcluded(sourceElement: Element): void {
    this.numElementsExcluded++;
    super.onElementExcluded(sourceElement);
  }

  /** Override transformElement to make sure that all target Elements have a FederationGuid */
  protected transformElement(sourceElement: Element): ElementProps[] {
    const transformedElementProps: ElementProps[] = super.transformElement(sourceElement);
    for (const targetElementProps of transformedElementProps) {
      if (!targetElementProps.federationGuid) {
        targetElementProps.federationGuid = Guid.createValue();
      }
      if ("TestTransformerSource:SourcePhysicalElement" === sourceElement.classFullName) {
        targetElementProps.targetString = sourceElement.sourceString;
        targetElementProps.targetDouble = sourceElement.sourceDouble;
      }
    }
    return transformedElementProps;
  }
}

/** Manages the creation of the source and target iModels for testing. */
class TestDataManager {
  public sourceDb: IModelDb;
  public targetDb: IModelDb;

  public constructor() {
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
    // Source IModelDb
    const createdOutputFile: string = path.join(outputDir, "TestIModelTransformer-Source.bim");
    if (IModelJsFs.existsSync(createdOutputFile))
      IModelJsFs.removeSync(createdOutputFile);
    this.sourceDb = IModelDb.createSnapshot(createdOutputFile, { rootSubject: { name: "TestIModelTransformer-Source" } });
    assert.isTrue(IModelJsFs.existsSync(createdOutputFile));
    // Target IModelDb
    const importedOutputFile: string = path.join(outputDir, "TestIModelTransformer-Target.bim");
    if (IModelJsFs.existsSync(importedOutputFile))
      IModelJsFs.removeSync(importedOutputFile);
    this.targetDb = IModelDb.createSnapshot(importedOutputFile, { rootSubject: { name: "TestIModelTransformer-Target" } });
    assert.isTrue(IModelJsFs.existsSync(importedOutputFile));
  }

  public async prepareTargetDb(): Promise<void> {
    // Import desired target schemas
    const requestContext = new BackendRequestContext();
    const targetSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerTarget.ecschema.xml");
    await this.targetDb.importSchema(requestContext, targetSchemaFileName);
    // Insert a target-only CodeSpec to test remapping
    const targetCodeSpecId: Id64String = this.targetDb.codeSpecs.insert("TargetCodeSpec", CodeScopeSpec.Type.Model);
    assert.isTrue(Id64.isValidId64(targetCodeSpecId));
    // Insert some elements to avoid getting same IDs for sourceDb and targetDb
    const subjectId = Subject.insert(this.targetDb, IModel.rootSubjectId, "Only in Target");
    Subject.insert(this.targetDb, subjectId, "S1");
    Subject.insert(this.targetDb, subjectId, "S2");
    Subject.insert(this.targetDb, subjectId, "S3");
    Subject.insert(this.targetDb, subjectId, "S4");
    const targetPhysicalCategoryId = TestDataManager.insertSpatialCategory(this.targetDb, IModel.dictionaryId, "TargetPhysicalCategory", ColorDef.red);
    assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
  }

  public async createSourceDb(): Promise<void> {
    // Import desired source schemas
    const requestContext = new BackendRequestContext();
    await FunctionalSchema.importSchema(requestContext, this.sourceDb);
    FunctionalSchema.registerSchema();
    this.sourceDb.saveChanges();
    BriefcaseManager.createStandaloneChangeSet(this.sourceDb.briefcase); // importSchema below will fail if this is not called to flush local changes
    const sourceSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerSource.ecschema.xml");
    await this.sourceDb.importSchema(requestContext, sourceSchemaFileName);
    // Embed font
    if (Platform.platformName.startsWith("win")) {
      this.sourceDb.embedFont({ id: 1, type: FontType.TrueType, name: "Arial" });
      assert.exists(this.sourceDb.fontMap.getFont("Arial"));
      assert.exists(this.sourceDb.fontMap.getFont(1));
    }
    // Initialize project extents
    const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
    this.sourceDb.updateProjectExtents(projectExtents);
    // Create CodeSpecs
    const codeSpecId1: Id64String = this.sourceDb.codeSpecs.insert("SourceCodeSpec", CodeScopeSpec.Type.Model);
    const codeSpecId2: Id64String = this.sourceDb.codeSpecs.insert("ExtraCodeSpec", CodeScopeSpec.Type.ParentElement);
    assert.isTrue(Id64.isValidId64(codeSpecId1));
    assert.isTrue(Id64.isValidId64(codeSpecId2));
    // Create RepositoryModel structure
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
    const functionalModelId = FunctionalModel.insert(this.sourceDb, subjectId, "Functional");
    assert.isTrue(Id64.isValidId64(functionalModelId));
    const documentListModelId = DocumentListModel.insert(this.sourceDb, subjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingId = Drawing.insert(this.sourceDb, documentListModelId, "Drawing");
    assert.isTrue(Id64.isValidId64(drawingId));
    // Create DefinitionElements
    const modelSelectorId = ModelSelector.insert(this.sourceDb, definitionModelId, "PhysicalModels", [physicalModelId]);
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    const spatialCategoryId = TestDataManager.insertSpatialCategory(this.sourceDb, definitionModelId, "SpatialCategory", ColorDef.green);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const sourcePhysicalCategoryId = TestDataManager.insertSpatialCategory(this.sourceDb, definitionModelId, "SourcePhysicalCategory", ColorDef.blue);
    assert.isTrue(Id64.isValidId64(sourcePhysicalCategoryId));
    const subCategoryId = SubCategory.insert(this.sourceDb, spatialCategoryId, "SubCategory", { color: ColorDef.blue });
    assert.isTrue(Id64.isValidId64(subCategoryId));
    const drawingCategoryId = DrawingCategory.insert(this.sourceDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    const spatialCategorySelectorId = CategorySelector.insert(this.sourceDb, definitionModelId, "SpatialCategories", [spatialCategoryId, sourcePhysicalCategoryId]);
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId = CategorySelector.insert(this.sourceDb, definitionModelId, "DrawingCategories", [drawingCategoryId]);
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const displayStyle2dId = DisplayStyle2d.insert(this.sourceDb, definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValidId64(displayStyle2dId));
    const displayStyle3dId = DisplayStyle3d.insert(this.sourceDb, definitionModelId, "DisplayStyle3d");
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    const auxCoordSystemProps: AuxCoordSystem2dProps = {
      classFullName: AuxCoordSystem2d.classFullName,
      model: definitionModelId,
      code: AuxCoordSystem2d.createCode(this.sourceDb, definitionModelId, "AuxCoordSystem2d"),
    };
    const auxCoordSystemId = this.sourceDb.elements.insertElement(auxCoordSystemProps);
    assert.isTrue(Id64.isValidId64(auxCoordSystemId));
    // Create PhysicalElements
    const physicalObjectProps1: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject1",
      geom: TestDataManager.createBox(Point3d.create(1, 1, 1)),
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1: Id64String = this.sourceDb.elements.insertElement(physicalObjectProps1);
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    const hash1: string = this.sourceDb.elements.getElement<Element>({ id: physicalObjectId1, wantGeometry: true }).computeHash();
    const hash2: string = this.sourceDb.elements.getElement<PhysicalObject>({ id: physicalObjectId1, wantGeometry: true }).computeHash();
    assert.exists(hash1);
    assert.equal(hash1, hash2);
    const physicalObjectProps2: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject2",
      geom: TestDataManager.createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(2, 2, 2),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId2: Id64String = this.sourceDb.elements.insertElement(physicalObjectProps2);
    assert.isTrue(Id64.isValidId64(physicalObjectId2));
    const sourcePhysicalElementProps: GeometricElement3dProps = {
      classFullName: "TestTransformerSource:SourcePhysicalElement",
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalElement1",
      geom: TestDataManager.createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(4, 4, 4),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
      sourceString: "S1",
      sourceDouble: 1.1,
      commonString: "Common",
      commonDouble: 7.3,
      extraString: "Extra",
    };
    const sourcePhysicalElementId: Id64String = this.sourceDb.elements.insertElement(sourcePhysicalElementProps);
    assert.isTrue(Id64.isValidId64(sourcePhysicalElementId));
    // Create DrawingGraphics
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
    // Create ViewDefinitions
    const viewId = OrthographicViewDefinition.insert(this.sourceDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, projectExtents, StandardViewIndex.Iso);
    assert.isTrue(Id64.isValidId64(viewId));
    this.sourceDb.views.setDefaultViewId(viewId);
    const drawingViewRange = new Range2d(0, 0, 100, 100);
    const drawingViewId = DrawingViewDefinition.insert(this.sourceDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
    assert.isTrue(Id64.isValidId64(drawingViewId));
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

  public static insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
    const appearance: SubCategoryAppearance.Props = {
      color,
      transp: 0,
      invisible: false,
    };
    return SpatialCategory.insert(iModelDb, modelId, categoryName, appearance);
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

  public assertTargetDbContents(): void {
    // CodeSpec
    assert.isTrue(this.targetDb.codeSpecs.hasName("TargetCodeSpec"));
    assert.isFalse(this.targetDb.codeSpecs.hasName("SourceCodeSpec"));
    assert.isFalse(this.targetDb.codeSpecs.hasName("ExtraCodeSpec"));
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
    this.assertTargetElement(definitionModelId);
    this.assertTargetElement(informationModelId);
    this.assertTargetElement(groupModelId);
    this.assertTargetElement(physicalModelId);
    this.assertTargetElement(documentListModelId);
    // SpatialCategory
    const spatialCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, definitionModelId, "SpatialCategory"))!;
    this.assertTargetElement(spatialCategoryId);
    const spatialCategoryProps = this.targetDb.elements.getElementProps(spatialCategoryId);
    assert.equal(definitionModelId, spatialCategoryProps.model);
    assert.equal(definitionModelId, spatialCategoryProps.code.scope);
    assert.equal(undefined, this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, definitionModelId, "SourcePhysicalCategory")), "Should have been remapped");
    const targetPhysicalCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
    assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
    // SubCategory
    const subCategoryId = this.targetDb.elements.queryElementIdByCode(SubCategory.createCode(this.targetDb, spatialCategoryId, "SubCategory"))!;
    this.assertTargetElement(subCategoryId);
    // DrawingCategory
    const drawingCategoryId = this.targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(this.targetDb, definitionModelId, "DrawingCategory"))!;
    this.assertTargetElement(drawingCategoryId);
    const drawingCategoryProps = this.targetDb.elements.getElementProps(drawingCategoryId);
    assert.equal(definitionModelId, drawingCategoryProps.model);
    assert.equal(definitionModelId, drawingCategoryProps.code.scope);
    // Spatial CategorySelector
    const spatialCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "SpatialCategories"))!;
    this.assertTargetElement(spatialCategorySelectorId);
    const spatialCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(spatialCategorySelectorId);
    assert.isTrue(spatialCategorySelectorProps.categories.includes(spatialCategoryId));
    assert.isTrue(spatialCategorySelectorProps.categories.includes(targetPhysicalCategoryId), "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    // Drawing CategorySelector
    const drawingCategorySelectorId = this.targetDb.elements.queryElementIdByCode(CategorySelector.createCode(this.targetDb, definitionModelId, "DrawingCategories"))!;
    this.assertTargetElement(drawingCategorySelectorId);
    const drawingCategorySelectorProps = this.targetDb.elements.getElementProps<CategorySelectorProps>(drawingCategorySelectorId);
    assert.isTrue(drawingCategorySelectorProps.categories.includes(drawingCategoryId));
    // ModelSelector
    const modelSelectorId = this.targetDb.elements.queryElementIdByCode(ModelSelector.createCode(this.targetDb, definitionModelId, "PhysicalModels"))!;
    this.assertTargetElement(modelSelectorId);
    const modelSelectorProps = this.targetDb.elements.getElementProps<ModelSelectorProps>(modelSelectorId);
    assert.isTrue(modelSelectorProps.models.includes(physicalModelId));
    // DisplayStyle
    const displayStyle3dId = this.targetDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(this.targetDb, definitionModelId, "DisplayStyle3d"))!;
    this.assertTargetElement(displayStyle3dId);
    // ViewDefinition
    const viewId = this.targetDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(this.targetDb, definitionModelId, "Orthographic View"))!;
    this.assertTargetElement(viewId);
    const viewProps = this.targetDb.elements.getElementProps<SpatialViewDefinitionProps>(viewId);
    assert.equal(viewProps.displayStyleId, displayStyle3dId);
    assert.equal(viewProps.categorySelectorId, spatialCategorySelectorId);
    assert.equal(viewProps.modelSelectorId, modelSelectorId);
    // AuxCoordSystem2d
    assert.equal(undefined, this.targetDb.elements.queryElementIdByCode(AuxCoordSystem2d.createCode(this.targetDb, definitionModelId, "AuxCoordSystem2d")), "Should have been excluded by class");
    // PhysicalElement
    const physicalObjectId1: Id64String = TestDataManager.queryByUserLabel(this.targetDb, "PhysicalObject1");
    const physicalObjectId2: Id64String = TestDataManager.queryByUserLabel(this.targetDb, "PhysicalObject2");
    const physicalElementId1: Id64String = TestDataManager.queryByUserLabel(this.targetDb, "PhysicalElement1");
    this.assertTargetElement(physicalObjectId1);
    this.assertTargetElement(physicalObjectId2);
    this.assertTargetElement(physicalElementId1);
    const physicalObject1: PhysicalObject = this.targetDb.elements.getElement<PhysicalObject>(physicalObjectId1);
    const physicalObject2: PhysicalObject = this.targetDb.elements.getElement<PhysicalObject>(physicalObjectId2);
    const physicalElement1: PhysicalElement = this.targetDb.elements.getElement<PhysicalElement>(physicalElementId1);
    assert.equal(physicalObject1.category, spatialCategoryId, "SpatialCategory should have been imported");
    assert.equal(physicalObject2.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    assert.equal(physicalElement1.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    assert.equal(physicalElement1.classFullName, "TestTransformerTarget:TargetPhysicalElement", "Class should have been remapped");
    assert.equal(physicalElement1.targetString, "S1", "Property should have been remapped by transformElement override");
    assert.equal(physicalElement1.targetDouble, 1.1, "Property should have been remapped by transformElement override");
    assert.equal(physicalElement1.commonString, "Common", "Property should have been automatically remapped (same name)");
    assert.equal(physicalElement1.commonDouble, 7.3, "Property should have been automatically remapped (same name)");
    assert.notExists(physicalElement1.extraString, "Property should have been dropped during transformation");
  }

  public static queryByUserLabel(iModelDb: IModelDb, userLabel: string): Id64String {
    return iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE UserLabel=?`, (statement: ECSqlStatement): Id64String => {
      statement.bindString(1, userLabel);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }

  public assertTargetElement(targetElementId: Id64String): void {
    assert.isTrue(Id64.isValidId64(targetElementId));
    const element: Element = this.targetDb.elements.getElement(targetElementId);
    assert.isTrue(element.federationGuid && Guid.isV4Guid(element.federationGuid));
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

describe("IModelTransformer", () => {
  let testDataManager: TestDataManager;

  before(async () => {
    testDataManager = new TestDataManager();
    await testDataManager.createSourceDb();
    await testDataManager.prepareTargetDb();
  });

  after(async () => {
    testDataManager.sourceDb.closeSnapshot();
    testDataManager.targetDb.closeSnapshot();
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

  it("should remap", async () => {
    const transformer = new IModelTransformer(testDataManager.sourceDb, testDataManager.targetDb); // something to satisfy constructor, not actually going to import
    assert.doesNotThrow(() => transformer.remapCodeSpec(BisCodeSpec.nullCodeSpec, BisCodeSpec.nullCodeSpec));
    assert.doesNotThrow(() => transformer.remapElementClass(Element.classFullName, Element.classFullName));
    assert.doesNotThrow(() => transformer.remapElement(IModel.rootSubjectId, IModel.rootSubjectId));
    assert.equal(IModel.rootSubjectId, transformer.findTargetElementId(IModel.rootSubjectId));
    transformer.dispose();
  });

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

  it("should import", async () => {
    let numElementsExcluded: number;

    if (true) { // initial import
      const transformer = new TestIModelTransformer(testDataManager.sourceDb, testDataManager.targetDb);
      transformer.importAll();
      transformer.dispose();
      assert.isAbove(transformer.numCodeSpecsExcluded, 0);
      assert.isAbove(transformer.numElementsInserted, 0);
      assert.isAbove(transformer.numElementsUpdated, 0);
      assert.isAbove(transformer.numElementsExcluded, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementCalls);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementCalls);
      assert.equal(transformer.numElementsExcluded, transformer.numExcludedElementCalls);
      numElementsExcluded = transformer.numElementsExcluded;
      testDataManager.targetDb.saveChanges();
      testDataManager.assertTargetDbContents();
    }

    const elementCount: number = countElements(testDataManager.targetDb);
    const aspectCount: number = countExternalSourceAspects(testDataManager.targetDb);

    if (true) { // second import with no changes to source, should be a no-op
      const transformer = new TestIModelTransformer(testDataManager.sourceDb, testDataManager.targetDb);
      transformer.importAll();
      transformer.dispose();
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsUpdated, 0);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      assert.equal(transformer.numInsertElementCalls, 0);
      assert.equal(transformer.numUpdateElementCalls, 0);
      assert.equal(transformer.numExcludedElementCalls, numElementsExcluded);
      assert.equal(elementCount, countElements(testDataManager.targetDb), "Second import should not add elements");
      assert.equal(aspectCount, countExternalSourceAspects(testDataManager.targetDb), "Second import should not add aspects");
    }

    if (true) { // update source db, then import again
      testDataManager.updateSourceDb();
      const transformer = new TestIModelTransformer(testDataManager.sourceDb, testDataManager.targetDb);
      transformer.importAll();
      transformer.dispose();
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsUpdated, 2);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      testDataManager.targetDb.saveChanges();
      testDataManager.assertUpdatesInTargetDb();
      assert.equal(elementCount, countElements(testDataManager.targetDb), "Third import should not add elements");
      assert.equal(aspectCount, countExternalSourceAspects(testDataManager.targetDb), "Third import should not add aspects");
    }
  });
});
