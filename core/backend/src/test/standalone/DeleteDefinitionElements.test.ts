/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64, Id64Set, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModel } from "@bentley/imodeljs-common";
import {
  CategorySelector, DisplayStyle3d, DrawingCategory, IModelJsFs, InformationPartitionElement, ModelSelector, OrthographicViewDefinition, SnapshotDb, SpatialCategory, Subject,
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
    const spatialCategorySelectorId = iModelDb.elements.queryElementIdByCode(CategorySelector.createCode(iModelDb, definitionModelId, "SpatialCategories"))!;
    const modelSelectorId = iModelDb.elements.queryElementIdByCode(ModelSelector.createCode(iModelDb, definitionModelId, "SpatialModels"))!;
    const displayStyle3dId = iModelDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(iModelDb, definitionModelId, "DisplayStyle3d"))!;
    const viewId = iModelDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(iModelDb, definitionModelId, "Orthographic View"))!;
    const spatialCategoryId = iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(iModelDb, definitionModelId, "SpatialCategory"))!;
    const drawingCategoryId = iModelDb.elements.queryElementIdByCode(DrawingCategory.createCode(iModelDb, definitionModelId, "DrawingCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    assert.isTrue(Id64.isValidId64(viewId));
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    assert.isTrue(Id64.isValidId64(drawingCategoryId));

    // Delete of a used SpatialCategory should fail
    let notDeletedIds: Id64Set;
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([spatialCategoryId]);
    assert.isTrue(notDeletedIds.has(spatialCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

    // Delete of a default SubCategory should fail
    const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
    const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([defaultSpatialSubCategoryId]);
    assert.isTrue(notDeletedIds.has(defaultSpatialSubCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

    // Delete of a unused SpatialCategory should succeed
    const unusedSpatialCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Unused SpatialCategory", {});
    assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
    const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
    const unusedSpatialSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedSpatialSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedSpatialCategoryId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialSubCategoryId));

    // Delete of a used DrawingCategory should fail
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([drawingCategoryId]);
    assert.isTrue(notDeletedIds.has(drawingCategoryId));
    assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

    // Delete of a unused DrawingCategory should succeed
    const unusedDrawingCategoryId = DrawingCategory.insert(iModelDb, definitionModelId, "Unused DrawingCategory", {});
    assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
    const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
    const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
    assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([unusedDrawingCategoryId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
    assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));

    // Delete of DefinitionElements used by an existing view should fail
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.isTrue(notDeletedIds.has(spatialCategorySelectorId));
    assert.isTrue(notDeletedIds.has(modelSelectorId));
    assert.isTrue(notDeletedIds.has(displayStyle3dId));
    assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));

    // Delete should succeed when the list includes the view as the only thing referencing other DefinitionElements
    notDeletedIds = iModelDb.elements.deleteDefinitionElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
    assert.equal(notDeletedIds.size, 0);
    assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
    assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
    assert.isUndefined(iModelDb.elements.tryGetElement(viewId));
    iModelDb.saveChanges();
    iModelDb.close();
  });
});
