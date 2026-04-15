/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64, Id64Set } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { GeometryPartProps, ImageSourceFormat, IModel } from "@itwin/core-common";
import { EditTxn } from "../../EditTxn";
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
    await ExtensiveTestScenario.populateDb(iModelDb);

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

    const txn = new EditTxn(iModelDb, "delete definition elements");
    txn.start();

    let usedDefinitionElementIds: Id64Set;
    const expectDeleteToThrow = (elementId: string) => assert.throws(() => txn.deleteElement(elementId));

    try {
      // make sure deleteDefinitionElements skips Elements that are not DefinitionElements
      usedDefinitionElementIds = txn.deleteDefinitionElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId1));
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId2));
      assert.isDefined(iModelDb.elements.tryGetElement(physicalObjectId3));
      assert.isDefined(iModelDb.elements.tryGetElement(subjectId));

      // make sure deleteDefinitionElements skips invalid Ids
      usedDefinitionElementIds = txn.deleteDefinitionElements([Id64.invalid, Id64.invalid]);
      assert.equal(usedDefinitionElementIds.size, 0);

      // delete/deleteDefinitionElements for a used GeometryPart should fail
      expectDeleteToThrow(geometryPartId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([geometryPartId]);
      assert.isTrue(usedDefinitionElementIds.has(geometryPartId));
      assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId));

      // deleteDefinitionElements for an unused GeometryPart should succeed, delete should still fail
      const unusedGeometryPartProps: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: definitionModelId,
        code: GeometryPart.createCode(iModelDb, definitionModelId, "Unused GeometryPart"),
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      };
      const unusedGeometryPartId = txn.insertElement(unusedGeometryPartProps);
      assert.isTrue(Id64.isValidId64(unusedGeometryPartId));
      expectDeleteToThrow(unusedGeometryPartId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedGeometryPartId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedGeometryPartId));

      // delete/deleteDefinitionElements for a used RenderMaterial should fail
      expectDeleteToThrow(renderMaterialId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([renderMaterialId]);
      assert.isTrue(usedDefinitionElementIds.has(renderMaterialId));
      assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId));

      // deleteDefinitionElements for an unused RenderMaterial should succeed, delete should still fail
      const unusedRenderMaterial = RenderMaterialElement.create(iModelDb, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
      const unusedRenderMaterialId = txn.insertElement(unusedRenderMaterial.toJSON());
      assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
      expectDeleteToThrow(unusedRenderMaterialId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedRenderMaterialId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedRenderMaterialId));

      // delete/deleteDefinitionElements for a used Texture should fail
      expectDeleteToThrow(textureId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([textureId]);
      assert.isTrue(usedDefinitionElementIds.has(textureId));
      assert.isDefined(iModelDb.elements.tryGetElement(textureId));

      // deleteDefinitionElements for an unused Texture should succeed, delete should still fail
      const textureData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]).toString("base64");
      const unusedTexture = Texture.createTexture(iModelDb, definitionModelId, "Unused Texture", ImageSourceFormat.Png, textureData, "Description for Unused Texture");
      const unusedTextureId = txn.insertElement(unusedTexture.toJSON());
      assert.isTrue(Id64.isValidId64(unusedTextureId));
      expectDeleteToThrow(unusedTextureId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedTextureId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedTextureId));

      // delete/deleteDefinitionElements for a used SpatialCategory should fail
      expectDeleteToThrow(spatialCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([spatialCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

      // delete/deleteDefinitionElements for a default SubCategory should fail
      const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
      const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
      expectDeleteToThrow(defaultSpatialSubCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([defaultSpatialSubCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(defaultSpatialSubCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

      // delete/deleteDefinitionElements for a used, non-default SubCategory should fail
      expectDeleteToThrow(subCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([subCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(subCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId));

      // deleteDefinitionElements for an unused SubCategory should succeed, delete should still fail
      const unusedSubCategory = SubCategory.create(iModelDb, spatialCategoryId, "Unused SubCategory", {});
      const unusedSubCategoryId = txn.insertElement(unusedSubCategory.toJSON());
      assert.isTrue(Id64.isValidId64(unusedSubCategoryId));
      expectDeleteToThrow(unusedSubCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedSubCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSubCategoryId));

      // deleteDefinitionElements for an unused SpatialCategory should succeed, delete should still fail
      const unusedSpatialCategory = SpatialCategory.create(iModelDb, definitionModelId, "Unused SpatialCategory");
      const unusedSpatialCategoryId = txn.insertElement(unusedSpatialCategory.toJSON());
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
      const reloadedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
      const unusedSpatialCategoryDefaultSubCategoryId = reloadedSpatialCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
      expectDeleteToThrow(unusedSpatialCategoryId);
      expectDeleteToThrow(unusedSpatialCategoryDefaultSubCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedSpatialCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryDefaultSubCategoryId));

      // delete/deleteDefinitionElements of a used DrawingCategory should fail
      expectDeleteToThrow(drawingCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([drawingCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

      // deleteDefinitionElements for an unused DrawingCategory should succeed, delete should still fail
      const unusedDrawingCategory = DrawingCategory.create(iModelDb, definitionModelId, "Unused DrawingCategory");
      const unusedDrawingCategoryId = txn.insertElement(unusedDrawingCategory.toJSON());
      assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
      const reloadedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
      const unusedDrawingSubCategoryId = reloadedDrawingCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
      expectDeleteToThrow(unusedDrawingSubCategoryId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([unusedDrawingCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));

      // delete/deleteDefinitionElements of DefinitionElements used by an existing SpatialViewDefinition should fail
      expectDeleteToThrow(spatialCategorySelectorId);
      expectDeleteToThrow(modelSelectorId);
      expectDeleteToThrow(displayStyle3dId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(modelSelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(viewId));

      // deleteDefinitionElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      expectDeleteToThrow(viewId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(viewId));

      // delete/deleteDefinitionElements of DefinitionElements used by an existing DrawingViewDefinition should fail
      expectDeleteToThrow(drawingCategorySelectorId);
      expectDeleteToThrow(displayStyle2dId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([drawingCategorySelectorId, displayStyle2dId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingViewId));

      // deleteDefinitionElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      expectDeleteToThrow(drawingViewId);
      usedDefinitionElementIds = txn.deleteDefinitionElements([drawingViewId, drawingCategorySelectorId, displayStyle2dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingViewId));

      txn.end();
    } finally {
      if (txn.isActive)
        txn.end("abandon");

      iModelDb.close();
    }
  });
});
