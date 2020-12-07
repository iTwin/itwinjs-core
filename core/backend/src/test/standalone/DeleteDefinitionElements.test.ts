/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64, Id64Set, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { GeometryPartProps, IModel } from "@bentley/imodeljs-common";
import {
  CategorySelector, DisplayStyle2d, DisplayStyle3d, DrawingCategory, DrawingViewDefinition, GeometryPart, IModelJsFs, InformationPartitionElement,
  ModelSelector, OrthographicViewDefinition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, Subject, Texture,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelTransformerUtils } from "../IModelTransformerUtils";
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
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }
  });

  it.only("should delete if not used", async () => {
    const iModelFile: string = IModelTestUtils.prepareOutputFile("DeleteDefinitionElements", "dde.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "DeleteDefinitionElements" } });
    await IModelTransformerUtils.prepareSourceDb(iModelDb);
    IModelTransformerUtils.populateSourceDb(iModelDb);

    // Get ElementIds of DefinitionElements created by populateSourceDb
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

    /*
    // RenderMaterial usage
    assert.isTrue(usageInfo.renderMaterialIds!.includes(renderMaterialId));
    assert.isTrue(usageInfo.usedIds!.includes(renderMaterialId));
    assert.throws(() => sourceDb.elements.deleteElement(renderMaterialId));
    // Texture usage
    assert.isTrue(usageInfo.textureIds!.includes(textureId));
    assert.isFalse(usageInfo.usedIds!.includes(textureId));
    assert.throws(() => sourceDb.elements.deleteElement(textureId));
    // specify subCategoryId only to test Category filtering
    const subCategoryUsageInfo = sourceDb.nativeDb.queryDefinitionElementUsage([subCategoryId])!;
    assert.exists(subCategoryUsageInfo);
    assert.isTrue(subCategoryUsageInfo.subCategoryIds!.includes(subCategoryId));
    assert.equal(subCategoryUsageInfo.subCategoryIds!.length, 1);
    assert.isTrue(subCategoryUsageInfo.usedIds!.includes(subCategoryId));
    assert.equal(subCategoryUsageInfo.usedIds!.length, 1);
    */

    let notDeletedIds: Id64Set;

    // delete/deleteDefinitionElements for a used SpatialCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(spatialCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([spatialCategoryId]);
    assert.isTrue(notDeletedIds.has(spatialCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

    // delete/deleteDefinitionElements for a default SubCategory should fail
    const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
    const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
    assert.throws(() => iModelDb.elements.deleteElement(defaultSpatialSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([defaultSpatialSubCategoryId]);
    assert.isTrue(notDeletedIds.has(defaultSpatialSubCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

    // delete/deleteDefinitionElements for a used, non-default SubCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(subCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([subCategoryId]);
    assert.isTrue(notDeletedIds.has(subCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId));

    // deleteDefinitionElements for an unused SubCategory should succeed, delete should still fail
    const unusedSubCategoryId = SubCategory.insert(iModelDb, spatialCategoryId, "Unused SubCategory", {});
    assert.throws(() => iModelDb.elements.deleteElement(unusedSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedSubCategoryId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSubCategoryId));

    // deleteDefinitionElements for an unused SpatialCategory should succeed, delete should still fail
    const unusedSpatialCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Unused SpatialCategory", {});
    assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
    const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
    const unusedSpatialCategoryDefaultSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedSpatialCategoryDefaultSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedSpatialCategoryId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryDefaultSubCategoryId));

    // delete/deleteDefinitionElements of a used DrawingCategory should fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([drawingCategoryId]);
    assert.isTrue(notDeletedIds.has(drawingCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

    // deleteDefinitionElements for an unused DrawingCategory should succeed, delete should still fail
    const unusedDrawingCategoryId = DrawingCategory.insert(iModelDb, definitionModelId, "Unused DrawingCategory", {});
    assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
    const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
    const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedDrawingSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedDrawingCategoryId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));

    // delete/deleteDefinitionElements of DefinitionElements used by an existing SpatialViewDefinition should fail
    assert.throws(() => iModelDb.elements.deleteElement(spatialCategorySelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(modelSelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(displayStyle3dId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.isTrue(notDeletedIds.has(spatialCategorySelectorId));
    assert.isTrue(notDeletedIds.has(modelSelectorId));
    assert.isTrue(notDeletedIds.has(displayStyle3dId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));
    assert.isDefined(iModelDb.elements.tryGetElement(viewId));

    // deleteDefinitionElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
    assert.throws(() => iModelDb.elements.deleteElement(viewId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
    assert.isUndefined(iModelDb.elements.tryGetElement(viewId));

    // delete/deleteDefinitionElements of DefinitionElements used by an existing DrawingViewDefinition should fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingCategorySelectorId));
    assert.throws(() => iModelDb.elements.deleteElement(displayStyle2dId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([drawingCategorySelectorId, displayStyle2dId]);
    assert.isTrue(notDeletedIds.has(drawingCategorySelectorId));
    assert.isTrue(notDeletedIds.has(displayStyle2dId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(displayStyle2dId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingViewId));

    // deleteDefinitionElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
    assert.throws(() => iModelDb.elements.deleteElement(drawingViewId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([drawingViewId, drawingCategorySelectorId, displayStyle2dId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle2dId));
    assert.isUndefined(iModelDb.elements.tryGetElement(drawingViewId));

    // delete/deleteDefinitionElements for a used GeometryPart should fail
    assert.throws(() => iModelDb.elements.deleteElement(geometryPartId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([geometryPartId]);
    assert.isTrue(notDeletedIds.has(geometryPartId));
    assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId));

    // deleteDefinitionElements for an unused GeometryPart should succeed, delete should still fail
    const unusedGeometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(iModelDb, definitionModelId, "Unused GeometryPart"),
      geom: IModelTransformerUtils.createBox(Point3d.create(1, 1, 1)),
    };
    const unusedGeometryPartId = iModelDb.elements.insertElement(unusedGeometryPartProps);
    assert.isTrue(Id64.isValidId64(unusedGeometryPartId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedGeometryPartId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedGeometryPartId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedGeometryPartId));

    // delete/deleteDefinitionElements for a used RenderMaterial should fail
    assert.throws(() => iModelDb.elements.deleteElement(renderMaterialId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([renderMaterialId]);
    assert.isTrue(notDeletedIds.has(renderMaterialId));
    assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId));

    // deleteDefinitionElements for an unused RenderMaterial should succeed, delete should still fail
    const unusedRenderMaterialId = RenderMaterialElement.insert(iModelDb, definitionModelId, "Unused RenderMaterial", new RenderMaterialElement.Params("PaletteName"));
    assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
    assert.throws(() => iModelDb.elements.deleteElement(unusedRenderMaterialId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedRenderMaterialId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedRenderMaterialId));

    // delete/deleteDefinitionElements for a used Texture should fail
    assert.throws(() => iModelDb.elements.deleteElement(textureId));
    // WIP: usage via DisplayStyle skyBox not yet detected
    // notDeletedIds = iModelDb.elements.deleteDefinitionElements([textureId]);
    // assert.isTrue(notDeletedIds.has(textureId));
    // assert.isDefined(iModelDb.elements.tryGetElement(textureId));

    iModelDb.saveChanges();
    iModelDb.close();
  });
});
