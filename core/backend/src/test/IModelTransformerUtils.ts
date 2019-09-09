/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Guid, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Box, LineString3d, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  AuxCoordSystem2dProps, CategorySelectorProps, Code, CodeScopeSpec, ColorDef, ElementAspectProps, ElementProps, FontType,
  GeometricElement2dProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps,
  IModel, ModelProps, ModelSelectorProps, SpatialViewDefinitionProps, SubCategoryAppearance, SubjectProps,
} from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import {
  AuxCoordSystem, AuxCoordSystem2d, BackendRequestContext, CategorySelector, DefinitionModel, DefinitionPartition,
  DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, DrawingGraphicRepresentsElement, DrawingViewDefinition,
  ECSqlStatement, Element, ElementAspect, ElementOwnsMultiAspects, ElementOwnsUniqueAspect, ExternalSourceAspect, FunctionalModel, FunctionalSchema, GroupModel,
  IModelDb, IModelJsFs, IModelTransformer, InformationPartitionElement, InformationRecordModel, Model, ModelSelector, OrthographicViewDefinition,
  PhysicalElement, PhysicalModel, PhysicalObject, PhysicalPartition, Platform, Relationship, RelationshipProps, SpatialCategory, SubCategory, Subject,
} from "../imodeljs-backend";
import { KnownTestLocations } from "./KnownTestLocations";

export async function prepareSourceDb(sourceDb: IModelDb): Promise<void> {
  // Import desired target schemas
  const requestContext = new BackendRequestContext();
  const sourceSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerSource.ecschema.xml");
  await sourceDb.importSchemas(requestContext, [FunctionalSchema.schemaFilePath, sourceSchemaFileName]);
  FunctionalSchema.registerSchema();
}

