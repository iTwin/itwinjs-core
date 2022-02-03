/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import type { Id64Set } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import type { GeometryPartProps} from "@itwin/core-common";
import { IModel } from "@itwin/core-common";
import {
  CategorySelector, DisplayStyle2d, DisplayStyle3d, DrawingCategory, DrawingViewDefinition, GeometryPart, IModelJsFs, InformationPartitionElement,
  ModelSelector, OrthographicViewDefinition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, Subject, Texture,
} from "../../core-backend";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("DeleteDefinitionElements", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "DeleteDefinitionElements");

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
  });

  it("should delete if not used", async () => {
    const iModelFile: string = IModelTestUtils.prepareOutputFile("DeleteDefinitionElements", "DeleteDefinitionElements.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "DeleteDefinitionElements" } });
    await ExtensiveTestScenario.prepareDb(iModelDb);
    ExtensiveTestScenario.populateDb(iModelDb);

    // Get ElementIds of DefinitionElements created by populateDb
    const subjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, "Subject"))!;
    const definitionModelId = iModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(iModelDb, subjectId, "Definition"))!;
    const spatialCategoryId = iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(iModelDb, definitionModelId, "SpatialCategory"))!;
    const subCategoryId = iModelDb.elements.queryElementIdByCode(SubCategory.createCode(iModelDb, spatialCategoryId, "SubCategory"))!;
    const spatialCategorySelectorId = iModelDb.elements.queryElementIdByCode(CategorySelector.createCode(iModelDb, definitionModelId, "SpatialCategories"))!;
    const modelSelectorId = iModelDb.elements.queryElementIdByCode(ModelSelector.createCode(iModelDb, definitionModelId, "SpatialModels"))!;
    const displayStyle3dId = iModelDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(iModelDb, definitionModelId, "DisplayStyle3d"))!;
    const viewId = iModelDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(iModelDb, definitionModelId, "Orthographic View"))!;
    const drawingCategoryId = iModelDb.elements.queryElementIdByCode(DrawingCategory.createCode(iModelDb, definitionModelId, "DrawingCategory"))!;
    const drawingCategorySelectorId = iModelDb.elements.queryElementIdByCode(CategorySelector.createCode(iModelDb, definitionModelId, "DrawingCategories"))!;
    const displayStyle2dId = iModelDb.elements.queryElementIdByCode(DisplayStyle2d.createCode(iModelDb, definitionModelId, "DisplayStyle2d"))!;
    const drawingViewId = iModelDb.elements.queryElementIdByCode(DrawingViewDefinition.createCode(iModelDb, definitionModelId, "Drawing View"))!;
    const geometryPartId = iModelDb.elements.queryElementIdByCode(GeometryPart.createCode(iModelDb, definitionModelId, "GeometryPart"))!;
    const renderMaterialId = iModelDb.elements.queryElementIdByCode(RenderMaterialElement.createCode(iModelDb, definitionModelId, "RenderMaterial"))!;
    const textureId = iModelDb.elements.queryElementIdByCode(Texture.createCode(iModelDb, definitionModelId, "Texture"))!;
    const physicalObjectId1 = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject1");
    const physicalObjectId2 = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject2");
    const physicalObjectId3 = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject3");
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

    let usedDefinitionElementIds: Id64Set;

    // make sure deleteDefinitionElements skips Elements that are not DefinitionElements
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
    assert.equal(usedDefinitionElementIds.size, 0);
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId1));
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId2));
    assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId3));
    assert.isDefined(iModelDb.elements.tryGetElement(subjectId));

    // make sure deleteDefinitionElements skips invalid Ids
    usedDefinitionElementIds = iModelDb.elements.deleteDefinitionElements([Id64.invalid, Id64.invalid]);
    assert.equal(usedDefinitionElementIds.size, 0);

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
    const unusedRenderMaterialId = RenderMaterialElement.insert(iModelDb, definitionModelId, "Unused RenderMaterial", new RenderMaterialElement.Params("PaletteName"));
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
});
