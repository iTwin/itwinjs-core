/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel, PhysicalElementProps, SectionDrawingProps, SubCategoryAppearance } from "@itwin/core-common";
import { StandaloneDb } from "../../IModelDb";
import { TxnIdString } from "../../TxnManager";
import { IModelTestUtils } from "../IModelTestUtils";
import { DefinitionModel, GeometricModel } from "../../Model";
import { SpatialCategory } from "../../Category";
import { DrawingProvenance } from "../../internal/DrawingProvenance";
import { Drawing, GeometricElement3d, SectionDrawing } from "../../Element";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { CategorySelector, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { DisplayStyle3d } from "../../DisplayStyle";

describe.only("DrawingProvenance", () => {
  let db: StandaloneDb;
  let definitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let altSpatialCategoryId: Id64String;
  let initialTxnId: TxnIdString;

  before(async () => {
    const filePath = IModelTestUtils.prepareOutputFile("DrawingProvenanceTests", "DrawingProvenance.bim");
    db = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "DrawingProvenance", description: "" },
      enableTransactions: true,
    });

    definitionModelId = DefinitionModel.insert(db, IModel.rootSubjectId, "DrawingProvenance");
    spatialCategoryId = SpatialCategory.insert(db, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    altSpatialCategoryId = SpatialCategory.insert(db, definitionModelId, "AltSpatialCategory", new SubCategoryAppearance());

    db.saveChanges();
    initialTxnId = db.txns.getCurrentTxnId();
  });

  afterEach(() => {
    db.txns.reverseTo(initialTxnId);
  });

  after(() => db.close());

  function insertSpatialModelAndElement(): { model: Id64String, element: Id64String } {
    const model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(db, { spec: "0x1", scope: "0x1", value: Guid.createValue() })[1];

    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      placement: {
        origin: [0, 0, 0],
        angles: { yaw: 0, roll: 0, pitch: 0 },
      },
      geom: IModelTestUtils.createBox(new Point3d(1, 1, 1)),
    }

    const element = db.elements.insertElement(props);
    db.saveChanges();
    return { model, element };
  }

  function insertSpatialView(viewedModels: Id64String[]): Id64String {
    const guid = Guid.createValue();
    const modelSelector = ModelSelector.insert(db, definitionModelId, guid, viewedModels);
    const categorySelector = CategorySelector.insert(db, definitionModelId, guid, [spatialCategoryId, altSpatialCategoryId]);
    const displayStyle = DisplayStyle3d.insert(db, definitionModelId, guid);
    const viewRange = new Range3d(0, 0, 0, 500, 500, 500);
    const viewId = SpatialViewDefinition.insertWithCamera(db, definitionModelId, guid, modelSelector, categorySelector, displayStyle, viewRange);
    db.saveChanges();
    return viewId;
  }

  function insertSectionDrawing(spatialViewId: Id64String | undefined): Id64String {
    const props: SectionDrawingProps = {
      classFullName: SectionDrawing.classFullName,
      model: definitionModelId,
      code: Drawing.createCode(db, definitionModelId, Guid.createValue()),
      spatialView: spatialViewId ? { id: spatialViewId } : undefined,
    };

    const id = db.elements.insertElement(props);
    db.saveChanges();
    return id;
  }

  function touchSpatialElement(id: Id64String): void {
    const elem = db.elements.getElement<GeometricElement3d>(id);
    elem.category = (elem.category === spatialCategoryId ? altSpatialCategoryId : spatialCategoryId);
    elem.update();
    db.saveChanges();
  }

  function getGeometryGuid(modelId: Id64String): string {
    const model = db.models.getModel<GeometricModel>(modelId);
    expect(model.geometryGuid).not.to.be.undefined;
    return model.geometryGuid!;
  }

  describe("compute", () => {
    it("produces a sorted list of the geometry GUIDs of all the models viewed by a spatial view", () => {
      const models = [0,0,0].map(() => insertSpatialModelAndElement().model);
      const guids = models.map((modelId) => getGeometryGuid(modelId));
      const view = insertSpatialView(models);
      const provenance = DrawingProvenance.compute(view, db);
      expect(provenance.guids).to.deep.equal(guids.sort());
    });
  });

  describe("remove", () => {
    it("deletes the provenance if present", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, db)).to.be.undefined;
      DrawingProvenance.update(drawingId, db);
      expect(DrawingProvenance.query(drawingId, db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);

      DrawingProvenance.remove(drawingId, db);
      expect(DrawingProvenance.query(drawingId, db)).to.be.undefined;
    });

    it("does nothing if provenance is not present", () => {
      const spatialViewId = insertSpatialView([insertSpatialModelAndElement().model]);
      const drawingId = insertSectionDrawing(spatialViewId);
      expect(DrawingProvenance.query(drawingId, db)).to.be.undefined;
      const preProps = db.elements.getElementProps(drawingId);
      DrawingProvenance.remove(drawingId, db);
      const postProps = db.elements.getElementProps(drawingId);
      expect(preProps).to.deep.equal(postProps);
    });

    it("throws if the specified SectionDrawing doesn't exist", () => {
      expect(() => DrawingProvenance.remove("0xdeadbeef", db)).to.throw();
      expect(() => DrawingProvenance.remove(Id64.invalid, db)).to.throw();
    });
  });

  describe("update", () => {
    it("inserts newly-computed provenance if not previously stored", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, db)).to.be.undefined;
      DrawingProvenance.update(drawingId, db);
      expect(DrawingProvenance.query(drawingId, db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);
    });

    it("includes the JSON version", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, db)).to.be.undefined;
      DrawingProvenance.update(drawingId, db);

      const props = db.elements.getElementProps(drawingId).jsonProperties![DrawingProvenance.jsonKey];
      expect(props.version).to.equal("01.00.00");
      expect(props.data).to.deep.equal(DrawingProvenance.query(drawingId, db));
    });

    it("does nothing if the SectionDrawing has no associated spatial view", () => {
      const drawingId = insertSectionDrawing(undefined);
      const preProps = db.elements.getElementProps(drawingId);
      DrawingProvenance.update(drawingId, db);
      const postProps = db.elements.getElementProps(drawingId);
      expect(postProps).to.deep.equal(preProps);
    });

    it("updates the existing stored provenance with the newly-computed provenance", () => {
      const spatial = insertSpatialModelAndElement();
      const drawingId = insertSectionDrawing(insertSpatialView([spatial.model]));
      const preGuid = getGeometryGuid(spatial.model);
      DrawingProvenance.update(drawingId, db);

      expect(DrawingProvenance.query(drawingId, db)!.guids).to.deep.equal([preGuid]);

      touchSpatialElement(spatial.element);
      const postGuid = getGeometryGuid(spatial.model);
      expect(postGuid).not.to.equal(preGuid);

      DrawingProvenance.update(drawingId, db);
      expect(DrawingProvenance.query(drawingId, db)!.guids).to.deep.equal([postGuid]);
    });

    it("throws if the specified SectionDrawing does not exist", () => {
      expect(() => DrawingProvenance.update("0xdeadbeef", db)).to.throw();
      expect(() => DrawingProvenance.update(Id64.invalid, db)).to.throw();
    });
  });
});