export function populateSourceDb(sourceDb: IModelDb): void {
  // Embed font
  if (Platform.platformName.startsWith("win")) {
    sourceDb.embedFont({ id: 1, type: FontType.TrueType, name: "Arial" });
    assert.exists(sourceDb.fontMap.getFont("Arial"));
    assert.exists(sourceDb.fontMap.getFont(1));
  }
  // Initialize project extents
  const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
  sourceDb.updateProjectExtents(projectExtents);
  // Insert CodeSpecs
  const codeSpecId1: Id64String = sourceDb.codeSpecs.insert("SourceCodeSpec", CodeScopeSpec.Type.Model);
  const codeSpecId2: Id64String = sourceDb.codeSpecs.insert("ExtraCodeSpec", CodeScopeSpec.Type.ParentElement);
  assert.isTrue(Id64.isValidId64(codeSpecId1));
  assert.isTrue(Id64.isValidId64(codeSpecId2));
  // Insert RepositoryModel structure
  const subjectId = Subject.insert(sourceDb, IModel.rootSubjectId, "Subject", "Subject description");
  assert.isTrue(Id64.isValidId64(subjectId));
  const sourceOnlySubjectId = Subject.insert(sourceDb, IModel.rootSubjectId, "Only in Source");
  assert.isTrue(Id64.isValidId64(sourceOnlySubjectId));
  const definitionModelId = DefinitionModel.insert(sourceDb, subjectId, "Definition");
  assert.isTrue(Id64.isValidId64(definitionModelId));
  const informationModelId = InformationRecordModel.insert(sourceDb, subjectId, "Information");
  assert.isTrue(Id64.isValidId64(informationModelId));
  const groupModelId = GroupModel.insert(sourceDb, subjectId, "Group");
  assert.isTrue(Id64.isValidId64(groupModelId));
  const physicalModelId = PhysicalModel.insert(sourceDb, subjectId, "Physical");
  assert.isTrue(Id64.isValidId64(physicalModelId));
  const functionalModelId = FunctionalModel.insert(sourceDb, subjectId, "Functional");
  assert.isTrue(Id64.isValidId64(functionalModelId));
  const documentListModelId = DocumentListModel.insert(sourceDb, subjectId, "Document");
  assert.isTrue(Id64.isValidId64(documentListModelId));
  const drawingId = Drawing.insert(sourceDb, documentListModelId, "Drawing");
  assert.isTrue(Id64.isValidId64(drawingId));
  // Insert DefinitionElements
  const modelSelectorId = ModelSelector.insert(sourceDb, definitionModelId, "PhysicalModels", [physicalModelId]);
  assert.isTrue(Id64.isValidId64(modelSelectorId));
  const spatialCategoryId = insertSpatialCategory(sourceDb, definitionModelId, "SpatialCategory", ColorDef.green);
  assert.isTrue(Id64.isValidId64(spatialCategoryId));
  const sourcePhysicalCategoryId = insertSpatialCategory(sourceDb, definitionModelId, "SourcePhysicalCategory", ColorDef.blue);
  assert.isTrue(Id64.isValidId64(sourcePhysicalCategoryId));
  const subCategoryId = SubCategory.insert(sourceDb, spatialCategoryId, "SubCategory", { color: ColorDef.blue });
  assert.isTrue(Id64.isValidId64(subCategoryId));
  const drawingCategoryId = DrawingCategory.insert(sourceDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
  assert.isTrue(Id64.isValidId64(drawingCategoryId));
  const spatialCategorySelectorId = CategorySelector.insert(sourceDb, definitionModelId, "SpatialCategories", [spatialCategoryId, sourcePhysicalCategoryId]);
  assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
  const drawingCategorySelectorId = CategorySelector.insert(sourceDb, definitionModelId, "DrawingCategories", [drawingCategoryId]);
  assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
  const displayStyle2dId = DisplayStyle2d.insert(sourceDb, definitionModelId, "DisplayStyle2d");
  assert.isTrue(Id64.isValidId64(displayStyle2dId));
  const displayStyle3dId = DisplayStyle3d.insert(sourceDb, definitionModelId, "DisplayStyle3d");
  assert.isTrue(Id64.isValidId64(displayStyle3dId));
  const auxCoordSystemProps: AuxCoordSystem2dProps = {
    classFullName: AuxCoordSystem2d.classFullName,
    model: definitionModelId,
    code: AuxCoordSystem2d.createCode(sourceDb, definitionModelId, "AuxCoordSystem2d"),
  };
  const auxCoordSystemId = sourceDb.elements.insertElement(auxCoordSystemProps);
  assert.isTrue(Id64.isValidId64(auxCoordSystemId));
  // Insert PhysicalElements
  const physicalObjectProps1: GeometricElement3dProps = {
    classFullName: PhysicalObject.classFullName,
    model: physicalModelId,
    category: spatialCategoryId,
    code: Code.createEmpty(),
    userLabel: "PhysicalObject1",
    geom: createBox(Point3d.create(1, 1, 1)),
    placement: {
      origin: Point3d.create(1, 1, 1),
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
    },
  };
  const physicalObjectId1: Id64String = sourceDb.elements.insertElement(physicalObjectProps1);
  assert.isTrue(Id64.isValidId64(physicalObjectId1));
  const physicalObjectProps2: GeometricElement3dProps = {
    classFullName: PhysicalObject.classFullName,
    model: physicalModelId,
    category: sourcePhysicalCategoryId,
    code: Code.createEmpty(),
    userLabel: "PhysicalObject2",
    geom: createBox(Point3d.create(2, 2, 2)),
    placement: {
      origin: Point3d.create(2, 2, 2),
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
    },
  };
  const physicalObjectId2: Id64String = sourceDb.elements.insertElement(physicalObjectProps2);
  assert.isTrue(Id64.isValidId64(physicalObjectId2));
  const physicalObjectProps3: GeometricElement3dProps = {
    classFullName: PhysicalObject.classFullName,
    model: physicalModelId,
    category: sourcePhysicalCategoryId,
    code: Code.createEmpty(),
    userLabel: "PhysicalObject3",
  };
  const physicalObjectId3: Id64String = sourceDb.elements.insertElement(physicalObjectProps3);
  assert.isTrue(Id64.isValidId64(physicalObjectId3));
  const sourcePhysicalElementProps: GeometricElement3dProps = {
    classFullName: "TestTransformerSource:SourcePhysicalElement",
    model: physicalModelId,
    category: sourcePhysicalCategoryId,
    code: Code.createEmpty(),
    userLabel: "PhysicalElement1",
    geom: createBox(Point3d.create(2, 2, 2)),
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
  const sourcePhysicalElementId: Id64String = sourceDb.elements.insertElement(sourcePhysicalElementProps);
  assert.isTrue(Id64.isValidId64(sourcePhysicalElementId));
  // Insert ElementAspects
  sourceDb.elements.insertAspect({
    classFullName: "TestTransformerSource:SourceUniqueAspect",
    element: new ElementOwnsUniqueAspect(physicalObjectId1),
    commonDouble: 1.1,
    commonString: "Unique",
    commonLong: physicalObjectId1,
    sourceDouble: 11.1,
    sourceString: "UniqueAspect",
    sourceLong: physicalObjectId1,
    sourceGuid: Guid.createValue(),
    extraString: "Extra",
  });
  sourceDb.elements.insertAspect({
    classFullName: "TestTransformerSource:SourceMultiAspect",
    element: new ElementOwnsMultiAspects(physicalObjectId1),
    commonDouble: 2.2,
    commonString: "Multi",
    commonLong: physicalObjectId1,
    sourceDouble: 22.2,
    sourceString: "MultiAspect",
    sourceLong: physicalObjectId1,
    sourceGuid: Guid.createValue(),
    extraString: "Extra",
  });
  sourceDb.elements.insertAspect({
    classFullName: "TestTransformerSource:SourceMultiAspect",
    element: new ElementOwnsMultiAspects(physicalObjectId1),
    commonDouble: 3.3,
    commonString: "Multi",
    commonLong: physicalObjectId1,
    sourceDouble: 33.3,
    sourceString: "MultiAspect",
    sourceLong: physicalObjectId1,
    sourceGuid: Guid.createValue(),
    extraString: "Extra",
  });
  sourceDb.elements.insertAspect({
    classFullName: "TestTransformerSource:SourceUniqueAspectToExclude",
    element: new ElementOwnsUniqueAspect(physicalObjectId1),
    description: "SourceUniqueAspect1",
  });
  sourceDb.elements.insertAspect({
    classFullName: "TestTransformerSource:SourceMultiAspectToExclude",
    element: new ElementOwnsMultiAspects(physicalObjectId1),
    description: "SourceMultiAspect1",
  });
  // Insert DrawingGraphics
  const drawingGraphicProps: GeometricElement2dProps = {
    classFullName: DrawingGraphic.classFullName,
    model: drawingId,
    category: drawingCategoryId,
    code: Code.createEmpty(),
    userLabel: "DrawingGraphic",
    geom: createRectangle(Point2d.create(1, 1)),
    placement: {
      origin: Point2d.create(2, 2),
      angle: 0,
    },
  };
  const drawingGraphicId = sourceDb.elements.insertElement(drawingGraphicProps);
  assert.isTrue(Id64.isValidId64(drawingGraphicId));
  const drawingGraphicRepresentsId = DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId, physicalObjectId1);
  assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId));
  // Insert ViewDefinitions
  const viewId = OrthographicViewDefinition.insert(sourceDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, projectExtents, StandardViewIndex.Iso);
  assert.isTrue(Id64.isValidId64(viewId));
  sourceDb.views.setDefaultViewId(viewId);
  const drawingViewRange = new Range2d(0, 0, 100, 100);
  const drawingViewId = DrawingViewDefinition.insert(sourceDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
  assert.isTrue(Id64.isValidId64(drawingViewId));
  // Insert instance of SourceRelToExclude to test relationship exclusion by class
  const relationship1: Relationship = sourceDb.relationships.createInstance({
    classFullName: "TestTransformerSource:SourceRelToExclude",
    sourceId: spatialCategorySelectorId,
    targetId: drawingCategorySelectorId,
  });
  const relationshipId1: Id64String = sourceDb.relationships.insertInstance(relationship1);
  assert.isTrue(Id64.isValidId64(relationshipId1));
  // Insert instance of RelWithProps to test relationship property remapping
  const relationship2: Relationship = sourceDb.relationships.createInstance({
    classFullName: "TestTransformerSource:SourceRelWithProps",
    sourceId: spatialCategorySelectorId,
    targetId: drawingCategorySelectorId,
    sourceString: "One",
    sourceDouble: 1.1,
    sourceLong: spatialCategoryId,
    sourceGuid: Guid.createValue(),
  });
  const relationshipId2: Id64String = sourceDb.relationships.insertInstance(relationship2);
  assert.isTrue(Id64.isValidId64(relationshipId2));
}

