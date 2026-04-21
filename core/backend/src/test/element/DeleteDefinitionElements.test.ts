/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { Code, CodeScopeSpec, GeometricElement2dProps, GeometryPartProps, ImageSourceFormat, IModel, PhysicalElementProps, PhysicalTypeProps, QueryBinder, QueryRowFormat, SubCategoryAppearance, TypeDefinitionElementProps } from "@itwin/core-common";
import { EditTxn } from "../../EditTxn";
import {
  CategorySelector, ChannelControl, DefinitionContainer, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory,
  DrawingGraphic, DrawingViewDefinition, GenericGraphicalType2d, GenericPhysicalType, GeometryPart,
  GraphicalElement2dIsOfType, IModelJsFs, InformationPartitionElement, ModelSelector, OrthographicViewDefinition, PhysicalElementIsOfType,
  PhysicalModel, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, Subject, Texture,
} from "../../core-backend";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

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
     * Call deleteElements, verify the returned failed-set, then check which elements survived vs. were deleted.
     * Rolls back changes with abandonChanges afterwards.
     */
    const executeTestCase = (txn: EditTxn, label: string, idsToDelete: Id64Array, expectedDeleted: Id64Array, expectedFailed: Id64Array, expectedRetained: Id64Array, abandonChanges: boolean = true) => {
      const failed = txn.deleteElements(idsToDelete);
      assert.sameMembers(Array.from(failed), expectedFailed, `[${label}] failed set mismatch`);

      for (const id of expectedDeleted)
        assert.isUndefined(iModelDb.elements.tryGetElement(id), `error reading element`);
      for (const id of expectedRetained)
        assert.isDefined(iModelDb.elements.tryGetElement(id), `[${label}] ${id} should have been retained`);

      if (abandonChanges)
        txn.abandonChanges();
    };

    it("should delete only if not used with deleteElements", async () => {
      let usedDefinitionElementIds: Id64Set;

      const txn = new EditTxn(iModelDb, "delete definition elements");
      txn.start();

      // make sure deleteElements only skips Elements that are being used (subjectId)
      usedDefinitionElementIds = txn.deleteElements([physicalObjectId1, physicalObjectId2, physicalObjectId3, subjectId]);
      assert.equal(usedDefinitionElementIds.size, 1);
      assert.isUndefined(iModelDb.elements.tryGetElement(physicalObjectId1));
      assert.isUndefined(iModelDb.elements.tryGetElement(physicalObjectId2));
      assert.isUndefined(iModelDb.elements.tryGetElement(physicalObjectId3));
      assert.isDefined(iModelDb.elements.tryGetElement(subjectId));

      // Reset the db state
      txn.abandonChanges();

      // make sure deleteElements throws for invalid Ids
      assert.throws(() => txn.deleteElements([Id64.invalid, Id64.invalid]));

      // deleteElement/deleteElements for a used GeometryPart should fail
      assert.throws(() => txn.deleteElement(geometryPartId));
      usedDefinitionElementIds = txn.deleteElements([geometryPartId]);
      assert.isTrue(usedDefinitionElementIds.has(geometryPartId));
      assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId));

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
      usedDefinitionElementIds = txn.deleteElements([unusedGeometryPartId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedGeometryPartId));

      // deleteElement/deleteElements for a used RenderMaterial should fail
      assert.throws(() => txn.deleteElement(renderMaterialId));
      usedDefinitionElementIds = txn.deleteElements([renderMaterialId]);
      assert.isTrue(usedDefinitionElementIds.has(renderMaterialId));
      assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId));

      // deleteElements for an unused RenderMaterial should succeed, delete should still fail
      const unusedRenderMaterialId = RenderMaterialElement.insert(txn, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
      assert.isTrue(Id64.isValidId64(unusedRenderMaterialId));
      assert.throws(() => txn.deleteElement(unusedRenderMaterialId));
      usedDefinitionElementIds = txn.deleteElements([unusedRenderMaterialId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedRenderMaterialId));
      txn.abandonChanges();

      // deleteElement/deleteElements for a used Texture should fail
      assert.throws(() => txn.deleteElement(textureId));
      usedDefinitionElementIds = txn.deleteElements([textureId]);
      assert.isTrue(usedDefinitionElementIds.has(textureId));
      assert.isDefined(iModelDb.elements.tryGetElement(textureId));

      // deleteElements for an unused Texture should succeed, delete should still fail
      const unusedTextureId = IModelTestUtils.insertTextureElement(txn, definitionModelId, "Unused Texture");
      assert.isTrue(Id64.isValidId64(unusedTextureId));
      assert.throws(() => txn.deleteElement(unusedTextureId));
      usedDefinitionElementIds = txn.deleteElements([unusedTextureId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedTextureId));
      txn.abandonChanges();

      // deleteElement/deleteElements for a used SpatialCategory should fail
      assert.throws(() => txn.deleteElement(spatialCategoryId));
      usedDefinitionElementIds = txn.deleteElements([spatialCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId));

      // deleteElement/deleteElements for a default SubCategory should fail
      const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
      const defaultSpatialSubCategoryId = spatialCategory.myDefaultSubCategoryId();
      assert.throws(() => txn.deleteElement(defaultSpatialSubCategoryId));
      usedDefinitionElementIds = txn.deleteElements([defaultSpatialSubCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(defaultSpatialSubCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(defaultSpatialSubCategoryId));

      // deleteElement/deleteElements for a used, non-default SubCategory should fail
      assert.throws(() => txn.deleteElement(subCategoryId));
      usedDefinitionElementIds = txn.deleteElements([subCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(subCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId));

      // deleteElements for an unused SubCategory should succeed, delete should still fail
      const unusedSubCategoryId = SubCategory.insert(txn, spatialCategoryId, "Unused SubCategory", {});
      assert.isTrue(Id64.isValidId64(unusedSubCategoryId));
      assert.throws(() => txn.deleteElement(unusedSubCategoryId));
      usedDefinitionElementIds = txn.deleteElements([unusedSubCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSubCategoryId));
      txn.abandonChanges();

      // deleteElements for an unused SpatialCategory should succeed, delete should still fail
      const unusedSpatialCategoryId = SpatialCategory.insert(txn, definitionModelId, "Unused SpatialCategory", {});
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryId));
      const unusedSpatialCategory = iModelDb.elements.getElement<SpatialCategory>(unusedSpatialCategoryId, SpatialCategory);
      const unusedSpatialCategoryDefaultSubCategoryId = unusedSpatialCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedSpatialCategoryDefaultSubCategoryId));
      assert.throws(() => txn.deleteElement(unusedSpatialCategoryId));
      assert.throws(() => txn.deleteElement(unusedSpatialCategoryDefaultSubCategoryId));
      usedDefinitionElementIds = txn.deleteElements([unusedSpatialCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedSpatialCategoryDefaultSubCategoryId));
      txn.abandonChanges();

      // deleteElement/deleteElements of a used DrawingCategory should fail
      assert.throws(() => txn.deleteElement(drawingCategoryId));
      usedDefinitionElementIds = txn.deleteElements([drawingCategoryId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategoryId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategoryId));

      // deleteElements for an unused DrawingCategory should succeed, delete should still fail
      const unusedDrawingCategoryId = DrawingCategory.insert(txn, definitionModelId, "Unused DrawingCategory", {});
      assert.isTrue(Id64.isValidId64(unusedDrawingCategoryId));
      const unusedDrawingCategory = iModelDb.elements.getElement<DrawingCategory>(unusedDrawingCategoryId, DrawingCategory);
      const unusedDrawingSubCategoryId = unusedDrawingCategory.myDefaultSubCategoryId();
      assert.isTrue(Id64.isValidId64(unusedDrawingSubCategoryId));
      assert.throws(() => txn.deleteElement(unusedDrawingSubCategoryId));
      usedDefinitionElementIds = txn.deleteElements([unusedDrawingCategoryId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingCategoryId));
      assert.isUndefined(iModelDb.elements.tryGetElement(unusedDrawingSubCategoryId));
      txn.abandonChanges();

      // deleteElement/deleteElements of DefinitionElements used by an existing SpatialViewDefinition should fail
      assert.throws(() => txn.deleteElement(spatialCategorySelectorId));
      assert.throws(() => txn.deleteElement(modelSelectorId));
      assert.throws(() => txn.deleteElement(displayStyle3dId));
      usedDefinitionElementIds = txn.deleteElements([spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.isTrue(usedDefinitionElementIds.has(spatialCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(modelSelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isDefined(iModelDb.elements.tryGetElement(viewId));

      // deleteElements should succeed when the list includes the SpatialViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      assert.throws(() => txn.deleteElement(viewId));
      usedDefinitionElementIds = txn.deleteElements([viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(spatialCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(modelSelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle3dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(viewId));
      txn.abandonChanges();

      // deleteElement/deleteElements of DefinitionElements used by an existing DrawingViewDefinition should fail
      assert.throws(() => txn.deleteElement(drawingCategorySelectorId));
      assert.throws(() => txn.deleteElement(displayStyle2dId));
      usedDefinitionElementIds = txn.deleteElements([drawingCategorySelectorId, displayStyle2dId]);
      assert.isTrue(usedDefinitionElementIds.has(drawingCategorySelectorId));
      assert.isTrue(usedDefinitionElementIds.has(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isDefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isDefined(iModelDb.elements.tryGetElement(drawingViewId));

      // deleteElements should succeed when the list includes the DrawingViewDefinition as the only thing referencing other DefinitionElements, delete should still fail
      assert.throws(() => txn.deleteElement(drawingViewId));
      usedDefinitionElementIds = txn.deleteElements([drawingViewId, drawingCategorySelectorId, displayStyle2dId]);
      assert.equal(usedDefinitionElementIds.size, 0);
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingCategorySelectorId));
      assert.isUndefined(iModelDb.elements.tryGetElement(displayStyle2dId));
      assert.isUndefined(iModelDb.elements.tryGetElement(drawingViewId));

      txn.end("abandon");
      iModelDb.close();
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
        executeTestCase(txn, "single unused definition element", [element], [element], [], []);
      });

      it("deletes multiple unused definition elements in one call", () => {
        const element1 = insertDefinitionElement(txn);
        const element2 = insertDefinitionElement(txn);
        const element3 = insertDefinitionElement(txn);
        executeTestCase(txn, "multiple unused definition elements", [element1, element2, element3], [element1, element2, element3], [], []);
      });

      it("returns empty failed-set when given an empty array", () => {
        const failed = txn.deleteElements([]);
        assert.isEmpty(Array.from(failed), "empty input should return empty failed set");
      });

      it("throws for invalid ids", () => {
        assert.throws(() => txn.deleteElements([Id64.invalid, Id64.invalid]));
      });

      it("keeps an in-use definition element in the failed set and does not delete it", () => {
        // geometryPartId is referenced by PhysicalObject1's geometry stream
        const failed = txn.deleteElements([geometryPartId]);
        assert.isTrue(failed.has(geometryPartId), "in-use definition element must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(geometryPartId), "in-use definition element must not be deleted");
      });

      it("returns only the in-use definition element in the failed set when mixing used and unused parts", () => {
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
          [usedElement],
          [usedElement, physElemId],
        );
      });

      it("keeps an in-use RenderMaterial in the failed set and does not delete it", () => {
        const failed = txn.deleteElements([renderMaterialId]);
        assert.isTrue(failed.has(renderMaterialId), "in-use RenderMaterial must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(renderMaterialId), "in-use RenderMaterial must not be deleted");
      });

      it("deletes an unused RenderMaterial", () => {
        const unusedRenderMaterialId = RenderMaterialElement.insert(txn, definitionModelId, "Unused RenderMaterial", { paletteName: "PaletteName" });
        executeTestCase(txn, "unused RenderMaterial", [unusedRenderMaterialId], [unusedRenderMaterialId], [], []);
      });

      it("keeps an in-use Texture in the failed set and does not delete it", () => {
        const failed = txn.deleteElements([textureId]);
        assert.isTrue(failed.has(textureId), "in-use Texture must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(textureId), "in-use Texture must not be deleted");
      });

      it("deletes an unused Texture", () => {
        const unusedTextureId = IModelTestUtils.insertTextureElement(txn, definitionModelId, "Unused Texture");
        executeTestCase(txn, "unused Texture", [unusedTextureId], [unusedTextureId], [], []);
      });

      it("returns the full input as the failed set when every element is an in-use definition element", () => {
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

        const failedToDelete = txn.deleteElements([usedElement1, usedElement2, usedElement3]);
        assert.equal(failedToDelete.size, 3, "all in-use definition elements should be in failed set");
        assert.isTrue(failedToDelete.has(usedElement1));
        assert.isTrue(failedToDelete.has(usedElement2));
        assert.isTrue(failedToDelete.has(usedElement3));
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

      it("keeps an in-use SpatialCategory in the failed set and does not delete it", () => {
        const failed = txn.deleteElements([spatialCategoryId]);
        assert.isTrue(failed.has(spatialCategoryId), "in-use SpatialCategory must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(spatialCategoryId), "in-use SpatialCategory must not be deleted");
      });

      it("keeps the default SubCategory in the failed set when its parent SpatialCategory is in use", () => {
        const spatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId, SpatialCategory);
        const defaultSubCategoryId = spatialCategory.myDefaultSubCategoryId();
        const failed = txn.deleteElements([defaultSubCategoryId]);
        assert.isTrue(failed.has(defaultSubCategoryId), "default SubCategory must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(defaultSubCategoryId), "default SubCategory must not be deleted");
      });

      it("keeps a used non-default SubCategory in the failed set and does not delete it", () => {
        const failed = txn.deleteElements([subCategoryId]);
        assert.isTrue(failed.has(subCategoryId), "in-use SubCategory must be in failed set");
        assert.isDefined(iModelDb.elements.tryGetElement(subCategoryId), "in-use SubCategory must not be deleted");
      });

      it("deletes an unused non-default SubCategory", () => {
        const unusedSubCategoryId = SubCategory.insert(txn, spatialCategoryId, "Unused SubCategory", {});
        executeTestCase(txn, "unused SubCategory", [unusedSubCategoryId], [unusedSubCategoryId], [], [spatialCategoryId]);
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
          [],
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
          [],
          [],
        );
      });

      it("keeps CategorySelector, ModelSelector, DisplayStyle3d in the failed set when their view still exists", () => {
        executeTestCase(
          txn,
          "view-related still referenced",
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [],
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [spatialCategorySelectorId, modelSelectorId, displayStyle3dId, viewId],
        );
      });

      it("deletes CategorySelector, ModelSelector, DisplayStyle3d and the SpatialViewDefinition in one call", () => {
        executeTestCase(
          txn,
          "view + view-related",
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [viewId, spatialCategorySelectorId, modelSelectorId, displayStyle3dId],
          [],
          [],
        );
      });

      it("deletes DrawingCategorySelector, DisplayStyle2d and the DrawingViewDefinition in one call", () => {
        executeTestCase(
          txn,
          "drawing view + drawing view-related",
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          [drawingViewId, drawingCategorySelectorId, displayStyle2dId],
          [],
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
          [],
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
          [],
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
          [],
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
        executeTestCase(txn, "intra-set code scope", [partA, partB], [partA, partB], [], []);
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
        executeTestCase(txn, "3-level hierarchy via root only", [root], [root, child, grandchild], [], []);
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
          [],
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
          [],
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
          [],
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

        // Pass both used and unused parts, with a child that has a code scope reference
        executeTestCase(
          txn,
          "mixed used and unused batch",
          [usedPart, unusedPart],
          [unusedPart],
          [usedPart],
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
          [],
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
          [],
          [],
        );
        // Sub-model row is deleted once the container element is successfully purged.
        assertModelDeleted(containerId, "DefinitionModel sub-model row must be deleted after container is purged");
      });

      it("keeps an in-use element inside a DefinitionContainer sub-model in the failed set", () => {
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
          [usedPart],
          [usedPart, physElemId],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when an element inside it is blocked");
      });

      it("parent blocked in failed set when its child inside a DefinitionContainer sub-model is in use", () => {
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

        executeTestCase(
          txn,
          "parent blocked when child inside container sub-model is in use",
          [parent],
          [],
          [parent],
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
          [],
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
          [partA],
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
          [],
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
          [topUsed, nestedUsed],
          [topUsed, nestedUsed, topUsedPhysElem, nestedUsedPhysElem],
          false,
        );
        assertModelExists(containerId, "DefinitionContainer sub-model row must survive when an element inside it is blocked");
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

      const failed = txn.deleteElements([physTypeId]);

      assert.isFalse(failed.has(physTypeId), "physTypeId should NOT be in the failed set — TypeDefinitionId refs do not block deleteElements");
      assert.isUndefined(iModelDb.elements.tryGetElement(physTypeId), "PhysicalType should be deleted");
      assert.isDefined(iModelDb.elements.tryGetElement(physObjId), "PhysicalObject should still exist");
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
