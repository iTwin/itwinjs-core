/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { Code, CodeScopeSpec, GeometricElement2dProps, GeometryPartProps, ImageSourceFormat, IModel, PhysicalElementProps, PhysicalTypeProps, QueryBinder, QueryRowFormat, SubCategoryAppearance, TypeDefinitionElementProps } from "@itwin/core-common";
import { BulkDeleteElementsResult, BulkDeleteElementsStatus, BulkDeleteFailure, BulkDeleteFailureReason, BulkDeleteMode, EditTxn } from "../../EditTxn";
import {
  _nativeDb, CategorySelector, ChannelControl, DefinitionContainer, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory,
  DrawingGraphic, DrawingViewDefinition, GenericGraphicalType2d, GenericPhysicalType, GeometryPart,
  GraphicalElement2dIsOfType, IModelJsFs, InformationPartitionElement, ModelSelector, OrthographicViewDefinition, PhysicalElementIsOfType,
  PhysicalModel, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, Subject, Texture,
} from "../../core-backend";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

/** Expected shape of a [[BulkDeleteElementsResult]]. `sqlDeleteStatus` defaults to `BE_SQLITE_OK`. `failures` must match exactly (order-insensitive). */
interface ExpectedResult {
  status: BulkDeleteElementsStatus;
  sqlDeleteStatus?: DbResult;
  failures: BulkDeleteFailure[];
}

const success: ExpectedResult = { status: BulkDeleteElementsStatus.Success, sqlDeleteStatus: DbResult.BE_SQLITE_OK, failures: [] };
const partialSuccess = (...failures: BulkDeleteFailure[]): ExpectedResult => ({ status: BulkDeleteElementsStatus.PartialSuccess, failures });

/** The element is a DefinitionElement still used (e.g. via a GeometryStream) by elements outside the delete set. */
const definitionInUse = (elementId: Id64String): BulkDeleteFailure => ({ elementId, reason: BulkDeleteFailureReason.DefinitionInUse });
/** The element itself is referenced from outside the delete set via its Code scope. */
const codeScopeViolator = (elementId: Id64String): BulkDeleteFailure => referencedByForeignKey(elementId, "bis_Element.CodeScopeId");
/** A row outside the delete set references the element via a hard NO ACTION foreign key; `detail` is the referencing `table.column`. */
const referencedByForeignKey = (elementId: Id64String, detail: string): BulkDeleteFailure => ({ elementId, reason: BulkDeleteFailureReason.ReferencedByForeignKey, detail });
/** A Category still assigned to a GeometricElement3d outside the delete set (hard FK, so not `DefinitionInUse`). */
const categoryInUse3d = (elementId: Id64String): BulkDeleteFailure => referencedByForeignKey(elementId, "bis_GeometricElement3d.CategoryId");
/** A Category still assigned to a GeometricElement2d outside the delete set (hard FK, so not `DefinitionInUse`). */
const categoryInUse2d = (elementId: Id64String): BulkDeleteFailure => referencedByForeignKey(elementId, "bis_GeometricElement2d.CategoryId");
/** A *requested* element that was skipped because `violator` (a logical relative in the delete set) could not be deleted. */
const blockedByRelative = (elementId: Id64String, violator: Id64String): BulkDeleteFailure => ({ elementId, reason: BulkDeleteFailureReason.BlockedByRelative, detail: violator });

/** Assert the result matches `expected` exactly, then check that each id in `deletedIds` is gone and each id in `retainedIds` is still present. */
const assertResult = (result: BulkDeleteElementsResult, expected: ExpectedResult, deletedIds: Id64Array, retainedIds: Id64Array, iModelDb: SnapshotDb) => {
  assert.equal(result.status, expected.status, `Bulk element deletion status is ${BulkDeleteElementsStatus[result.status]}; Expected: ${BulkDeleteElementsStatus[expected.status]}. Actual failures: ${JSON.stringify(result.failures)}`);
  assert.equal(result.sqlDeleteStatus, expected.sqlDeleteStatus ?? DbResult.BE_SQLITE_OK, `Bulk element deletion internal sql status is ${result.sqlDeleteStatus}; Expected: ${expected.sqlDeleteStatus ?? DbResult.BE_SQLITE_OK}`);

  assert.equal(result.failures.length, expected.failures.length, `Actual failures don't match the expected. Actual: ${JSON.stringify(result.failures)}; Expected: ${JSON.stringify(expected.failures)}`);
  assert.deepEqualInAnyOrder(result.failures, expected.failures);

  for (const retainedId of retainedIds)
    assert.isDefined(iModelDb.elements.tryGetElement(retainedId), `${retainedId} should have been retained`);

  for (const deletedId of deletedIds)
    assert.isUndefined(iModelDb.elements.tryGetElement(deletedId), `${deletedId} should have been deleted`);
};