export function updateSourceDb(sourceDb: IModelDb): void {
  // Update Subject element
  const subjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
  assert.isTrue(Id64.isValidId64(subjectId));
  const subject: Subject = sourceDb.elements.getElement<Subject>(subjectId);
  subject.description = "Subject description (Updated)";
  sourceDb.elements.updateElement(subject);
  // Update spatialCategory element
  const definitionModelId = sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(sourceDb, subjectId, "Definition"))!;
  assert.isTrue(Id64.isValidId64(definitionModelId));
  const spatialCategoryId = sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, definitionModelId, "SpatialCategory"))!;
  assert.isTrue(Id64.isValidId64(spatialCategoryId));
  const spatialCategory: SpatialCategory = sourceDb.elements.getElement<SpatialCategory>(spatialCategoryId);
  spatialCategory.federationGuid = Guid.createValue();
  sourceDb.elements.updateElement(spatialCategory);
  // Update relationship properties
  const spatialCategorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, definitionModelId, "SpatialCategories"))!;
  assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
  const drawingCategorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, definitionModelId, "DrawingCategories"))!;
  assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
  const relWithProps: RelationshipProps = sourceDb.relationships.getInstanceProps(
    "TestTransformerSource:SourceRelWithProps",
    { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
  );
  assert.equal(relWithProps.sourceString, "One");
  assert.equal(relWithProps.sourceDouble, 1.1);
  relWithProps.sourceString += "-Updated";
  relWithProps.sourceDouble = 1.2;
  sourceDb.relationships.updateInstance(relWithProps);
  // Update ElementAspect properties
  const physicalObjectId1: Id64String = queryByUserLabel(sourceDb, "PhysicalObject1");
  const sourceUniqueAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "TestTransformerSource:SourceUniqueAspect");
  assert.equal(sourceUniqueAspects.length, 1);
  sourceUniqueAspects[0].asAny.commonString += "-Updated";
  sourceUniqueAspects[0].asAny.sourceString += "-Updated";
  sourceDb.elements.updateAspect(sourceUniqueAspects[0]);
  const sourceMultiAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "TestTransformerSource:SourceMultiAspect");
  assert.equal(sourceMultiAspects.length, 2);
  sourceMultiAspects[1].asAny.commonString += "-Updated";
  sourceMultiAspects[1].asAny.sourceString += "-Updated";
  sourceDb.elements.updateAspect(sourceMultiAspects[1]);
  // delete PhysicalObject3
  const physicalObjectId3: Id64String = queryByUserLabel(sourceDb, "PhysicalObject3");
  assert.isTrue(Id64.isValidId64(physicalObjectId3));
  sourceDb.elements.deleteElement(physicalObjectId3);
  assert.equal(Id64.invalid, queryByUserLabel(sourceDb, "PhysicalObject3"));
}

export async function prepareTargetDb(targetDb: IModelDb): Promise<void> {
  // Import desired target schemas
  const requestContext = new BackendRequestContext();
  const targetSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerTarget.ecschema.xml");
  await targetDb.importSchemas(requestContext, [targetSchemaFileName]);
  // Insert a target-only CodeSpec to test remapping
  const targetCodeSpecId: Id64String = targetDb.codeSpecs.insert("TargetCodeSpec", CodeScopeSpec.Type.Model);
  assert.isTrue(Id64.isValidId64(targetCodeSpecId));
  // Insert some elements to avoid getting same IDs for sourceDb and targetDb
  const subjectId = Subject.insert(targetDb, IModel.rootSubjectId, "Only in Target");
  Subject.insert(targetDb, subjectId, "S1");
  Subject.insert(targetDb, subjectId, "S2");
  Subject.insert(targetDb, subjectId, "S3");
  Subject.insert(targetDb, subjectId, "S4");
  const targetPhysicalCategoryId = insertSpatialCategory(targetDb, IModel.dictionaryId, "TargetPhysicalCategory", ColorDef.red);
  assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
}

