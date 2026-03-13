/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { Code, CodeScopeSpec, GeometryPartProps, IModel, PhysicalElementProps } from "@itwin/core-common";
import {
  CategorySelector, ChannelControl, DisplayStyle2d, DisplayStyle3d, DrawingCategory, DrawingViewDefinition, GeometryPart, IModelJsFs, InformationPartitionElement,
  ModelSelector, OrthographicViewDefinition, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, Subject, Texture,
} from "../../core-backend";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("DeleteDefinitionElements", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "DeleteDefinitionElements");

  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let subjectId: Id64String;
  let definitionModelId: Id64String;
  let physicalModelId: Id64String;
  let spatialCategoryId: Id64String;
  let subCategoryId: Id64String;
  let spatialCategorySelectorId: Id64String;
  let modelSelectorId: Id64String;
  let displayStyle3dId: Id64String;
  let viewId: Id64String;
  let drawingCategoryId: Id64String;
  let drawingCategorySelectorId: Id64String;
  let displayStyle2dId: Id64String;
  let drawingViewId: Id64String;
  let geometryPartId: Id64String;
  let renderMaterialId: Id64String;
  let textureId: Id64String;
  let physicalObjectId1: Id64String;
  let physicalObjectId2: Id64String;
  let physicalObjectId3: Id64String;

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }

    const seedDbFile = IModelTestUtils.prepareOutputFile("DeleteDefinitionElements", "seed.bim");
    if (IModelJsFs.existsSync(seedDbFile)) {
      IModelJsFs.removeSync(seedDbFile);
    }
    seedDb = SnapshotDb.createEmpty(seedDbFile, { rootSubject: { name: "DeleteDefinitionElements" } });
    await ExtensiveTestScenario.prepareDb(seedDb);
    await ExtensiveTestScenario.populateDb(seedDb);

    // Get ElementIds of DefinitionElements created by populateDb
    subjectId = seedDb.elements.queryElementIdByCode(Subject.createCode(seedDb, IModel.rootSubjectId, "Subject"))!;
    definitionModelId = seedDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(seedDb, subjectId, "Definition"))!;
    physicalModelId = seedDb.elements.queryElementIdByCode(PhysicalPartition.createCode(seedDb, subjectId, "Physical"))!;
    spatialCategoryId = seedDb.elements.queryElementIdByCode(SpatialCategory.createCode(seedDb, definitionModelId, "SpatialCategory"))!;
    subCategoryId = seedDb.elements.queryElementIdByCode(SubCategory.createCode(seedDb, spatialCategoryId, "SubCategory"))!;
    spatialCategorySelectorId = seedDb.elements.queryElementIdByCode(CategorySelector.createCode(seedDb, definitionModelId, "SpatialCategories"))!;
    modelSelectorId = seedDb.elements.queryElementIdByCode(ModelSelector.createCode(seedDb, definitionModelId, "SpatialModels"))!;
    displayStyle3dId = seedDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(seedDb, definitionModelId, "DisplayStyle3d"))!;
    viewId = seedDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(seedDb, definitionModelId, "Orthographic View"))!;
    drawingCategoryId = seedDb.elements.queryElementIdByCode(DrawingCategory.createCode(seedDb, definitionModelId, "DrawingCategory"))!;
    drawingCategorySelectorId = seedDb.elements.queryElementIdByCode(CategorySelector.createCode(seedDb, definitionModelId, "DrawingCategories"))!;
    displayStyle2dId = seedDb.elements.queryElementIdByCode(DisplayStyle2d.createCode(seedDb, definitionModelId, "DisplayStyle2d"))!;
    drawingViewId = seedDb.elements.queryElementIdByCode(DrawingViewDefinition.createCode(seedDb, definitionModelId, "Drawing View"))!;
    geometryPartId = seedDb.elements.queryElementIdByCode(GeometryPart.createCode(seedDb, definitionModelId, "GeometryPart"))!;
    renderMaterialId = seedDb.elements.queryElementIdByCode(RenderMaterialElement.createCode(seedDb, definitionModelId, "RenderMaterial"))!;
    textureId = seedDb.elements.queryElementIdByCode(Texture.createCode(seedDb, definitionModelId, "Texture"))!;
    physicalObjectId1 = IModelTestUtils.queryByUserLabel(seedDb, "PhysicalObject1");
    physicalObjectId2 = IModelTestUtils.queryByUserLabel(seedDb, "PhysicalObject2");
    physicalObjectId3 = IModelTestUtils.queryByUserLabel(seedDb, "PhysicalObject3");

    assert.isTrue(Id64.isValidId64(physicalModelId));
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    assert.isTrue(Id64.isValidId64(subCategoryId));
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    assert.isTrue(Id64.isValidId64(viewId));
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    assert.isTrue(Id64.isValidId64(displayStyle2dId));
    assert.isTrue(Id64.isValidId64(drawingViewId));
    assert.isTrue(Id64.isValidId64(geometryPartId));
    assert.isTrue(Id64.isValidId64(renderMaterialId));
    assert.isTrue(Id64.isValidId64(textureId));
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    assert.isTrue(Id64.isValidId64(physicalObjectId2));
    assert.isTrue(Id64.isValidId64(physicalObjectId3));

    seedDb.saveChanges();
  });

  beforeEach(async () => {
    iModelDb = SnapshotDb.createFrom(seedDb, IModelTestUtils.prepareOutputFile("DeleteDefinitionElements", "DeleteDefinitionElements.bim"));
    assert.isTrue(iModelDb.isOpen);
    iModelDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  afterEach(() => {
    if (iModelDb.isOpen)
      iModelDb.close();
  });

  after(() => {
    if (seedDb.isOpen)
      seedDb.close();
  });

  it("should delete if not used", async () => {
    let usedDefinitionElementIds: Id64Set;

    // make sure deleteDefinitionElements skips Elements that are not DefinitionElements
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
    assert.equal(usedDefinitionElementIds.size ?? 0, 0);
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId1));
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId2));
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId3));
    assert.isDefined(iModelDb.elements.tryGetElement(subjectId));

    // make sure deleteDefinitionElements skips invalid Ids
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([Id64.invalid, Id64.invalid]);
    assert.equal(usedDefinitionElementIds.size ?? 0, 0);

    // delete/deleteDefinitionElements for a used GeometryPart should fail
    assert.throws(() => iModelDb.elements.deleteElement(geometryPartId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([geometryPartId]);
    assert.isTrue(usedDefinitionElementIds.has(geometryPartId));
    assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId));

    // deleteDefinitionElements for an unused GeometryPart should succeed, delete should still fail
    const unusedGeometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(iModelDb, definitionModelId, "Unused GeometryPart"),
      geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
    };
    const unusedGeometryPartId = iModelDb.elements.insertElement(unusedGeometryPartProps);
    assert.isTrue(Id64.isValidId64(unusedGeometryPartId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedGeometryPartId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedGeometryPartId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedGeometryPartId));

    // delete/deleteDefinitionElements for a used RenderMaterial should fail
    assert.throws(() => iModelDb.elements.deleteElement(renderMaterialId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([renderMaterialId]);
    assert.isTrue(usedDefinitionElementIds.has(renderMaterialId));
    assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId));

    // deleteDefinitionElements for an unused RenderMaterial should succeed, delete should still fail
    const unusedRenderMaterialId = RenderMaterialElement.insert(iModelDb, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
    assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedRenderMaterialId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedRenderMaterialId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedRenderMaterialId));

    // delete/deleteDefinitionElements for a used Texture should fail
    assert.throws(() => iModelDb.elements.deleteElement(textureId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([textureId]);
    assert.isTrue(usedDefinitionElementIds.has(textureId));
    assert.isDefined(iModelDb.elements.tryGetElement(textureId));

    // deleteDefinitionElements for an unused Texture should succeed, delete should still fail
    const unusedTextureId = IModelTestUtils.insertTextureElement(iModelDb, definitionModelId, "Unused Texture");
    assert.isTrue(Id64.isValidId64(unusedTextureId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedTextureId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedTextureId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedTextureId));

    // delete/deleteDefinitionElements for a used SpatialCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(spatialCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([spatialCategoryId]);
    assert.isTrue(usedDefinitionElementIds.has(spatialCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

    // delete/deleteDefinitionElements for a default SubCategory should fail
    const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
    const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
    assert.throws(() => iModelDb.elements.deleteElement(defaultSpatialSubCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([defaultSpatialSubCategoryId]);
    assert.isTrue(usedDefinitionElementIds.has(defaultSpatialSubCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

    // delete/deleteDefinitionElements for a used, non-default SubCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(subCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([subCategoryId]);
    assert.isTrue(usedDefinitionElementIds.has(subCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId));

    // deleteDefinitionElements for an unused SubCategory should succeed, delete should still fail
    const unusedSubCategoryId = SubCategory.insert(iModelDb, spatialCategoryId, "Unused SubCategory", {});
    assert.isTrue(Id64.isValidId64(unusedSubCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedSubCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedSubCategoryId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSubCategoryId));

    // deleteDefinitionElements for an unused SpatialCategory should succeed, delete should still fail
    const unusedSpatialCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Unused SpatialCategory", {});
    assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
    const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
    const unusedSpatialCategoryDefaultSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryDefaultSubCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedSpatialCategoryId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryDefaultSubCategoryId));

    // delete/deleteDefinitionElements of a used DrawingCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([drawingCategoryId]);
    assert.isTrue(usedDefinitionElementIds.has(drawingCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

    // deleteDefinitionElements for an unused DrawingCategory should succeed, delete should still fail
    const unusedDrawingCategoryId = DrawingCategory.insert(iModelDb, definitionModelId, "Unused DrawingCategory", {});
    assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
    const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
    const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedDrawingSubCategoryId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([unusedDrawingCategoryId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));

    // delete/deleteDefinitionElements of DefinitionElements used by an existing SpatialViewDefinition should fail
    assert.throws(() => iModelDb.elements.deleteElement(spatialCategorySelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(modelSelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(displayStyle3dId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.isTrue(usedDefinitionElementIds.has(spatialCategorySelectorId));
    assert.isTrue(usedDefinitionElementIds.has(modelSelectorId));
    assert.isTrue(usedDefinitionElementIds.has(displayStyle3dId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));
    assert.isDefined(iModelDb.elements.tryGetElement(viewId));

    // deleteDefinitionElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
    assert.throws(() => iModelDb.elements.deleteElement(viewId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
    assert.isUndefined(iModelDb.elements.tryGetElement(viewId));

    // delete/deleteDefinitionElements of DefinitionElements used by an existing DrawingViewDefinition should fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingCategorySelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(displayStyle2dId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([drawingCategorySelectorId, displayStyle2dId]);
    assert.isTrue(usedDefinitionElementIds.has(drawingCategorySelectorId));
    assert.isTrue(usedDefinitionElementIds.has(displayStyle2dId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(displayStyle2dId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingViewId));

    // deleteDefinitionElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingViewId));
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([drawingViewId, drawingCategorySelectorId, displayStyle2dId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle2dId));
    assert.isUndefined(iModelDb.elements.tryGetElement(drawingViewId));

    iModelDb.saveChanges();
    iModelDb.close();
  });

  describe("purgeDefinitionElements", () => {
    let partCounter = 0;

    beforeEach(() => { partCounter = 0; });

    const insertGeometryPart = (parentId?: Id64String): Id64String => {
      const props: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: definitionModelId,
        code: GeometryPart.createCode(iModelDb, definitionModelId, `TestPart_${++partCounter}`),
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      };
      return iModelDb.elements.insertElement(props);
    };

    /** Assert that the element with the given id still exists. */
    const assertExists = (id: Id64String, msg: string) =>
      assert.isDefined(iModelDb.elements.tryGetElement(id), msg);

    /** Assert that the element with the given id has been deleted. */
    const assertDeleted = (id: Id64String, msg: string) =>
      assert.isUndefined(iModelDb.elements.tryGetElement(id), msg);

    /**
     * Call purgeDefinitionElements, verify the returned failed-set, then check which elements
     * survived vs. were deleted. Rolls back changes with abandonChanges afterwards.
     */
    const executeTestCase = (
      label: string,
      idsToDelete: Id64Array,
      expectedFailed: Id64Array,
      expectedDeleted: Id64Array,
      expectedRetained: Id64Array,
    ) => {
      const failed = iModelDb.elements.purgeDefinitionElements(idsToDelete);
      assert.sameMembers(Array.from(failed), expectedFailed, `[${label}] failed set mismatch`);
      for (const id of expectedDeleted)
        assertDeleted(id, `error reading element 2`);
      for (const id of expectedRetained)
        assertExists(id, `[${label}] ${id} should have been retained`);
      iModelDb.abandonChanges();
    };

    it("should delete if not used with purgeDefinitionElements", async () => {
      let usedDefinitionElementIds: Id64Set;

      // make sure purgeDefinitionElements skips Elements that are not DefinitionElements
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
      assert.equal(usedDefinitionElementIds.size ?? 0, 0);
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId1));
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId2));
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId3));
      assert.isDefined(iModelDb.elements.tryGetElement(subjectId));

      // make sure purgeDefinitionElements skips invalid Ids
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([Id64.invalid, Id64.invalid]);
      assert.equal(usedDefinitionElementIds.size ?? 0, 0);

      // delete/purgeDefinitionElements for a used GeometryPart should fail
      assert.throws(() => iModelDb.elements.deleteElement(geometryPartId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([geometryPartId]);
      assert.isTrue(usedDefinitionElementIds.has(geometryPartId));
      assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId));

      // purgeDefinitionElements for an unused GeometryPart should succeed, delete should still fail
      const unusedGeometryPartProps: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: definitionModelId,
        code: GeometryPart.createCode(iModelDb, definitionModelId, "Unused GeometryPart"),
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      };
      const unusedGeometryPartId = iModelDb.elements.insertElement(unusedGeometryPartProps);
      assert.isTrue(Id64.isValidId64(unusedGeometryPartId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedGeometryPartId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedGeometryPartId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedGeometryPartId));

      // delete/purgeDefinitionElements for a used RenderMaterial should fail
      assert.throws(() => iModelDb.elements.deleteElement(renderMaterialId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([renderMaterialId]);
      assert.isTrue(usedDefinitionElementIds.has(renderMaterialId));
      assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId));

      // purgeDefinitionElements for an unused RenderMaterial should succeed, delete should still fail
      const unusedRenderMaterialId = RenderMaterialElement.insert(iModelDb, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
      assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedRenderMaterialId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedRenderMaterialId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedRenderMaterialId));

      // delete/purgeDefinitionElements for a used Texture should fail
      assert.throws(() => iModelDb.elements.deleteElement(textureId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([textureId]);
      assert.isTrue(usedDefinitionElementIds.has(textureId));
      assert.isDefined(iModelDb.elements.tryGetElement(textureId));

      // purgeDefinitionElements for an unused Texture should succeed, delete should still fail
      const unusedTextureId = IModelTestUtils.insertTextureElement(iModelDb, definitionModelId, "Unused Texture");
      assert.isTrue(Id64.isValidId64(unusedTextureId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedTextureId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedTextureId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedTextureId));

      // delete/purgeDefinitionElements for a used SpatialCategory should fail
      assert.throws(() => iModelDb.elements.deleteElement(spatialCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([spatialCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

      // delete/purgeDefinitionElements for a default SubCategory should fail
      const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
      const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
      assert.throws(() => iModelDb.elements.deleteElement(defaultSpatialSubCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([defaultSpatialSubCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(defaultSpatialSubCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

      // delete/purgeDefinitionElements for a used, non-default SubCategory should fail
      assert.throws(() => iModelDb.elements.deleteElement(subCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([subCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(subCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId));

      // purgeDefinitionElements for an unused SubCategory should succeed, delete should still fail
      const unusedSubCategoryId = SubCategory.insert(iModelDb, spatialCategoryId, "Unused SubCategory", {});
      assert.isTrue(Id64.isValidId64(unusedSubCategoryId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedSubCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedSubCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSubCategoryId));

      // purgeDefinitionElements for an unused SpatialCategory should succeed, delete should still fail
      const unusedSpatialCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Unused SpatialCategory", {});
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
      const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
      const unusedSpatialCategoryDefaultSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryDefaultSubCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedSpatialCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryDefaultSubCategoryId));

      // delete/purgeDefinitionElements of a used DrawingCategory should fail
      assert.throws(() => iModelDb.elements.deleteElement(drawingCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([drawingCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

      // purgeDefinitionElements for an unused DrawingCategory should succeed, delete should still fail
      const unusedDrawingCategoryId = DrawingCategory.insert(iModelDb, definitionModelId, "Unused DrawingCategory", {});
      assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
      const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
      const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
      assert.throws(() => iModelDb.elements.deleteElement(unusedDrawingSubCategoryId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([unusedDrawingCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));

      // delete/purgeDefinitionElements of DefinitionElements used by an existing SpatialViewDefinition should fail
      assert.throws(() => iModelDb.elements.deleteElement(spatialCategorySelectorId));
      assert.throws(() => iModelDb.elements.deleteElement(modelSelectorId));
      assert.throws(() => iModelDb.elements.deleteElement(displayStyle3dId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(modelSelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(viewId));

      // purgeDefinitionElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      assert.throws(() => iModelDb.elements.deleteElement(viewId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(viewId));

      // delete/purgeDefinitionElements of DefinitionElements used by an existing DrawingViewDefinition should fail
      assert.throws(() => iModelDb.elements.deleteElement(drawingCategorySelectorId));
      assert.throws(() => iModelDb.elements.deleteElement(displayStyle2dId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([drawingCategorySelectorId, displayStyle2dId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingViewId));

      // purgeDefinitionElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      assert.throws(() => iModelDb.elements.deleteElement(drawingViewId));
      usedDefinitionElementIds = iModelDb.elements.purgeDefinitionElements([drawingViewId, drawingCategorySelectorId, displayStyle2dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingViewId));

      iModelDb.saveChanges();
      iModelDb.close();
    });

    it("deletes a single unused GeometryPart", () => {
      const unusedPart = insertGeometryPart();
      iModelDb.saveChanges();
      executeTestCase("single unused part", [unusedPart], [], [unusedPart], []);
    });

    it("deletes multiple unused GeometryParts in one call", () => {
      const part1 = insertGeometryPart();
      const part2 = insertGeometryPart();
      const part3 = insertGeometryPart();
      iModelDb.saveChanges();
      executeTestCase("multiple unused parts", [part1, part2, part3], [], [part1, part2, part3], []);
    });

    it("returns empty failed-set when given an empty array", () => {
      const failed = iModelDb.elements.purgeDefinitionElements([]);
      assert.isEmpty(Array.from(failed), "empty input should return empty failed set");
      iModelDb.abandonChanges();
    });

    it("silently skips non-DefinitionElements", () => {
      const failed = iModelDb.elements.purgeDefinitionElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
      assert.isEmpty(Array.from(failed), "non-DefinitionElements should not appear in failed set");
      assertExists(physicalObjectId1, "physicalObjectId1 must not be deleted");
      assertExists(physicalObjectId2, "physicalObjectId2 must not be deleted");
      assertExists(physicalObjectId3, "physicalObjectId3 must not be deleted");
      assertExists(subjectId, "subjectId must not be deleted");
      iModelDb.abandonChanges();
    });

    it("silently skips invalid ids", () => {
      const failed = iModelDb.elements.purgeDefinitionElements([Id64.invalid, Id64.invalid]);
      assert.isEmpty(Array.from(failed), "invalid ids should not appear in failed set");
      iModelDb.abandonChanges();
    });

    it("keeps an in-use GeometryPart in the failed set and does not delete it", () => {
      // geometryPartId is referenced by PhysicalObject1's geometry stream
      const failed = iModelDb.elements.purgeDefinitionElements([geometryPartId]);
      assert.isTrue(failed.has(geometryPartId), "in-use part must be in failed set");
      assertExists(geometryPartId, "in-use part must not be deleted");
      iModelDb.abandonChanges();
    });

    it("returns only the in-use part in the failed set when mixing used and unused parts", () => {
      const unusedPart = insertGeometryPart();
      const usedPart = insertGeometryPart();

      // Reference usedPart from a physical element geometry stream
      const physElemProps: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: physicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        placement: { origin: Point3d.create(0, 0, 0).toJSON(), angles: {} },
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedPart),
      };
      const physElemId = iModelDb.elements.insertElement(physElemProps);
      iModelDb.saveChanges();

      executeTestCase(
        "used + unused parts",
        [unusedPart, usedPart],
        [usedPart],
        [unusedPart],
        [usedPart, physElemId],
      );
    });

    it("keeps an in-use RenderMaterial in the failed set and does not delete it", () => {
      const failed = iModelDb.elements.purgeDefinitionElements([renderMaterialId]);
      assert.isTrue(failed.has(renderMaterialId), "in-use RenderMaterial must be in failed set");
      assertExists(renderMaterialId, "in-use RenderMaterial must not be deleted");
      iModelDb.abandonChanges();
    });

    it("deletes an unused RenderMaterial", () => {
      const unusedRenderMaterialId = RenderMaterialElement.insert(iModelDb, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
      iModelDb.saveChanges();
      executeTestCase("unused RenderMaterial", [unusedRenderMaterialId], [], [unusedRenderMaterialId], []);
    });

    it("keeps an in-use Texture in the failed set and does not delete it", () => {
      iModelDb.saveChanges();
      const failed = iModelDb.elements.purgeDefinitionElements([textureId]);
      assert.isTrue(failed.has(textureId), "in-use Texture must be in failed set");
      assertExists(textureId, "in-use Texture must not be deleted");
      iModelDb.abandonChanges();
    });

    it("deletes an unused Texture", () => {
      const unusedTextureId = IModelTestUtils.insertTextureElement(iModelDb, definitionModelId, "Unused Texture");
      iModelDb.saveChanges();
      executeTestCase("unused Texture", [unusedTextureId], [], [unusedTextureId], []);
    });

    // ── Categories and SubCategories ─────────────────────────────────────────────────────────

    it("keeps an in-use SpatialCategory in the failed set and does not delete it", () => {
      iModelDb.saveChanges();
      const failed = iModelDb.elements.purgeDefinitionElements([spatialCategoryId]);
      assert.isTrue(failed.has(spatialCategoryId), "in-use SpatialCategory must be in failed set");
      assertExists(spatialCategoryId, "in-use SpatialCategory must not be deleted");
      iModelDb.abandonChanges();
    });

    it("keeps the default SubCategory in the failed set when its parent SpatialCategory is in use", () => {
      iModelDb.saveChanges();
      const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
      const defaultSubCategoryId = spatialCategory.myDefaultSubCategoryId();
      const failed = iModelDb.elements.purgeDefinitionElements([defaultSubCategoryId]);
      assert.isTrue(failed.has(defaultSubCategoryId), "default SubCategory must be in failed set");
      assertExists(defaultSubCategoryId, "default SubCategory must not be deleted");
      iModelDb.abandonChanges();
    });

    it("keeps a used non-default SubCategory in the failed set and does not delete it", () => {
      iModelDb.saveChanges();
      const failed = iModelDb.elements.purgeDefinitionElements([subCategoryId]);
      assert.isTrue(failed.has(subCategoryId), "in-use SubCategory must be in failed set");
      assertExists(subCategoryId, "in-use SubCategory must not be deleted");
      iModelDb.abandonChanges();
    });

    it("deletes an unused non-default SubCategory", () => {
      const unusedSubCategoryId = SubCategory.insert(iModelDb, spatialCategoryId, "Unused SubCategory", {});
      iModelDb.saveChanges();
      executeTestCase("unused SubCategory", [unusedSubCategoryId], [], [unusedSubCategoryId], [spatialCategoryId]);
    });

    it("deletes an unused SpatialCategory together with its default SubCategory", () => {
      const unusedCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Unused SpatialCategory", {});
      const unusedCategory = iModelDb.elements.getElement<SpatialCategory>(unusedCategoryId, SpatialCategory);
      const unusedDefaultSubCategoryId = unusedCategory.myDefaultSubCategoryId();
      iModelDb.saveChanges();

      executeTestCase(
        "unused SpatialCategory + default SubCategory",
        [unusedCategoryId],
        [],
        [unusedCategoryId, unusedDefaultSubCategoryId],
        [],
      );
    });

    it("deletes an unused DrawingCategory together with its default SubCategory", () => {
      const unusedDrawingCategoryId = DrawingCategory.insert(iModelDb, definitionModelId, "Unused DrawingCategory", {});
      const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
      const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
      iModelDb.saveChanges();

      executeTestCase(
        "unused DrawingCategory + default SubCategory",
        [unusedDrawingCategoryId],
        [],
        [unusedDrawingCategoryId, unusedDrawingSubCategoryId],
        [],
      );
    });

    it("keeps CategorySelector, ModelSelector, DisplayStyle3d in the failed set when their view still exists", () => {
      executeTestCase(
        "view-related still referenced",
        [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
        [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
        [],
        [spatialCategorySelectorId, modelSelectorId, displayStyle3dId, viewId],
      );
    });

    it("deletes CategorySelector, ModelSelector, DisplayStyle3d and the SpatialViewDefinition in one call", () => {
      executeTestCase(
        "view + view-related",
        [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
        [],
        [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
        [],
      );
    });

    it("deletes DrawingCategorySelector, DisplayStyle2d and the DrawingViewDefinition in one call", () => {
      executeTestCase(
        "drawing view + drawing view-related",
        [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
        [],
        [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
        [],
      );
    });

    it("deletes orphaned CategorySelector and DisplayStyle2d (no view references them)", () => {
      // Insert a standalone CategorySelector and DisplayStyle2d that are not referenced by any view
      const orphanCategorySelectorId = CategorySelector.insert(iModelDb, definitionModelId, "OrphanCategorySelector", [drawingCategoryId]);
      const orphanDisplayStyle2dId = DisplayStyle2d.insert(iModelDb, definitionModelId, "OrphanDisplayStyle2d");
      iModelDb.saveChanges();

      executeTestCase(
        "orphaned view-related elements",
        [orphanCategorySelectorId, orphanDisplayStyle2dId],
        [],
        [orphanCategorySelectorId, orphanDisplayStyle2dId],
        [],
      );
    });

    // Parent-child tests

    it("deletes a parent DefinitionElement and automatically includes its child", () => {
      const parentPart = insertGeometryPart();
      const childPart = insertGeometryPart(parentPart);
      iModelDb.saveChanges();

      // Only pass the parent — the child must be pulled in automatically
      executeTestCase(
        "parent + child definition elements",
        [parentPart],
        [],
        [parentPart, childPart],
        [],
      );
    });

    it("deletes a parent DefinitionElement and its child explicitly passed", () => {
      const parentPart = insertGeometryPart();
      const childPart = insertGeometryPart(parentPart);
      iModelDb.saveChanges();

      // Pass both parent and child explicitly
      executeTestCase(
        "parent + child definition elements",
        [parentPart, childPart],
        [],
        [parentPart, childPart],
        [],
      );
    });

    // Intra-set code scope
    // Both partA and partB are in the input set; partB uses partA as its CodeScope.
    // The old implementation would fail here because partA's deletion was blocked by partB's
    // code scope reference. The new native API resolves all intra-set dependencies first.
    it("deletes two DefinitionElements related by code scope when both are in the same set", () => {
      const scopeSpecId = iModelDb.codeSpecs.insert("DefElemScopeSpec", CodeScopeSpec.Type.RelatedElement);
      const partA = insertGeometryPart();
      const partBProps: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: definitionModelId,
        code: { spec: scopeSpecId, scope: partA, value: "partB-code" },
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      };
      const partB = iModelDb.elements.insertElement(partBProps);
      iModelDb.saveChanges();

      // Both unused externally; the intra-set code-scope link must not block deletion
      executeTestCase("intra-set code scope", [partA, partB], [], [partA, partB], []);
    });

    // Multi-level parent-child hierarchy
    // Passing only the root must automatically pull in all descendants (leaf-first).
    // The old implementation deleted elements in a fixed ECClass order and could not handle
    // arbitrary parent-child chains within the set.
    it("deletes a 3-level parent-child hierarchy by passing only the root", () => {
      const root = insertGeometryPart();
      const child = insertGeometryPart(root);
      const grandchild = insertGeometryPart(child);
      iModelDb.saveChanges();

      // Only supply the root — all descendants must be included and deleted leaf-first
      executeTestCase("3-level hierarchy via root only", [root], [], [root, child, grandchild], []);
    });

    it("deletes a 3-level parent-child hierarchy by passing all elements explicitly", () => {
      const root = insertGeometryPart();
      const child = insertGeometryPart(root);
      const grandchild = insertGeometryPart(child);
      iModelDb.saveChanges();

      // Pass all elements explicitly
      executeTestCase(
        "3-level hierarchy with all elements",
        [root, child, grandchild],
        [],
        [root, child, grandchild],
        [],
      );
    });

    // Mixed inputs
    it("deletes a mixed batch of unused DefinitionElements of different types in one call", () => {
      const unusedPart = insertGeometryPart();
      const unusedRenderMaterial = RenderMaterialElement.insert(iModelDb, definitionModelId, "BatchRenderMaterial", { paletteName: "P" });
      const unusedTexture = IModelTestUtils.insertTextureElement(iModelDb, definitionModelId, "BatchTexture");
      const unusedSubCategory = SubCategory.insert(iModelDb, spatialCategoryId, "BatchSubCategory", {});
      iModelDb.saveChanges();

      executeTestCase(
        "mixed unused batch",
        [unusedPart, unusedRenderMaterial, unusedTexture, unusedSubCategory],
        [],
        [unusedPart, unusedRenderMaterial, unusedTexture, unusedSubCategory],
        [],
      );
    });

    // Mixed inputs with intra scope violations and parent child hierarchies
    it("deletes a mixed batch of used and unused DefinitionElements in a hierarchy with conflicting code scopes", () => {
      const scopeSpecId = iModelDb.codeSpecs.insert("DefElemScopeSpec", CodeScopeSpec.Type.RelatedElement);
      const usedPart = insertGeometryPart();
      const unusedPart = insertGeometryPart();
      const childPart = insertGeometryPart(usedPart);

      const scopedPartProps: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: definitionModelId,
        code: { spec: scopeSpecId, scope: childPart, value: "scopedPart-code" },
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      };
      const scopedPart = iModelDb.elements.insertElement(scopedPartProps);

      iModelDb.saveChanges();

      // Pass both used and unused parts, with a child that has a code scope reference
      executeTestCase(
        "mixed used and unused batch",
        [usedPart, unusedPart, scopedPart],
        [],
        [usedPart, unusedPart, childPart, scopedPart],
        [],
      );
    });
  });
});