describe("DeleteDefinitionElements", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "DeleteDefinitionElements");

  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let subjectId: Id64String;
  let definitionModelId: Id64String;
  let physicalModelId: Id64String;
  let spatialCategoryId: Id64String;
  let subCategoryId: Id64String;
  let filteredSubCategoryId: Id64String;
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
    filteredSubCategoryId = seedDb.elements.queryElementIdByCode(SubCategory.createCode(seedDb, spatialCategoryId, "FilteredSubCategory"))!;
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

    withEditTxn(seedDb, "save changes", () => { });
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

  describe("deleteElements", () => {
    let elementCounter = 0;

    beforeEach(() => { elementCounter = 0; });

    afterEach(() => {
      if (iModelDb.isOpen) {
        const txn = new EditTxn(iModelDb, "abandon");
        txn.start();
        txn.end("abandon");
      }
    });

    const insertDefinitionElement = (txn: EditTxn, parentId?: Id64String, modelId?: Id64String): Id64String => {
      const props: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: modelId ?? definitionModelId,
        code: GeometryPart.createCode(iModelDb, modelId ?? definitionModelId, `TestPart_${++elementCounter}`),
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      };
      return txn.insertElement(props);
    };

    /**
     * Call deleteElements, compare the returned result object against `expected`, then check which elements survived vs. were deleted.
     * Rolls back changes with abandonChanges afterwards.
     */
    const executeTestCase = (txn: EditTxn, _label: string, idsToDelete: Id64Array, deletedIds: Id64Array, expected: ExpectedResult, retainedIds: Id64Array, abandonChanges: boolean = true) => {
      const result = txn.deleteElements(idsToDelete);
      assertResult(result, expected, deletedIds, retainedIds, iModelDb);

      if (abandonChanges)
        txn.abandonChanges();
    };

    it("should delete only if not used with deleteElements", async () => {
      const txn = new EditTxn(iModelDb, "delete definition elements");
      txn.start();

      /** Run deleteElements and compare the returned result object against `expected`, then check deleted / retained ids. */
      const expectDelete = (idsToDelete: Id64Array, expected: ExpectedResult, deletedIds: Id64Array, retainedIds: Id64Array) =>
        assertResult(txn.deleteElements(idsToDelete), expected, deletedIds, retainedIds, iModelDb);

      try {
        // Deleting the Subject expands the delete set to everything beneath it (partitions, sub-models and their contents).
        // Every element in this iModel lives under that Subject, so all usages of the categories / GeometryPart / RenderMaterial
        // in the Definition model are *intra-set* and must not block the deletion: everything is deleted.
        expectDelete(
          [physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId],
          success,
          [physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId, definitionModelId, physicalModelId, spatialCategoryId, geometryPartId, renderMaterialId],
          [],
        );

        // Reset the db state
        txn.abandonChanges();

        // make sure deleteElements throws for invalid Ids
        assert.throws(() => txn.deleteElements([Id64.invalid, Id64.invalid]));

        // deleteElement/deleteElements for a used GeometryPart should fail
        assert.throws(() => txn.deleteElement(geometryPartId));
        expectDelete([geometryPartId], partialSuccess(definitionInUse(geometryPartId)), [], [geometryPartId]);

        // deleteElements for an unused GeometryPart should succeed, delete should still fail
        const unusedGeometryPartProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: GeometryPart.createCode(iModelDb, definitionModelId, "Unused GeometryPart"),
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        // Reset the db state
        txn.abandonChanges();
        const unusedGeometryPartId = txn.insertElement(unusedGeometryPartProps);
        assert.isTrue(Id64.isValidId64(unusedGeometryPartId));
        assert.throws(() => txn.deleteElement(unusedGeometryPartId));
        expectDelete([unusedGeometryPartId], success, [unusedGeometryPartId], []);
        txn.abandonChanges();

        // deleteElement/deleteElements for a used RenderMaterial should fail
        assert.throws(() => txn.deleteElement(renderMaterialId));
        expectDelete([renderMaterialId], partialSuccess(definitionInUse(renderMaterialId)), [], [renderMaterialId]);
        txn.abandonChanges();

        // deleteElements for an unused RenderMaterial should succeed, delete should still fail
        const unusedRenderMaterialId = RenderMaterialElement.insert(txn, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
        assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
        assert.throws(() => txn.deleteElement(unusedRenderMaterialId));
        expectDelete([unusedRenderMaterialId], success, [unusedRenderMaterialId], []);
        txn.abandonChanges();

        // deleteElement/deleteElements for a used Texture should fail
        assert.throws(() => txn.deleteElement(textureId));
        expectDelete([textureId], partialSuccess(definitionInUse(textureId)), [], [textureId]);
        txn.abandonChanges();

        // deleteElements for an unused Texture should succeed, delete should still fail
        const unusedTextureId = IModelTestUtils.insertTextureElement(txn, definitionModelId, "Unused Texture");
        assert.isTrue(Id64.isValidId64(unusedTextureId));
        assert.throws(() => txn.deleteElement(unusedTextureId));
        expectDelete([unusedTextureId], success, [unusedTextureId], []);
        txn.abandonChanges();

        // deleteElement/deleteElements for a used SpatialCategory should fail (hard FK from GeometricElement3d.CategoryId, so not DefinitionInUse)
        assert.throws(() => txn.deleteElement(spatialCategoryId));
        expectDelete([spatialCategoryId], partialSuccess(categoryInUse3d(spatialCategoryId)), [], [spatialCategoryId]);
        txn.abandonChanges();

        // deleteElement/deleteElements for a default SubCategory should fail
        const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
        const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
        assert.throws(() => txn.deleteElement(defaultSpatialSubCategoryId));
        expectDelete([defaultSpatialSubCategoryId], partialSuccess(definitionInUse(defaultSpatialSubCategoryId)), [], [defaultSpatialSubCategoryId]);
        txn.abandonChanges();

        // deleteElement/deleteElements for a used, non-default SubCategory should fail
        assert.throws(() => txn.deleteElement(subCategoryId));
        expectDelete([subCategoryId], partialSuccess(definitionInUse(subCategoryId)), [], [subCategoryId]);
        txn.abandonChanges();

        // deleteElements for an unused SubCategory should succeed, delete should still fail
        const unusedSubCategoryId = SubCategory.insert(txn, spatialCategoryId, "Unused SubCategory", {});
        assert.isTrue(Id64.isValidId64(unusedSubCategoryId));
        assert.throws(() => txn.deleteElement(unusedSubCategoryId));
        expectDelete([unusedSubCategoryId], success, [unusedSubCategoryId], []);
        txn.abandonChanges();

        // deleteElements for an unused SpatialCategory should succeed, delete should still fail
        const unusedSpatialCategoryId = SpatialCategory.insert(txn, definitionModelId, "Unused SpatialCategory", {});
        assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
        const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
        const unusedSpatialCategoryDefaultSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
        assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
        assert.throws(() => txn.deleteElement(unusedSpatialCategoryId));
        assert.throws(() => txn.deleteElement(unusedSpatialCategoryDefaultSubCategoryId));
        expectDelete([unusedSpatialCategoryId], success, [unusedSpatialCategoryId, unusedSpatialCategoryDefaultSubCategoryId], []);
        txn.abandonChanges();

        // deleteElement/deleteElements of a used DrawingCategory should fail (hard FK from GeometricElement2d.CategoryId, so not DefinitionInUse)
        assert.throws(() => txn.deleteElement(drawingCategoryId));
        expectDelete([drawingCategoryId], partialSuccess(categoryInUse2d(drawingCategoryId)), [], [drawingCategoryId]);
        txn.abandonChanges();

        // deleteElements for an unused DrawingCategory should succeed, delete should still fail
        const unusedDrawingCategoryId = DrawingCategory.insert(txn, definitionModelId, "Unused DrawingCategory", {});
        assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
        const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
        const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
        assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
        assert.throws(() => txn.deleteElement(unusedDrawingSubCategoryId));
        expectDelete([unusedDrawingCategoryId], success, [unusedDrawingCategoryId, unusedDrawingSubCategoryId], []);
        txn.abandonChanges();

        // deleteElement/deleteElements of DefinitionElements used by an existing SpatialViewDefinition should fail
        assert.throws(() => txn.deleteElement(spatialCategorySelectorId));
        assert.throws(() => txn.deleteElement(modelSelectorId));
        assert.throws(() => txn.deleteElement(displayStyle3dId));
        expectDelete(
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          partialSuccess(definitionInUse(spatialCategorySelectorId), definitionInUse(modelSelectorId), definitionInUse(displayStyle3dId)),
          [],
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId, viewId],
        );
        txn.abandonChanges();

        // deleteElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
        assert.throws(() => txn.deleteElement(viewId));
        expectDelete(
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          success,
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [],
        );
        txn.abandonChanges();

        // deleteElement/deleteElements of DefinitionElements used by an existing DrawingViewDefinition should fail
        assert.throws(() => txn.deleteElement(drawingCategorySelectorId));
        assert.throws(() => txn.deleteElement(displayStyle2dId));
        expectDelete(
          [drawingCategorySelectorId, displayStyle2dId],
          partialSuccess(definitionInUse(drawingCategorySelectorId), definitionInUse(displayStyle2dId)),
          [],
          [drawingCategorySelectorId, displayStyle2dId, drawingViewId],
        );
        txn.abandonChanges();

        // deleteElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
        assert.throws(() => txn.deleteElement(drawingViewId));
        expectDelete(
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          success,
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          [],
        );
      } finally {
        if (txn.isActive)
          txn.end("abandon");
      }
    });

    it("a Subject is BlockedByRelative when a definition beneath it is used from outside its subtree", () => {
      const txn = new EditTxn(iModelDb, "delete subject with outside user");
      txn.start();
      try {
        // A PhysicalObject in a model that is NOT under the Subject uses the SpatialCategory. The category is a hard FK violator
        // (bis_GeometricElement3d.CategoryId, so ReferencedByForeignKey rather than DefinitionInUse; its default SubCategory is
        // implied and not reported separately) and the requested Subject is BlockedByRelative; nothing under the Subject is deleted.
        // The requested PhysicalObjects are unaffected and are deleted.
        const outsideModelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "OutsideSubject");
        const outsideUserProps: PhysicalElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: outsideModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: Point3d.create(0, 0, 0).toJSON(), angles: {} },
        };
        const outsideUserId = txn.insertElement(outsideUserProps);
        txn.saveChanges();

        executeTestCase(
          txn,
          "subject blocked by outside user of its category",
          [physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId],
          [physicalObjectId1, physicalObjectId2, physicalObjectId3],
          partialSuccess(categoryInUse3d(spatialCategoryId), blockedByRelative(subjectId, spatialCategoryId)),
          [subjectId, definitionModelId, physicalModelId, spatialCategoryId, IModel.getDefaultSubCategoryId(spatialCategoryId), outsideUserId],
        );
      } finally {
        if (txn.isActive)
          txn.end("abandon");
      }
    });

    describe("basic tests", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "delete Definition Elements");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      it("deletes a single unused definition element", () => {
        const element = insertDefinitionElement(txn);
        executeTestCase(txn, "single unused definition element", [element], [element], success, []);
      });

      it("deletes multiple unused definition elements in one call", () => {
        const element1 = insertDefinitionElement(txn);
        const element2 = insertDefinitionElement(txn);
        const element3 = insertDefinitionElement(txn);
        executeTestCase(txn, "multiple unused definition elements", [element1, element2, element3], [element1, element2, element3], success, []);
      });

      it("returns a Success result when given an empty array", () => {
        executeTestCase(txn, "empty input", [], [], success, []);
      });

      it("throws for invalid ids", () => {
        assert.throws(() => txn.deleteElements([Id64.invalid, Id64.invalid]));
      });

      it("reports an in-use definition element as a failure and does not delete it", () => {
        // geometryPartId is referenced by PhysicalObject1's geometry stream
        executeTestCase(txn, "in-use GeometryPart", [geometryPartId], [], partialSuccess(definitionInUse(geometryPartId)), [geometryPartId]);
      });

      it("reports only the in-use definition element as a failure when mixing used and unused parts", () => {
        const unusedElement = insertDefinitionElement(txn);
        const usedElement = insertDefinitionElement(txn);

        // Reference usedElement from a physical element geometry stream
        const physElemProps: PhysicalElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: Point3d.create(0, 0, 0).toJSON(), angles: {} },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedElement),
        };
        const physElemId = txn.insertElement(physElemProps);

        executeTestCase(
          txn,
          "used + unused definition elements",
          [unusedElement, usedElement],
          [unusedElement],
          partialSuccess(definitionInUse(usedElement)),
          [usedElement, physElemId],
        );
      });

      it("reports an in-use RenderMaterial as a failure and does not delete it", () => {
        executeTestCase(txn, "in-use RenderMaterial", [renderMaterialId], [], partialSuccess(definitionInUse(renderMaterialId)), [renderMaterialId]);
      });

      it("deletes an unused RenderMaterial", () => {
        const unusedRenderMaterialId = RenderMaterialElement.insert(txn, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
        executeTestCase(txn, "unused RenderMaterial", [unusedRenderMaterialId], [unusedRenderMaterialId], success, []);
      });

      it("reports an in-use Texture as a failure and does not delete it", () => {
        executeTestCase(txn, "in-use Texture", [textureId], [], partialSuccess(definitionInUse(textureId)), [textureId]);
      });

      it("deletes an unused Texture", () => {
        const unusedTextureId = IModelTestUtils.insertTextureElement(txn, definitionModelId, "Unused Texture");
        executeTestCase(txn, "unused Texture", [unusedTextureId], [unusedTextureId], success, []);
      });

      it("reports every element as a failure when all are in-use definition elements", () => {
        const usedElement1 = insertDefinitionElement(txn);
        const usedElement2 = insertDefinitionElement(txn);
        const usedElement3 = insertDefinitionElement(txn);

        // Reference usedElements from a physical element geometry stream
        const physElemProps: PhysicalElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: Point3d.create(0, 0, 0).toJSON(), angles: {} },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedElement1),
        };
        assert.isTrue(Id64.isValid(txn.insertElement(physElemProps)));
        physElemProps.geom = IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedElement2);
        assert.isTrue(Id64.isValid(txn.insertElement(physElemProps)));
        physElemProps.geom = IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedElement3);
        assert.isTrue(Id64.isValid(txn.insertElement(physElemProps)));

        // Every requested element was skipped - that is still PartialSuccess in the default mode, not an error.
        executeTestCase(
          txn,
          "all in-use",
          [usedElement1, usedElement2, usedElement3],
          [],
          partialSuccess(definitionInUse(usedElement1), definitionInUse(usedElement2), definitionInUse(usedElement3)),
          [usedElement1, usedElement2, usedElement3],
        );
      });

      it("a definition used only by elements inside the delete set is not DefinitionInUse", () => {
        const insertPhysicalObject = (model: Id64String, category: Id64String): Id64String => {
          const props: PhysicalElementProps = {
            classFullName: "Generic:PhysicalObject",
            model,
            category,
            code: Code.createEmpty(),
            placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          };
          return txn.insertElement(props);
        };

        // Case 1: the only user of the category is requested directly.
        const directCategory = SpatialCategory.insert(txn, definitionModelId, "DirectUserCategory", new SubCategoryAppearance());
        const directUser = insertPhysicalObject(physicalModelId, directCategory);

        // Case 2: the only user of the category lives in a sub-model that is reached through the partition cascade, i.e. it is in the
        // *expanded* delete set but not in the requested ids.
        const cascadeCategory = SpatialCategory.insert(txn, definitionModelId, "CascadeUserCategory", new SubCategoryAppearance());
        const partitionId = PhysicalModel.insert(txn, subjectId, "CascadeUserModel");
        const cascadeUser = insertPhysicalObject(partitionId, cascadeCategory);
        txn.saveChanges();

        const directSubCategory = IModel.getDefaultSubCategoryId(directCategory);
        const cascadeSubCategory = IModel.getDefaultSubCategoryId(cascadeCategory);

        /** Like `executeTestCase` but with an explicit `deleteMode`. Rolls back afterwards. */
        const expectSuccess = (deleteMode: BulkDeleteMode, idsToDelete: Id64Array, deletedIds: Id64Array, retainedIds: Id64Array) => {
          assertResult(txn.deleteElements(idsToDelete, { deleteMode }), success, deletedIds, retainedIds, iModelDb);
          txn.abandonChanges();
        };

        for (const deleteMode of [BulkDeleteMode.RemoveFKViolators, BulkDeleteMode.FailFast]) {
          expectSuccess(deleteMode, [directCategory, directUser], [directCategory, directSubCategory, directUser], [cascadeCategory, cascadeSubCategory, cascadeUser]);
          expectSuccess(deleteMode, [cascadeCategory, partitionId], [cascadeCategory, cascadeSubCategory, partitionId, cascadeUser], [directCategory, directSubCategory, directUser]);
        }
      });
    });

    describe("category and subcategory tests", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "delete Definition Elements");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      it("reports an in-use SpatialCategory as an FK violator and does not delete it", () => {
        executeTestCase(txn, "in-use SpatialCategory", [spatialCategoryId], [], partialSuccess(categoryInUse3d(spatialCategoryId)), [spatialCategoryId]);
      });

      it("reports the default SubCategory as a failure when its parent SpatialCategory is in use", () => {
        const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
        const defaultSubCategoryId = spatialCategory.myDefaultSubCategoryId();
        executeTestCase(txn, "default SubCategory", [defaultSubCategoryId], [], partialSuccess(definitionInUse(defaultSubCategoryId)), [defaultSubCategoryId]);
      });

      it("reports a used non-default SubCategory as a failure and does not delete it", () => {
        executeTestCase(txn, "in-use SubCategory", [subCategoryId], [], partialSuccess(definitionInUse(subCategoryId)), [subCategoryId]);
      });

      it("deletes an unused non-default SubCategory", () => {
        const unusedSubCategoryId = SubCategory.insert(txn, spatialCategoryId, "Unused SubCategory", {});
        executeTestCase(txn, "unused SubCategory", [unusedSubCategoryId], [unusedSubCategoryId], success, [spatialCategoryId]);
      });

      it("deletes an unused SpatialCategory together with its default SubCategory", () => {
        const unusedCategoryId = SpatialCategory.insert(txn, definitionModelId, "Unused SpatialCategory", {});
        const unusedCategory = iModelDb.elements.getElement<SpatialCategory>(unusedCategoryId, SpatialCategory);
        const unusedDefaultSubCategoryId = unusedCategory.myDefaultSubCategoryId();

        executeTestCase(
          txn,
          "unused SpatialCategory + default SubCategory",
          [unusedCategoryId],
          [unusedCategoryId, unusedDefaultSubCategoryId],
          success,
          [],
        );
      });

      it("deletes an unused DrawingCategory together with its default SubCategory", () => {
        const unusedDrawingCategoryId = DrawingCategory.insert(txn, definitionModelId, "Unused DrawingCategory", {});
        const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
        const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();

        executeTestCase(
          txn,
          "unused DrawingCategory + default SubCategory",
          [unusedDrawingCategoryId],
          [unusedDrawingCategoryId, unusedDrawingSubCategoryId],
          success,
          [],
        );
      });

      it("reports CategorySelector, ModelSelector, DisplayStyle3d as failures when their view still exists", () => {
        executeTestCase(
          txn,
          "view-related still referenced",
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [],
          partialSuccess(definitionInUse(spatialCategorySelectorId), definitionInUse(modelSelectorId), definitionInUse(displayStyle3dId)),
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId, viewId],
        );
      });

      it("deletes CategorySelector, ModelSelector, DisplayStyle3d and the SpatialViewDefinition in one call", () => {
        executeTestCase(
          txn,
          "view + view-related",
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          success,
          [],
        );
      });

      it("deletes DrawingCategorySelector, DisplayStyle2d and the DrawingViewDefinition in one call", () => {
        executeTestCase(
          txn,
          "drawing view + drawing view-related",
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          success,
          [],
        );
      });

      it("deletes orphaned CategorySelector and DisplayStyle2d (no view references them)", () => {
        // Insert a standalone CategorySelector and DisplayStyle2d that are not referenced by any view
        const orphanCategorySelectorId = CategorySelector.insert(txn, definitionModelId, "OrphanCategorySelector", [drawingCategoryId]);
        const orphanDisplayStyle2dId = DisplayStyle2d.insert(txn, definitionModelId, "OrphanDisplayStyle2d");

        executeTestCase(
          txn,
          "orphaned view-related elements",
          [orphanCategorySelectorId, orphanDisplayStyle2dId],
          [orphanCategorySelectorId, orphanDisplayStyle2dId],
          success,
          [],
        );
      });
    });

    describe("Element hierarchy", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "test");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      it("deletes a parent DefinitionElement and automatically deletes its child", () => {
        const parentPart = insertDefinitionElement(txn);
        const childPart = insertDefinitionElement(txn, parentPart);

        // Only pass the parent - the child must be pulled in automatically
        executeTestCase(
          txn,
          "parent + child definition elements",
          [parentPart],
          [parentPart, childPart],
          success,
          [],
        );
      });

      it("deletes a parent DefinitionElement and its child explicitly passed", () => {
        const parentPart = insertDefinitionElement(txn);
        const childPart = insertDefinitionElement(txn, parentPart);

        // Pass both parent and child explicitly
        executeTestCase(
          txn,
          "parent + child definition elements",
          [parentPart, childPart],
          [parentPart, childPart],
          success,
          [],
        );
      });

      // Intra-set code scope
      // Both partA and partB are in the input set; partB uses partA as its CodeScope.
      // The old implementation would fail here because partA's deletion was blocked by partB's
      // code scope reference. The new native API resolves all intra-set dependencies first.
      it("deletes two DefinitionElements related by code scope when both are in the same set", () => {
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "DefElemScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const partA = insertDefinitionElement(txn);
        const partBProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: { spec: scopeSpecId, scope: partA, value: "partB-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const partB = txn.insertElement(partBProps);

        // Both unused externally; the intra-set code-scope link must not block deletion
        executeTestCase(txn, "intra-set code scope", [partA, partB], [partA, partB], success, []);
      });

      // Multi-level parent-child hierarchy
      // Passing only the root must automatically pull in all descendants (leaf-first).
      // The old implementation deleted elements in a fixed ECClass order and could not handle
      // arbitrary parent-child chains within the set.
      it("deletes a 3-level parent-child hierarchy by passing only the root", () => {
        const root = insertDefinitionElement(txn);
        const child = insertDefinitionElement(txn, root);
        const grandchild = insertDefinitionElement(txn, child);

        // Only supply the root - all descendants must be included and deleted leaf-first
        executeTestCase(txn, "3-level hierarchy via root only", [root], [root, child, grandchild], success, []);
      });

      it("deletes a 3-level parent-child hierarchy by passing all elements explicitly", () => {
        const root = insertDefinitionElement(txn);
        const child = insertDefinitionElement(txn, root);
        const grandchild = insertDefinitionElement(txn, child);

        // Pass all elements explicitly
        executeTestCase(
          txn,
          "3-level hierarchy with all elements",
          [root, child, grandchild],
          [root, child, grandchild],
          success,
          [],
        );
      });

      // Mixed inputs
      it("deletes a mixed batch of unused DefinitionElements of different types in one call", () => {
        const unusedPart = insertDefinitionElement(txn);
        const unusedRenderMaterial = RenderMaterialElement.insert(txn, definitionModelId, "BatchRenderMaterial", { paletteName: "P" });
        const unusedTexture = IModelTestUtils.insertTextureElement(txn, definitionModelId, "BatchTexture");
        const unusedSubCategory = SubCategory.insert(txn, spatialCategoryId, "BatchSubCategory", {});

        executeTestCase(
          txn,
          "mixed unused batch",
          [unusedPart, unusedRenderMaterial, unusedTexture, unusedSubCategory],
          [unusedPart, unusedRenderMaterial, unusedTexture, unusedSubCategory],
          success,
          [],
        );
      });

      // Mixed inputs with intra scope violations and parent child hierarchies
      it("deletes a mixed batch of used and unused DefinitionElements in a hierarchy with conflicting code scopes with child", () => {
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "DefElemScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const usedPart = insertDefinitionElement(txn);
        const unusedPart = insertDefinitionElement(txn);
        const childPart = insertDefinitionElement(txn, usedPart);

        const scopedPartProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: { spec: scopeSpecId, scope: childPart, value: "scopedPart-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const scopedPart = txn.insertElement(scopedPartProps);

        // Pass both used and unused parts, with a child that has a code scope reference
        executeTestCase(
          txn,
          "mixed used and unused batch",
          [usedPart, unusedPart, scopedPart],
          [usedPart, unusedPart, childPart, scopedPart],
          success,
          [],
        );
      });

      // Mixed inputs with intra scope violations and parent child hierarchies
      it("deletes a mixed batch of used and unused DefinitionElements in a hierarchy with conflicting code scopes", () => {
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "DefElemScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const usedPart = insertDefinitionElement(txn);
        const unusedPart = insertDefinitionElement(txn);
        const childPart = insertDefinitionElement(txn, usedPart);

        const scopedPartProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: { spec: scopeSpecId, scope: usedPart, value: "scopedPart-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const scopedPart = txn.insertElement(scopedPartProps);

        // Pass both used and unused parts; usedPart is the code scope of scopedPart (outside the set) so it is a direct FK violator.
        executeTestCase(
          txn,
          "mixed used and unused batch",
          [usedPart, unusedPart],
          [unusedPart],
          partialSuccess(codeScopeViolator(usedPart)),
          [usedPart, childPart, scopedPart],
        );
      });
    });

    describe("sub-model hierarchy", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "test");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      let containerCounter = 0;

      const insertDefinitionContainer = (parentModelId?: Id64String): Id64String => {
        const scopeModelId = parentModelId ?? definitionModelId;
        const codeSpecId = iModelDb.codeSpecs.insert(txn, `ContainerCodeSpec_${++containerCounter}`, CodeScopeSpec.Type.Model);
        const code = new Code({ spec: codeSpecId, scope: scopeModelId, value: `Container_${containerCounter}` });
        return DefinitionContainer.insert(txn, scopeModelId, code);
      };

      /** Assert that the model row has been deleted. */
      const assertModelDeleted = (id: Id64String, msg: string) =>
        assert.isUndefined(iModelDb.models.tryGetModelProps(id), msg);

      /** Assert that the model row still exists. */
      const assertModelExists = (id: Id64String, msg: string) =>
        assert.isDefined(iModelDb.models.tryGetModelProps(id), msg);

      it("deletes unused definition elements from a DefinitionContainer", () => {
        const containerId = insertDefinitionContainer();
        const partA = insertDefinitionElement(txn, undefined, containerId);
        const partB = insertDefinitionElement(txn, undefined, containerId);

        executeTestCase(
          txn,
          "unused elements in container sub-model",
          [partA, partB],
          [partA, partB],
          success,
          [],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer must survive when container is not in the input set");
      });

      it("deletes a DefinitionContainer and all definition elements inside it", () => {
        const containerId = insertDefinitionContainer();
        const defElem1 = insertDefinitionElement(txn, undefined, containerId);
        const defElem2 = insertDefinitionElement(txn, undefined, containerId);

        executeTestCase(
          txn,
          "container + sub-model contents deleted via container id",
          [containerId],
          [containerId, defElem1, defElem2],
          success,
          [],
        );
        // Sub-model row is deleted once the container element is successfully purged.
        assertModelDeleted(containerId, "DefinitionModel sub-model row must be deleted after container is purged");
      });

      it("reports an in-use element inside a DefinitionContainer sub-model as a failure", () => {
        const containerId = insertDefinitionContainer();
        const usedPart = insertDefinitionElement(txn, undefined, containerId);
        const unusedPart = insertDefinitionElement(txn, undefined, containerId);
        // Reference usedPart from a physical element geometry stream.
        const physElemProps: PhysicalElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, usedPart),
        };
        const physElemId = txn.insertElement(physElemProps);

        executeTestCase(
          txn,
          "one used + one unused in container sub-model",
          [usedPart, unusedPart],
          [unusedPart],
          partialSuccess(definitionInUse(usedPart)),
          [usedPart, physElemId],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when an element inside it is blocked");
      });

      it("parent reported as a failure when its child inside a DefinitionContainer sub-model is in use", () => {
        const containerId = insertDefinitionContainer();
        const parent = insertDefinitionElement(txn, undefined, containerId);
        const child = insertDefinitionElement(txn, parent, containerId);
        // Reference child from a physical element geometry stream.
        const physElemProps: PhysicalElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, child),
        };
        const physElemId = txn.insertElement(physElemProps);

        // child (pulled into the set via parent) is a DefinitionInUse violator, which blocks the requested parent.
        executeTestCase(
          txn,
          "parent blocked when child inside container sub-model is in use",
          [parent],
          [],
          partialSuccess(definitionInUse(child), blockedByRelative(parent, child)),
          [parent, child, physElemId],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when elements inside it are blocked");
      });

      it("deletes two elements inside a DefinitionContainer sub-model related by intra-delete-set code scope", () => {
        const containerId = insertDefinitionContainer();
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "NestedDefScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const partA = insertDefinitionElement(txn, undefined, containerId);
        const partBProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: containerId,
          code: { spec: scopeSpecId, scope: partA, value: "partB-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const partB = txn.insertElement(partBProps);

        executeTestCase(
          txn,
          "intra-set code scope in container sub-model",
          [partA, partB],
          [partA, partB],
          success,
          [],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when container is not in the input set");
      });

      it("element inside a DefinitionContainer sub-model blocked when used as external code scope", () => {
        const containerId = insertDefinitionContainer();
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "ExtScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const partA = insertDefinitionElement(txn, undefined, containerId);
        const partB = insertDefinitionElement(txn, undefined, containerId);
        // external lives in the top-level definition model — scoped to partA but NOT in the input set.
        const externalProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: { spec: scopeSpecId, scope: partA, value: "external-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const externalId = txn.insertElement(externalProps);

        executeTestCase(
          txn,
          "external code scope blocks element inside container sub-model",
          [partA, partB],
          [partB],
          partialSuccess(codeScopeViolator(partA)),
          [partA, externalId],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when an element inside it is blocked");
      });

      it("cross-container intra-set code scope: both elements deleted cleanly", () => {
        const container1 = insertDefinitionContainer();
        const container2 = insertDefinitionContainer();
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "CrossModelScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const partA = insertDefinitionElement(txn, undefined, container1);
        const partBProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: container2,
          code: { spec: scopeSpecId, scope: partA, value: "partB-code" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        };
        const partB = txn.insertElement(partBProps);

        executeTestCase(
          txn,
          "cross-container intra-set code scope",
          [partA, partB],
          [partA, partB],
          success,
          [],
          false,
        );
        assertModelExists(container1, "container1 sub-model row must survive when container is not in the input set");
        assertModelExists(container2, "container2 sub-model row must survive when container is not in the input set");
      });

      it("mixed elements where in-use ones get blocked/ignored, unused get deleted", () => {
        const containerId = insertDefinitionContainer();
        const topUnused = insertDefinitionElement(txn, undefined, definitionModelId);
        const topUsed = insertDefinitionElement(txn, undefined, definitionModelId);
        const nestedUnused = insertDefinitionElement(txn, undefined, containerId);
        const nestedUsed = insertDefinitionElement(txn, undefined, containerId);

        const makeUser = (partId: Id64String): Id64String => {
          const props: PhysicalElementProps = {
            classFullName: "Generic:PhysicalObject",
            model: physicalModelId,
            category: spatialCategoryId,
            code: Code.createEmpty(),
            placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
            geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, partId),
          };
          return txn.insertElement(props);
        };

        const topUsedPhysElem = makeUser(topUsed);
        const nestedUsedPhysElem = makeUser(nestedUsed);

        executeTestCase(
          txn,
          "mixed top-level and container sub-model: used blocked, unused deleted",
          [topUnused, topUsed, nestedUnused, nestedUsed],
          [topUnused, nestedUnused],
          partialSuccess(definitionInUse(topUsed), definitionInUse(nestedUsed)),
          [topUsed, nestedUsed, topUsedPhysElem, nestedUsedPhysElem],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when an element inside it is blocked");
      });
    });

    describe("definition and its users deleted together", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "delete definition + users");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      const insertPhysicalObject = (opts: { categoryId?: Id64String, subCategoryId?: Id64String, renderMaterialId?: Id64String, geometryPartId?: Id64String } = {}): Id64String => {
        const category = opts.categoryId ?? spatialCategoryId;
        // A material is only recorded in the geometry stream together with a sub-category.
        const subCategory = opts.subCategoryId ?? (opts.renderMaterialId ? IModel.getDefaultSubCategoryId(category) : undefined);
        return txn.insertElement({
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category,
          code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), category, subCategory, opts.renderMaterialId, opts.geometryPartId),
        } as PhysicalElementProps);
      };

      it("a GeometryPart with two users is still in use when only one user is in the delete set", () => {
        const part = insertDefinitionElement(txn);
        const user1 = insertPhysicalObject({ geometryPartId: part });
        const user2 = insertPhysicalObject({ geometryPartId: part });
        executeTestCase(txn, "part + one of two users", [part, user1], [user1], partialSuccess(definitionInUse(part)), [part, user2]);
      });

      it("a DisplayStyle shared by two views is reported in use when only one view is in the delete set", () => {
        const categorySelectorB = CategorySelector.insert(txn, definitionModelId, "CategorySelectorB", [spatialCategoryId]);
        const modelSelectorB = ModelSelector.insert(txn, definitionModelId, "ModelSelectorB", [physicalModelId]);
        const viewB = OrthographicViewDefinition.insert(txn, definitionModelId, "ViewB", modelSelectorB, categorySelectorB, displayStyle3dId, new Range3d(0, 0, 0, 1, 1, 1));

        executeTestCase(
          txn,
          "view A + its selectors + shared style",
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [viewId, spatialCategorySelectorId, modelSelectorId],
          partialSuccess(definitionInUse(displayStyle3dId)),
          [displayStyle3dId, viewB, categorySelectorB, modelSelectorB],
          false,
        );

        // Deleting both views releases the shared style.
        txn.abandonChanges();
        executeTestCase(
          txn,
          "both views + everything they reference",
          [viewId, viewB, spatialCategorySelectorId, modelSelectorId, categorySelectorB, modelSelectorB, displayStyle3dId],
          [viewId, viewB, spatialCategorySelectorId, modelSelectorId, categorySelectorB, modelSelectorB, displayStyle3dId],
          success,
          [],
        );
      });

      it("an element is reported once per referencing foreign key", () => {
        // A fresh category used by a physical object (CategoryId FK) AND used as the Code scope of a GeometryPart (CodeScopeId FK).
        const category = SpatialCategory.insert(txn, definitionModelId, "DoublyReferencedCategory", {});
        const user = insertPhysicalObject({ categoryId: category });
        const scopeSpecId = iModelDb.codeSpecs.insert(txn, "CategoryScopedSpec", CodeScopeSpec.Type.RelatedElement);
        const scopedPart = txn.insertElement({
          classFullName: GeometryPart.classFullName,
          model: definitionModelId,
          code: { spec: scopeSpecId, scope: category, value: "scoped-part" },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        } as GeometryPartProps);

        executeTestCase(
          txn,
          "two FKs on one element",
          [category],
          [],
          partialSuccess(codeScopeViolator(category)),
          [category, user, scopedPart],
        );
      });
    });

    describe("delete modes with definition elements", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "delete modes");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      const constraintViolation = (...failures: BulkDeleteFailure[]): ExpectedResult => ({ status: BulkDeleteElementsStatus.ConstraintViolation, failures });

      /**
       * In FailFast mode nothing is pruned between the FK pass and the definition-usage pass, so the used SpatialCategory is reported
       * twice (hard FK + usage) and its used non-default SubCategories (pulled into the set as children) are reported as well.
       * In RemoveFKViolators mode the category's subtree is pruned after the FK pass, so only `categoryInUse3d` is reported there.
       */
      const usedSpatialCategoryViolations = (): BulkDeleteFailure[] => [
        categoryInUse3d(spatialCategoryId),
        definitionInUse(subCategoryId),
        definitionInUse(filteredSubCategoryId),
      ];

      it("FailFast treats DefinitionInUse as a constraint violation and deletes nothing", () => {
        const unusedPart = insertDefinitionElement(txn);
        const result = txn.deleteElements([geometryPartId, unusedPart], { deleteMode: BulkDeleteMode.FailFast });
        assertResult(result, constraintViolation(definitionInUse(geometryPartId)), [], [geometryPartId, unusedPart], iModelDb);
      });

      it("FailFast treats a used Category as a constraint violation and reports every violator in the expanded set", () => {
        const unusedPart = insertDefinitionElement(txn);
        const result = txn.deleteElements([spatialCategoryId, unusedPart], { deleteMode: BulkDeleteMode.FailFast });
        assertResult(result, constraintViolation(...usedSpatialCategoryViolations()), [], [spatialCategoryId, subCategoryId, filteredSubCategoryId, unusedPart], iModelDb);
      });

      it("FailFast reports the in-use child and the blocked parent when the violator is a cascaded child", () => {
        const parent = insertDefinitionElement(txn);
        const child = insertDefinitionElement(txn, parent);
        const user = txn.insertElement({
          classFullName: "Generic:PhysicalObject",
          model: physicalModelId,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, undefined, undefined, child),
        } as PhysicalElementProps);
        const result = txn.deleteElements([parent], { deleteMode: BulkDeleteMode.FailFast });
        assertResult(result, constraintViolation(definitionInUse(child), blockedByRelative(parent, child)), [], [parent, child, user], iModelDb);
      });

      it("deprecated skipFKConstraintValidations: true behaves like FailFast and still detects DefinitionInUse", () => {
        // There is no way to bypass the definition usage check: geometry-stream references are not SQLite foreign keys, so
        // skipping validation would silently leave dangling references. The deprecated flag therefore maps to FailFast.
        const unusedPart = insertDefinitionElement(txn);
        const result = txn.deleteElements([geometryPartId, unusedPart], { skipFKConstraintValidations: true });
        assertResult(result, constraintViolation(definitionInUse(geometryPartId)), [], [geometryPartId, unusedPart], iModelDb);
      });

      it("FailFast ConstraintViolation for a used Category (hard FK) leaves the txn clean", () => {
        const result = txn.deleteElements([spatialCategoryId], { deleteMode: BulkDeleteMode.FailFast });
        assertResult(result, constraintViolation(...usedSpatialCategoryViolations()), [], [spatialCategoryId], iModelDb);
        assert.isFalse(iModelDb[_nativeDb].hasUnsavedChanges(), "a rejected FailFast delete must not dirty the txn");
      });
    });

    describe("cache coherence for cascaded definition elements", () => {
      let txn: EditTxn;
      beforeEach(() => {
        txn = new EditTxn(iModelDb, "cache");
        txn.start();
      });
      afterEach(() => {
        txn.end("abandon");
      });

      it("a cached default SubCategory is not readable after its Category is deleted", () => {
        const category = SpatialCategory.insert(txn, definitionModelId, "CachedCategory", {});
        const defaultSubCategory = iModelDb.elements.getElement<SpatialCategory>(category, SpatialCategory).myDefaultSubCategoryId();
        assert.isDefined(iModelDb.elements.getElement(defaultSubCategory)); // prime the cache

        executeTestCase(txn, "category with cached default subcategory", [category], [category, defaultSubCategory], success, [], false);
        assert.isUndefined(iModelDb.elements.tryGetElementProps(defaultSubCategory), "cached default SubCategory props must not be served after deletion");
      });

      it("cached contents of a deleted DefinitionContainer are not readable afterwards", () => {
        const codeSpecId = iModelDb.codeSpecs.insert(txn, "CachedContainerSpec", CodeScopeSpec.Type.Model);
        const containerId = DefinitionContainer.insert(txn, definitionModelId, new Code({ spec: codeSpecId, scope: definitionModelId, value: "CachedContainer" }));
        const inner = insertDefinitionElement(txn, undefined, containerId);
        assert.isDefined(iModelDb.elements.getElement(inner));
        assert.isDefined(iModelDb.models.getModelProps(containerId));

        executeTestCase(txn, "container with cached contents", [containerId], [containerId, inner], success, [], false);
        assert.isUndefined(iModelDb.elements.tryGetElementProps(inner));
        assert.isUndefined(iModelDb.models.tryGetModelProps(containerId));
      });
    });
  });

  describe("TypeDefinition reference nulling", () => {
    let typeDefModelId: Id64String;
    let typeDefCounter = 0;
    let txn: EditTxn;

    beforeEach(() => {
      txn = new EditTxn(iModelDb, "delete Definition Elements");
      txn.start();
      typeDefModelId = DefinitionModel.insert(txn, subjectId, `TypeDefModel-${++typeDefCounter}`);
    });

    afterEach(() => {
      txn.end("abandon");
    });

    const insertPhysicalType = (): Id64String => {
      const props: PhysicalTypeProps = {
        classFullName: GenericPhysicalType.classFullName,
        model: typeDefModelId,
        code: Code.createEmpty(),
      };
      return txn.insertElement(props);
    };

    const insertPhysicalObjectWithType = (typeId: Id64String): Id64String => {
      const props: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: physicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: {} },
        typeDefinition: new PhysicalElementIsOfType(typeId),
      };
      return txn.insertElement(props);
    };

    /** Returns the TypeDefinitionId for a 3D element, or undefined if NULL. */
    const getTypeDefinitionId3d = (elementId: Id64String): Id64String | undefined => {
      return iModelDb.withQueryReader(
        "SELECT TypeDefinition FROM bis.GeometricElement3d WHERE ECInstanceId=?",
        (reader) => reader.step() ? reader.current[0]?.id : undefined,
        QueryBinder.from([elementId]),
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );
    };

    it("TypeDefinitionId is NULLed on a surviving 3D element when its PhysicalType is deleted", () => {
      const physTypeId = insertPhysicalType();
      const physObjId = insertPhysicalObjectWithType(physTypeId);

      assert.strictEqual(getTypeDefinitionId3d(physObjId), physTypeId, "TypeDefinitionId should be set before deletion");

      txn.deleteElements([physTypeId]);

      assert.isUndefined(iModelDb.elements.tryGetElement(physTypeId), "PhysicalType should be deleted");
      assert.isDefined(iModelDb.elements.tryGetElement(physObjId), "PhysicalObject should survive");
      assert.isUndefined(getTypeDefinitionId3d(physObjId), "TypeDefinitionId should be NULL after its target type is deleted");
    });

    it("TypeDefinitionId is NULLed on multiple surviving 3D elements when their shared PhysicalType is deleted", () => {
      const physTypeId = insertPhysicalType();
      const obj1 = insertPhysicalObjectWithType(physTypeId);
      const obj2 = insertPhysicalObjectWithType(physTypeId);
      const obj3 = insertPhysicalObjectWithType(physTypeId);

      txn.deleteElements([physTypeId]);

      assert.isUndefined(iModelDb.elements.tryGetElement(physTypeId), "PhysicalType should be deleted");
      for (const id of [obj1, obj2, obj3]) {
        assert.isDefined(iModelDb.elements.tryGetElement(id), "PhysicalObject should survive");
        assert.isUndefined(getTypeDefinitionId3d(id), "TypeDefinitionId should be NULL on all surviving objects");
      }
    });

    it("TypeDefinitionId is not disturbed on elements whose PhysicalType is NOT deleted", () => {
      const typeToDelete = insertPhysicalType();
      const typeToKeep = insertPhysicalType();
      const objReferencingDeleted = insertPhysicalObjectWithType(typeToDelete);
      const objReferencingKept = insertPhysicalObjectWithType(typeToKeep);

      txn.deleteElements([typeToDelete]);

      assert.isUndefined(iModelDb.elements.tryGetElement(typeToDelete), "typeToDelete should be deleted");
      assert.isDefined(iModelDb.elements.tryGetElement(typeToKeep), "typeToKeep should survive");
      assert.isUndefined(getTypeDefinitionId3d(objReferencingDeleted), "TypeDefinitionId should be NULL on the affected object");
      assert.strictEqual(getTypeDefinitionId3d(objReferencingKept), typeToKeep, "TypeDefinitionId should be unchanged on the unaffected object");
    });

    it("TypeDefinitionId is NULLed on a surviving 3D element when its PhysicalType is deleted together with a non-definition element", () => {
      const physTypeId = insertPhysicalType();
      const physObjId = insertPhysicalObjectWithType(physTypeId);
      const unrelated = txn.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: physicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: {} },
      } as PhysicalElementProps);

      txn.deleteElements([physTypeId, unrelated]);

      assert.isUndefined(iModelDb.elements.tryGetElement(physTypeId), "PhysicalType should be deleted");
      assert.isUndefined(iModelDb.elements.tryGetElement(unrelated), "unrelated element should be deleted");
      assert.isDefined(iModelDb.elements.tryGetElement(physObjId), "PhysicalObject should survive");
      assert.isUndefined(getTypeDefinitionId3d(physObjId), "TypeDefinitionId should be NULL after its target type is deleted");
    });

    it("TypeDefinitionId is NULLed on a surviving 2D element when its GraphicalType2d is deleted", () => {
      const documentListModelId = DocumentListModel.insert(txn, subjectId, `DocList-${typeDefCounter}`);
      const drawingId = Drawing.insert(txn, documentListModelId, `Drawing-${typeDefCounter}`);
      const drawingCatId = DrawingCategory.insert(txn, typeDefModelId, `DrawingCat-${typeDefCounter}`, new SubCategoryAppearance());

      const graphicalTypeProps: TypeDefinitionElementProps = {
        classFullName: GenericGraphicalType2d.classFullName,
        model: typeDefModelId,
        code: Code.createEmpty(),
      };
      const graphicalTypeId = txn.insertElement(graphicalTypeProps);

      const drawingElemProps: GeometricElement2dProps = {
        classFullName: DrawingGraphic.classFullName,
        model: drawingId,
        category: drawingCatId,
        code: Code.createEmpty(),
        typeDefinition: new GraphicalElement2dIsOfType(graphicalTypeId),
      };
      const drawingElemId = txn.insertElement(drawingElemProps);

      const getTypeDefinitionId2d = (elemId: Id64String): Id64String | undefined => {
        return iModelDb.withQueryReader(
          "SELECT TypeDefinition FROM bis.GeometricElement2d WHERE ECInstanceId=?",
          (reader) => reader.step() ? reader.current[0]?.id : undefined,
          QueryBinder.from([elemId]),
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          { rowFormat: QueryRowFormat.UseJsPropertyNames },
        );
      };

      assert.strictEqual(getTypeDefinitionId2d(drawingElemId), graphicalTypeId, "TypeDefinitionId should be set before deletion");

      txn.deleteElements([graphicalTypeId]);

      assert.isUndefined(iModelDb.elements.tryGetElement(graphicalTypeId), "GraphicalType2d should be deleted");
      assert.isDefined(iModelDb.elements.tryGetElement(drawingElemId), "DrawingGraphic should survive");
      assert.isUndefined(getTypeDefinitionId2d(drawingElemId), "TypeDefinitionId should be NULL after its 2D type is deleted");
    });

    it("TypeDefinitionId is NOT NULLed when deleteElements deletes the type and NULLs the reference", () => {
      const physTypeId = insertPhysicalType();
      const physObjId = insertPhysicalObjectWithType(physTypeId);

      const result = txn.deleteElements([physTypeId]);

      // TypeDefinitionId refs do not block deleteElements - the type is deleted, the referencing object survives, and no failures are reported.
      assertResult(result, success, [physTypeId], [physObjId], iModelDb);
      assert.isUndefined(getTypeDefinitionId3d(physObjId), "TypeDefinitionId should be NULLed since the type was deleted");
    });
  });

  describe("ModelSelector link-table cleanup on model deletion", () => {
    let msCounter = 0;
    let msDefModelId: Id64String;
    let txn: EditTxn;

    beforeEach(() => {
      txn = new EditTxn(iModelDb, "delete definition elements");
      txn.start();
      msDefModelId = DefinitionModel.insert(txn, subjectId, `MSDefModel-${++msCounter}`);
    });

    const getModelSelectorModels = (selectorId: Id64String): Id64String[] => {
      return iModelDb.withQueryReader(
        "SELECT TargetECInstanceId FROM bis.ModelSelectorRefersToModels WHERE SourceECInstanceId=?",
        (reader) => {
          const ids: Id64String[] = [];
          for (const row of reader)
            ids.push(row[0] as Id64String);
          return ids;
        },
        QueryBinder.from([selectorId]),
      );
    };


    it("removes the ModelSelectorRefersToModels row when the referenced model is deleted", () => {
      const partitionId = PhysicalModel.insert(txn, subjectId, `MSPartition-${msCounter}`);
      const selectorId = ModelSelector.insert(txn, msDefModelId, `MSSelector-${msCounter}`, [partitionId]);

      assert.include(getModelSelectorModels(selectorId), partitionId, "ModelSelector should reference the partition before deletion");

      txn.deleteElements([partitionId]);

      assert.isUndefined(iModelDb.elements.tryGetElement(partitionId), "partition should be deleted");
      assert.notInclude(getModelSelectorModels(selectorId), partitionId, "ModelSelectorRefersToModels row should be removed after model deletion");
    });

    it("removes only the deleted model's rows from ModelSelector when multiple models are referenced", () => {
      const partition1 = PhysicalModel.insert(txn, subjectId, `MSMulti1-${msCounter}`);
      const partition2 = PhysicalModel.insert(txn, subjectId, `MSMulti2-${msCounter}`);
      const partition3 = PhysicalModel.insert(txn, subjectId, `MSMulti3-${msCounter}`);
      const selectorId = ModelSelector.insert(txn, msDefModelId, `MSMultiSelector-${msCounter}`, [partition1, partition2, partition3]);

      assert.equal(getModelSelectorModels(selectorId).length, 3, "ModelSelector should start with 3 entries");

      txn.deleteElements([partition1]);

      assert.isUndefined(iModelDb.elements.tryGetElement(partition1), "partition1 should be deleted");
      const remaining = getModelSelectorModels(selectorId);
      assert.equal(remaining.length, 2, "ModelSelector should have 2 remaining entries");
      assert.notInclude(remaining, partition1, "partition1 row should be removed");
      assert.include(remaining, partition2, "partition2 row should remain");
      assert.include(remaining, partition3, "partition3 row should remain");
    });

    it("removes ModelSelectorRefersToModels rows for all models when multiple partitions are deleted in one call", () => {
      const partition1 = PhysicalModel.insert(txn, subjectId, `MSBulk1-${msCounter}`);
      const partition2 = PhysicalModel.insert(txn, subjectId, `MSBulk2-${msCounter}`);
      const selectorId = ModelSelector.insert(txn, msDefModelId, `MSBulkSelector-${msCounter}`, [partition1, partition2]);

      txn.deleteElements([partition1, partition2]);

      assert.isUndefined(iModelDb.elements.tryGetElement(partition1), "partition1 should be deleted");
      assert.isUndefined(iModelDb.elements.tryGetElement(partition2), "partition2 should be deleted");
      assert.isEmpty(getModelSelectorModels(selectorId), "all ModelSelectorRefersToModels rows should be gone");
    });
  });
});