export function assertTargetDbContents(sourceDb: IModelDb, targetDb: IModelDb): void {
  // CodeSpec
  assert.isTrue(targetDb.codeSpecs.hasName("TargetCodeSpec"));
  assert.isFalse(targetDb.codeSpecs.hasName("SourceCodeSpec"));
  assert.isFalse(targetDb.codeSpecs.hasName("ExtraCodeSpec"));
  // Font
  if (Platform.platformName.startsWith("win")) {
    assert.exists(targetDb.fontMap.getFont("Arial"));
  }
  // Subject
  const subjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Subject"))!;
  assert.isTrue(Id64.isValidId64(subjectId));
  const subjectProps: SubjectProps = targetDb.elements.getElementProps(subjectId) as SubjectProps;
  assert.equal(subjectProps.description, "Subject description"); // description is an auto-handled property
  const sourceOnlySubjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Only in Source"));
  assert.equal(undefined, sourceOnlySubjectId);
  const targetOnlySubjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Only in Target"))!;
  assert.isTrue(Id64.isValidId64(targetOnlySubjectId));
  // Partitions / Models
  const definitionModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Definition"))!;
  const informationModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Information"))!;
  const groupModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Group"))!;
  const physicalModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Physical"))!;
  const documentListModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Document"))!;
  assertTargetElement(sourceDb, targetDb, definitionModelId);
  assertTargetElement(sourceDb, targetDb, informationModelId);
  assertTargetElement(sourceDb, targetDb, groupModelId);
  assertTargetElement(sourceDb, targetDb, physicalModelId);
  assertTargetElement(sourceDb, targetDb, documentListModelId);
  // SpatialCategory
  const spatialCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, definitionModelId, "SpatialCategory"))!;
  assertTargetElement(sourceDb, targetDb, spatialCategoryId);
  const spatialCategoryProps = targetDb.elements.getElementProps(spatialCategoryId);
  assert.equal(definitionModelId, spatialCategoryProps.model);
  assert.equal(definitionModelId, spatialCategoryProps.code.scope);
  assert.equal(undefined, targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, definitionModelId, "SourcePhysicalCategory")), "Should have been remapped");
  const targetPhysicalCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
  assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
  // SubCategory
  const subCategoryId = targetDb.elements.queryElementIdByCode(SubCategory.createCode(targetDb, spatialCategoryId, "SubCategory"))!;
  assertTargetElement(sourceDb, targetDb, subCategoryId);
  // DrawingCategory
  const drawingCategoryId = targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(targetDb, definitionModelId, "DrawingCategory"))!;
  assertTargetElement(sourceDb, targetDb, drawingCategoryId);
  const drawingCategoryProps = targetDb.elements.getElementProps(drawingCategoryId);
  assert.equal(definitionModelId, drawingCategoryProps.model);
  assert.equal(definitionModelId, drawingCategoryProps.code.scope);
  // Spatial CategorySelector
  const spatialCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "SpatialCategories"))!;
  assertTargetElement(sourceDb, targetDb, spatialCategorySelectorId);
  const spatialCategorySelectorProps = targetDb.elements.getElementProps<CategorySelectorProps>(spatialCategorySelectorId);
  assert.isTrue(spatialCategorySelectorProps.categories.includes(spatialCategoryId));
  assert.isTrue(spatialCategorySelectorProps.categories.includes(targetPhysicalCategoryId), "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
  // Drawing CategorySelector
  const drawingCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "DrawingCategories"))!;
  assertTargetElement(sourceDb, targetDb, drawingCategorySelectorId);
  const drawingCategorySelectorProps = targetDb.elements.getElementProps<CategorySelectorProps>(drawingCategorySelectorId);
  assert.isTrue(drawingCategorySelectorProps.categories.includes(drawingCategoryId));
  // ModelSelector
  const modelSelectorId = targetDb.elements.queryElementIdByCode(ModelSelector.createCode(targetDb, definitionModelId, "PhysicalModels"))!;
  assertTargetElement(sourceDb, targetDb, modelSelectorId);
  const modelSelectorProps = targetDb.elements.getElementProps<ModelSelectorProps>(modelSelectorId);
  assert.isTrue(modelSelectorProps.models.includes(physicalModelId));
  // DisplayStyle
  const displayStyle3dId = targetDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(targetDb, definitionModelId, "DisplayStyle3d"))!;
  assertTargetElement(sourceDb, targetDb, displayStyle3dId);
  // ViewDefinition
  const viewId = targetDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(targetDb, definitionModelId, "Orthographic View"))!;
  assertTargetElement(sourceDb, targetDb, viewId);
  const viewProps = targetDb.elements.getElementProps<SpatialViewDefinitionProps>(viewId);
  assert.equal(viewProps.displayStyleId, displayStyle3dId);
  assert.equal(viewProps.categorySelectorId, spatialCategorySelectorId);
  assert.equal(viewProps.modelSelectorId, modelSelectorId);
  // AuxCoordSystem2d
  assert.equal(undefined, targetDb.elements.queryElementIdByCode(AuxCoordSystem2d.createCode(targetDb, definitionModelId, "AuxCoordSystem2d")), "Should have been excluded by class");
  // PhysicalElement
  const physicalObjectId1: Id64String = queryByUserLabel(targetDb, "PhysicalObject1");
  const physicalObjectId2: Id64String = queryByUserLabel(targetDb, "PhysicalObject2");
  const physicalObjectId3: Id64String = queryByUserLabel(targetDb, "PhysicalObject3");
  const physicalElementId1: Id64String = queryByUserLabel(targetDb, "PhysicalElement1");
  assertTargetElement(sourceDb, targetDb, physicalObjectId1);
  assertTargetElement(sourceDb, targetDb, physicalObjectId2);
  assertTargetElement(sourceDb, targetDb, physicalObjectId3);
  assertTargetElement(sourceDb, targetDb, physicalElementId1);
  const physicalObject1: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(physicalObjectId1);
  const physicalObject2: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(physicalObjectId2);
  const physicalElement1: PhysicalElement = targetDb.elements.getElement<PhysicalElement>(physicalElementId1);
  assert.equal(physicalObject1.category, spatialCategoryId, "SpatialCategory should have been imported");
  assert.equal(physicalObject2.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
  assert.equal(physicalElement1.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
  assert.equal(physicalElement1.classFullName, "TestTransformerTarget:TargetPhysicalElement", "Class should have been remapped");
  assert.equal(physicalElement1.asAny.targetString, "S1", "Property should have been remapped by transformElement override");
  assert.equal(physicalElement1.asAny.targetDouble, 1.1, "Property should have been remapped by transformElement override");
  assert.equal(physicalElement1.asAny.commonString, "Common", "Property should have been automatically remapped (same name)");
  assert.equal(physicalElement1.asAny.commonDouble, 7.3, "Property should have been automatically remapped (same name)");
  assert.notExists(physicalElement1.asAny.extraString, "Property should have been dropped during transformation");
  // ElementUniqueAspects
  const targetUniqueAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetUniqueAspect");
  assert.equal(targetUniqueAspects.length, 1);
  assert.equal(targetUniqueAspects[0].asAny.commonDouble, 1.1);
  assert.equal(targetUniqueAspects[0].asAny.commonString, "Unique");
  assert.equal(targetUniqueAspects[0].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
  assert.equal(targetUniqueAspects[0].asAny.targetDouble, 11.1);
  assert.equal(targetUniqueAspects[0].asAny.targetString, "UniqueAspect");
  assert.equal(targetUniqueAspects[0].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
  // assert.isTrue(Guid.isV4Guid(targetUniqueAspects[0].targetGuid)); // WIP: bug with ElementAspects and Guid?
  // ElementTargetAspects
  const targetMultiAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetMultiAspect");
  assert.equal(targetMultiAspects.length, 2);
  assert.equal(targetMultiAspects[0].asAny.commonDouble, 2.2);
  assert.equal(targetMultiAspects[0].asAny.commonString, "Multi");
  assert.equal(targetMultiAspects[0].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
  assert.equal(targetMultiAspects[0].asAny.targetDouble, 22.2);
  assert.equal(targetMultiAspects[0].asAny.targetString, "MultiAspect");
  assert.equal(targetMultiAspects[0].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
  // assert.isTrue(Guid.isV4Guid(targetMultiAspects[0].targetGuid)); // WIP: bug with ElementAspects and Guid?
  assert.equal(targetMultiAspects[1].asAny.commonDouble, 3.3);
  assert.equal(targetMultiAspects[1].asAny.commonString, "Multi");
  assert.equal(targetMultiAspects[1].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
  assert.equal(targetMultiAspects[1].asAny.targetDouble, 33.3);
  assert.equal(targetMultiAspects[1].asAny.targetString, "MultiAspect");
  assert.equal(targetMultiAspects[1].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
  // assert.isTrue(Guid.isV4Guid(targetMultiAspects[1].targetGuid)); // WIP: bug with ElementAspects and Guid?
  // DrawingGraphic
  const drawingGraphicId: Id64String = queryByUserLabel(targetDb, "DrawingGraphic");
  assertTargetElement(sourceDb, targetDb, drawingGraphicId);
  // DrawingGraphicRepresentsElement
  assert.exists(targetDb.relationships.getInstanceProps(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId, targetId: physicalObjectId1 }));
  // TargetRelWithProps
  const relWithProps: RelationshipProps = targetDb.relationships.getInstanceProps(
    "TestTransformerTarget:TargetRelWithProps",
    { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
  );
  assert.equal(relWithProps.targetString, "One");
  assert.equal(relWithProps.targetDouble, 1.1);
  assert.equal(relWithProps.targetLong, spatialCategoryId);
  assert.isTrue(Guid.isV4Guid(relWithProps.targetGuid));
}

export function assertUpdatesInTargetDb(targetDb: IModelDb): void {
  // assert Subject was updated
  const subjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Subject"))!;
  assert.isTrue(Id64.isValidId64(subjectId));
  const subject: Subject = targetDb.elements.getElement<Subject>(subjectId);
  assert.equal(subject.description, "Subject description (Updated)");
  // assert SpatialCategory was updated
  const definitionModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Definition"))!;
  assert.isTrue(Id64.isValidId64(definitionModelId));
  const spatialCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, definitionModelId, "SpatialCategory"))!;
  assert.isTrue(Id64.isValidId64(spatialCategoryId));
  const spatialCategory: SpatialCategory = targetDb.elements.getElement<SpatialCategory>(spatialCategoryId);
  assert.exists(spatialCategory.federationGuid);
  // assert TargetRelWithProps was updated
  const spatialCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "SpatialCategories"))!;
  assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
  const drawingCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "DrawingCategories"))!;
  assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
  const relWithProps: RelationshipProps = targetDb.relationships.getInstanceProps(
    "TestTransformerTarget:TargetRelWithProps",
    { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
  );
  assert.equal(relWithProps.targetString, "One-Updated");
  assert.equal(relWithProps.targetDouble, 1.2);
  // assert ElementAspect properties
  const physicalObjectId1: Id64String = queryByUserLabel(targetDb, "PhysicalObject1");
  const targetUniqueAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetUniqueAspect");
  assert.equal(targetUniqueAspects.length, 1);
  assert.equal(targetUniqueAspects[0].asAny.commonDouble, 1.1);
  assert.equal(targetUniqueAspects[0].asAny.commonString, "Unique-Updated");
  assert.equal(targetUniqueAspects[0].asAny.commonLong, physicalObjectId1);
  assert.equal(targetUniqueAspects[0].asAny.targetDouble, 11.1);
  assert.equal(targetUniqueAspects[0].asAny.targetString, "UniqueAspect-Updated");
  assert.equal(targetUniqueAspects[0].asAny.targetLong, physicalObjectId1);
  const targetMultiAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetMultiAspect");
  assert.equal(targetMultiAspects.length, 2);
  assert.equal(targetMultiAspects[0].asAny.commonDouble, 2.2);
  assert.equal(targetMultiAspects[0].asAny.commonString, "Multi");
  assert.equal(targetMultiAspects[0].asAny.commonLong, physicalObjectId1);
  assert.equal(targetMultiAspects[0].asAny.targetDouble, 22.2);
  assert.equal(targetMultiAspects[0].asAny.targetString, "MultiAspect");
  assert.equal(targetMultiAspects[0].asAny.targetLong, physicalObjectId1);
  assert.equal(targetMultiAspects[1].asAny.commonDouble, 3.3);
  assert.equal(targetMultiAspects[1].asAny.commonString, "Multi-Updated");
  assert.equal(targetMultiAspects[1].asAny.commonLong, physicalObjectId1);
  assert.equal(targetMultiAspects[1].asAny.targetDouble, 33.3);
  assert.equal(targetMultiAspects[1].asAny.targetString, "MultiAspect-Updated");
  assert.equal(targetMultiAspects[1].asAny.targetLong, physicalObjectId1);
  // assert PhysicalObject3 was deleted
  assert.equal(Id64.invalid, queryByUserLabel(targetDb, "PhysicalObject3"));
}

function assertTargetElement(sourceDb: IModelDb, targetDb: IModelDb, targetElementId: Id64String): void {
  assert.isTrue(Id64.isValidId64(targetElementId));
  const element: Element = targetDb.elements.getElement(targetElementId);
  assert.isTrue(element.federationGuid && Guid.isV4Guid(element.federationGuid));
  const aspect: ExternalSourceAspect = targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName)[0] as ExternalSourceAspect;
  assert.exists(aspect);
  assert.equal(aspect.kind, ExternalSourceAspect.Kind.Element);
  assert.equal(aspect.scope.id, IModel.rootSubjectId);
  assert.isUndefined(aspect.checksum);
  assert.isTrue(Id64.isValidId64(aspect.identifier));
  const sourceLastMod: string = sourceDb.elements.queryLastModifiedTime(aspect.identifier);
  assert.equal(aspect.version, sourceLastMod);
  const sourceElement: Element = sourceDb.elements.getElement(aspect.identifier);
  assert.exists(sourceElement);
}

export function createTeamIModel(teamName: string, teamOrigin: Point3d, teamColor: ColorDef): IModelDb {
  const teamFile: string = path.join(KnownTestLocations.outputDir, `Team${teamName}.bim`);
  if (IModelJsFs.existsSync(teamFile)) {
    IModelJsFs.removeSync(teamFile);
  }
  const iModelDb: IModelDb = IModelDb.createSnapshot(teamFile, { rootSubject: { name: teamName } });
  assert.exists(iModelDb);
  populateTeamIModel(iModelDb, teamName, teamOrigin, teamColor);
  iModelDb.saveChanges();
  return iModelDb;
}

export function populateTeamIModel(teamDb: IModelDb, teamName: string, teamOrigin: Point3d, teamColor: ColorDef): void {
  const contextSubjectId: Id64String = Subject.insert(teamDb, IModel.rootSubjectId, "Context");
  assert.isTrue(Id64.isValidId64(contextSubjectId));
  const definitionModelId = DefinitionModel.insert(teamDb, IModel.rootSubjectId, `Definition${teamName}`);
  assert.isTrue(Id64.isValidId64(definitionModelId));
  const spatialCategoryId = insertSpatialCategory(teamDb, definitionModelId, `SpatialCategory${teamName}`, teamColor);
  assert.isTrue(Id64.isValidId64(spatialCategoryId));
  const physicalModelId = PhysicalModel.insert(teamDb, IModel.rootSubjectId, `Physical${teamName}`);
  assert.isTrue(Id64.isValidId64(physicalModelId));
  const physicalObjectProps1: GeometricElement3dProps = {
    classFullName: PhysicalObject.classFullName,
    model: physicalModelId,
    category: spatialCategoryId,
    code: Code.createEmpty(),
    userLabel: `PhysicalObject${teamName}1`,
    geom: createBox(Point3d.create(1, 1, 1)),
    placement: {
      origin: teamOrigin,
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
    },
  };
  const physicalObjectId1: Id64String = teamDb.elements.insertElement(physicalObjectProps1);
  assert.isTrue(Id64.isValidId64(physicalObjectId1));
}

export function createSharedIModel(teamNames: string[]): IModelDb {
  const iModelName: string = `Shared${teamNames.join("")}`;
  const iModelFile: string = path.join(KnownTestLocations.outputDir, `${iModelName}.bim`);
  if (IModelJsFs.existsSync(iModelFile)) {
    IModelJsFs.removeSync(iModelFile);
  }
  const iModelDb: IModelDb = IModelDb.createSnapshot(iModelFile, { rootSubject: { name: iModelName } });
  assert.exists(iModelDb);
  teamNames.forEach((teamName: string) => {
    const subjectId: Id64String = Subject.insert(iModelDb, IModel.rootSubjectId, teamName);
    assert.isTrue(Id64.isValidId64(subjectId));
  });
  return iModelDb;
}

export function assertTeamIModelContents(iModelDb: IModelDb, teamName: string): void {
  const definitionPartitionId: Id64String = getTeamDefinitionPartitionId(iModelDb, IModel.rootSubjectId, teamName);
  const spatialCategoryId = getTeamSpatialCategoryId(iModelDb, definitionPartitionId, teamName);
  const physicalPartitionId: Id64String = getTeamPhysicalPartitionId(iModelDb, IModel.rootSubjectId, teamName);
  getTeamPhysicalElementId(iModelDb, physicalPartitionId, spatialCategoryId, teamName, "1");
}

export function assertSharedIModelContents(iModelDb: IModelDb, teamNames: string[]): void {
  teamNames.forEach((teamName: string) => {
    const subjectId: Id64String = getTeamSubjectId(iModelDb, teamName);
    const definitionPartitionId: Id64String = getTeamDefinitionPartitionId(iModelDb, subjectId, teamName);
    const spatialCategoryId = getTeamSpatialCategoryId(iModelDb, definitionPartitionId, teamName);
    const physicalPartitionId: Id64String = getTeamPhysicalPartitionId(iModelDb, subjectId, teamName);
    getTeamPhysicalElementId(iModelDb, physicalPartitionId, spatialCategoryId, teamName, "1");
  });
}

export function getTeamSubjectId(iModelDb: IModelDb, teamName: string): Id64String {
  const subjectId: Id64String = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, teamName))!;
  assert.isTrue(Id64.isValidId64(subjectId));
  return subjectId;
}

function getTeamDefinitionPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, teamName: string): Id64String {
  const partitionCode: Code = DefinitionPartition.createCode(iModelDb, parentSubjectId, `Definition${teamName}`);
  const partitionId: Id64String = iModelDb.elements.queryElementIdByCode(partitionCode)!;
  assert.isTrue(Id64.isValidId64(partitionId));
  return partitionId;
}

function getTeamSpatialCategoryId(iModelDb: IModelDb, modelId: Id64String, teamName: string): Id64String {
  const categoryCode: Code = SpatialCategory.createCode(iModelDb, modelId, `SpatialCategory${teamName}`);
  const categoryId: Id64String = iModelDb.elements.queryElementIdByCode(categoryCode)!;
  assert.isTrue(Id64.isValidId64(categoryId));
  return categoryId;
}

function getTeamPhysicalPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, teamName: string): Id64String {
  const partitionCode: Code = PhysicalPartition.createCode(iModelDb, parentSubjectId, `Physical${teamName}`);
  const partitionId: Id64String = iModelDb.elements.queryElementIdByCode(partitionCode)!;
  assert.isTrue(Id64.isValidId64(partitionId));
  return partitionId;
}

function getTeamPhysicalElementId(iModelDb: IModelDb, modelId: Id64String, categoryId: Id64String, teamName: string, suffix: string): Id64String {
  const elementId: Id64String = queryByUserLabel(iModelDb, `PhysicalObject${teamName}${suffix}`);
  assert.isTrue(Id64.isValidId64(elementId));
  const element: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(elementId);
  assert.equal(element.model, modelId);
  assert.equal(element.category, categoryId);
  return elementId;
}

function insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
  const appearance: SubCategoryAppearance.Props = {
    color,
    transp: 0,
    invisible: false,
  };
  return SpatialCategory.insert(iModelDb, modelId, categoryName, appearance);
}

function createBox(size: Point3d): GeometryStreamProps {
  const geometryStreamBuilder = new GeometryStreamBuilder();
  geometryStreamBuilder.appendGeometry(Box.createDgnBox(
    Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
    size.x, size.y, size.x, size.y, true,
  )!);
  return geometryStreamBuilder.geometryStream;
}

function createRectangle(size: Point2d): GeometryStreamProps {
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

function queryByUserLabel(iModelDb: IModelDb, userLabel: string): Id64String {
  return iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE UserLabel=?`, (statement: ECSqlStatement): Id64String => {
    statement.bindString(1, userLabel);
    return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
  });
}

/** Specialization of IModelTransformer for testing */
export class TestIModelTransformer extends IModelTransformer {
  public numInsertElementCalls = 0;
  public numInsertElementProvenanceCalls = 0;
  public numUpdateElementCalls = 0;
  public numUpdateElementProvenanceCalls = 0;
  public numExcludedElementCalls = 0;

  public numModelsInserted = 0;
  public numModelsUpdated = 0;
  public numElementsInserted = 0;
  public numElementsUpdated = 0;
  public numElementsDeleted = 0;
  public numElementsExcluded = 0;

  public numRelationshipsExcluded = 0;
  public numCodeSpecsExcluded = 0;
  public numElementAspectsExcluded = 0;

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
    super.excludeRelationshipClass("TestTransformerSource:SourceRelToExclude");
    super.excludeElementAspectClass("TestTransformerSource:SourceUniqueAspectToExclude");
    super.excludeElementAspectClass("TestTransformerSource:SourceMultiAspectToExclude");
  }

  /** Initialize some CodeSpec remapping rules for testing */
  private initCodeSpecRemapping(): void {
    super.remapCodeSpec("SourceCodeSpec", "TargetCodeSpec");
  }

  /** Initialize some category remapping rules for testing */
  private initCategoryRemapping(): void {
    const subjectId = this._sourceDb.elements.queryElementIdByCode(Subject.createCode(this._sourceDb, IModel.rootSubjectId, "Subject"))!;
    const definitionModelId = this._sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this._sourceDb, subjectId, "Definition"))!;
    const sourceCategoryId = this._sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(this._sourceDb, definitionModelId, "SourcePhysicalCategory"))!;
    const targetCategoryId = this._targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this._targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
    assert.isTrue(Id64.isValidId64(subjectId) && Id64.isValidId64(definitionModelId) && Id64.isValidId64(sourceCategoryId) && Id64.isValidId64(targetCategoryId));
    super.remapElement(sourceCategoryId, targetCategoryId);
    super.excludeElement(sourceCategoryId); // Don't process a specifically remapped element
  }

  /** Initialize some class remapping rules for testing */
  private initClassRemapping(): void {
    super.remapElementClass("TestTransformerSource:SourcePhysicalElement", "TestTransformerTarget:TargetPhysicalElement");
  }

  /** Override insertElement to count calls */
  protected insertElement(targetElementProps: ElementProps): Id64String {
    this.numInsertElementCalls++;
    return super.insertElement(targetElementProps);
  }

  /** Override insertElementProvenance to count calls */
  protected insertElementProvenance(sourceElement: Element, targetElementId: Id64String): void {
    this.numInsertElementProvenanceCalls++;
    return super.insertElementProvenance(sourceElement, targetElementId);
  }

  /** Override updateElement to count calls */
  protected updateElement(targetElementProps: ElementProps): void {
    this.numUpdateElementCalls++;
    super.updateElement(targetElementProps);
  }

  /** Override insertElementProvenance to count calls */
  protected updateElementProvenance(sourceElement: Element, targetElementId: Id64String): void {
    this.numUpdateElementProvenanceCalls++;
    return super.updateElementProvenance(sourceElement, targetElementId);
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

  /** Count the number of Relationships excluded in this callback */
  protected onRelationshipExcluded(sourceRelationship: Relationship): void {
    this.numRelationshipsExcluded++;
    super.onRelationshipExcluded(sourceRelationship);
  }

  /** Count the number of ElementAspects excluded in this callback */
  protected onElementAspectExcluded(sourceElementAspect: ElementAspect): void {
    this.numElementAspectsExcluded++;
    super.onElementAspectExcluded(sourceElementAspect);
  }

  /** Count the number of Elements inserted in this callback */
  protected onElementInserted(sourceElement: Element, targetElementProps: ElementProps): void {
    this.numElementsInserted++;
    assert.isTrue(Id64.isValidId64(targetElementProps.id!));
    super.onElementInserted(sourceElement, targetElementProps);
  }

  /** Count the number of Elements updated in this callback */
  protected onElementUpdated(sourceElement: Element, targetElementProps: ElementProps): void {
    this.numElementsUpdated++;
    assert.isTrue(Id64.isValidId64(targetElementProps.id!));
    super.onElementUpdated(sourceElement, targetElementProps);
  }

  /** Count the number of Elements deleted in this callback */
  protected onElementDeleted(targetElement: Element): void {
    this.numElementsDeleted++;
    assert.isTrue(Id64.isValidId64(targetElement.id));
    super.onElementDeleted(targetElement);
  }

  /** Count the number of Elements excluded in this callback */
  protected onElementExcluded(sourceElement: Element): void {
    this.numElementsExcluded++;
    super.onElementExcluded(sourceElement);
  }

  /** Count the number of Models inserted in this callback */
  protected onModelInserted(sourceModel: Model, targetModelProps: ModelProps): void {
    this.numModelsInserted++;
    super.onModelInserted(sourceModel, targetModelProps);
  }

  /** Count the number of Models updated in this callback */
  protected onModelUpdated(sourceModel: Model, targetModelProps: ModelProps): void {
    this.numModelsUpdated++;
    super.onModelUpdated(sourceModel, targetModelProps);
  }

  /** Override transformElement to make sure that all target Elements have a FederationGuid */
  protected transformElement(sourceElement: Element): ElementProps {
    const targetElementProps: ElementProps = super.transformElement(sourceElement);
    if (!targetElementProps.federationGuid) {
      targetElementProps.federationGuid = Guid.createValue();
    }
    if ("TestTransformerSource:SourcePhysicalElement" === sourceElement.classFullName) {
      targetElementProps.targetString = sourceElement.asAny.sourceString;
      targetElementProps.targetDouble = sourceElement.asAny.sourceDouble;
    }
    return targetElementProps;
  }

  /** Override transformElementAspect to remap Source*Aspect --> Target*Aspect */
  protected transformElementAspect(sourceElementAspect: ElementAspect, targetElementId: Id64String): ElementAspectProps {
    const targetElementAspectProps: ElementAspectProps = super.transformElementAspect(sourceElementAspect, targetElementId);
    if ("TestTransformerSource:SourceUniqueAspect" === sourceElementAspect.classFullName) {
      targetElementAspectProps.classFullName = "TestTransformerTarget:TargetUniqueAspect";
      targetElementAspectProps.targetDouble = targetElementAspectProps.sourceDouble;
      targetElementAspectProps.sourceDouble = undefined;
      targetElementAspectProps.targetString = targetElementAspectProps.sourceString;
      targetElementAspectProps.sourceString = undefined;
      targetElementAspectProps.targetLong = targetElementAspectProps.sourceLong; // Id64 value was already remapped by super.transformElementAspect()
      targetElementAspectProps.sourceLong = undefined;
      targetElementAspectProps.targetGuid = targetElementAspectProps.sourceGuid;
      targetElementAspectProps.sourceGuid = undefined;
    } else if ("TestTransformerSource:SourceMultiAspect" === sourceElementAspect.classFullName) {
      targetElementAspectProps.classFullName = "TestTransformerTarget:TargetMultiAspect";
      targetElementAspectProps.targetDouble = targetElementAspectProps.sourceDouble;
      targetElementAspectProps.sourceDouble = undefined;
      targetElementAspectProps.targetString = targetElementAspectProps.sourceString;
      targetElementAspectProps.sourceString = undefined;
      targetElementAspectProps.targetLong = targetElementAspectProps.sourceLong; // Id64 value was already remapped by super.transformElementAspect()
      targetElementAspectProps.sourceLong = undefined;
      targetElementAspectProps.targetGuid = targetElementAspectProps.sourceGuid;
      targetElementAspectProps.sourceGuid = undefined;
    }
    return targetElementAspectProps;
  }

  /** Override transformRelationship to remap SourceRelWithProps --> TargetRelWithProps */
  protected transformRelationship(sourceRelationship: Relationship): RelationshipProps {
    const targetRelationshipProps: RelationshipProps = super.transformRelationship(sourceRelationship);
    if ("TestTransformerSource:SourceRelWithProps" === sourceRelationship.classFullName) {
      targetRelationshipProps.classFullName = "TestTransformerTarget:TargetRelWithProps";
      targetRelationshipProps.targetString = targetRelationshipProps.sourceString;
      targetRelationshipProps.sourceString = undefined;
      targetRelationshipProps.targetDouble = targetRelationshipProps.sourceDouble;
      targetRelationshipProps.sourceDouble = undefined;
      targetRelationshipProps.targetLong = targetRelationshipProps.sourceLong; // Id64 value was already remapped by super.transformRelationship()
      targetRelationshipProps.sourceLong = undefined;
      targetRelationshipProps.targetGuid = targetRelationshipProps.sourceGuid;
      targetRelationshipProps.sourceGuid = undefined;
    }
    return targetRelationshipProps;
  }
}
