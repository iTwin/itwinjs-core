/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Code, PhysicalElementProps, SectionDrawingProps } from "@itwin/core-common";
import { TxnIdString } from "../../TxnManager";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricModel } from "../../Model";
import { DrawingProvenance } from "../../internal/DrawingProvenance";
import { Drawing, GeometricElement3d, SectionDrawing } from "../../Element";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { CategorySelector, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { DisplayStyle3d } from "../../DisplayStyle";
import { TestCase } from "./TestCase";

describe.only("DrawingProvenance", () => {
  let tc: TestCase;
  let initialTxnId: TxnIdString;

  before(async () => {
    tc = TestCase.create("DrawingProvenance");
    initialTxnId = tc.db.txns.getCurrentTxnId();
  });

  afterEach(() => {
    tc.db.txns.reverseTo(initialTxnId);
  });

  after(() => tc.db.close());

  function insertSpatialModelAndElement(): { model: Id64String, element: Id64String } {
    const model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(tc.db, { spec: "0x1", scope: "0x1", value: Guid.createValue() })[1];

    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model,
      category: tc.spatialCategoryId,
      code: Code.createEmpty(),
      placement: {
        origin: [0, 0, 0],
        angles: { yaw: 0, roll: 0, pitch: 0 },
      },
      geom: IModelTestUtils.createBox(new Point3d(1, 1, 1)),
    }

    const element = tc.db.elements.insertElement(props);
    tc.db.saveChanges();
    return { model, element };
  }

  function insertSpatialView(viewedModels: Id64String[]): Id64String {
    const guid = Guid.createValue();
    const modelSelector = ModelSelector.insert(tc.db, tc.definitionModelId, guid, viewedModels);
    const categorySelector = CategorySelector.insert(tc.db, tc.definitionModelId, guid, [tc.spatialCategoryId, tc.altSpatialCategoryId]);
    const displayStyle = DisplayStyle3d.insert(tc.db, tc.definitionModelId, guid);
    const viewRange = new Range3d(0, 0, 0, 500, 500, 500);
    const viewId = SpatialViewDefinition.insertWithCamera(tc.db, tc.definitionModelId, guid, modelSelector, categorySelector, displayStyle, viewRange);
    tc.db.saveChanges();
    return viewId;
  }

  function insertSectionDrawing(spatialViewId: Id64String | undefined): Id64String {
    const props: SectionDrawingProps = {
      classFullName: SectionDrawing.classFullName,
      model: tc.definitionModelId,
      code: Drawing.createCode(tc.db, tc.definitionModelId, Guid.createValue()),
      spatialView: spatialViewId ? { id: spatialViewId } : undefined,
    };

    const id = tc.db.elements.insertElement(props);
    tc.db.saveChanges();
    return id;
  }

  function touchSpatialElement(id: Id64String): void {
    const elem = tc.db.elements.getElement<GeometricElement3d>(id);
    elem.category = (elem.category === tc.spatialCategoryId ? tc.altSpatialCategoryId : tc.spatialCategoryId);
    elem.update();
    tc.db.saveChanges();
  }

  function getGeometryGuid(modelId: Id64String): string {
    const model = tc.db.models.getModel<GeometricModel>(modelId);
    expect(model.geometryGuid).not.to.be.undefined;
    return model.geometryGuid!;
  }

  describe("compute", () => {
    it("produces a sorted list of the geometry GUIDs of all the models viewed by a spatial view", () => {
      const models = [0,0,0].map(() => insertSpatialModelAndElement().model);
      const guids = models.map((modelId) => getGeometryGuid(modelId));
      const view = insertSpatialView(models);
      const provenance = DrawingProvenance.compute(view, tc.db);
      expect(provenance.guids).to.deep.equal(guids.sort());
    });
  });

  describe("remove", () => {
    it("deletes the provenance if present", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);

      DrawingProvenance.remove(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
    });

    it("does nothing if provenance is not present", () => {
      const spatialViewId = insertSpatialView([insertSpatialModelAndElement().model]);
      const drawingId = insertSectionDrawing(spatialViewId);
      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      const preProps = tc.db.elements.getElementProps(drawingId);
      DrawingProvenance.remove(drawingId, tc.db);
      const postProps = tc.db.elements.getElementProps(drawingId);
      expect(preProps).to.deep.equal(postProps);
    });

    it("throws if the specified SectionDrawing doesn't exist", () => {
      expect(() => DrawingProvenance.remove("0xdeadbeef", tc.db)).to.throw();
      expect(() => DrawingProvenance.remove(Id64.invalid, tc.db)).to.throw();
    });
  });

  describe("update", () => {
    it("inserts newly-computed provenance if not previously stored", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);
    });

    it("includes the JSON version", () => {
      const spatialModel = insertSpatialModelAndElement().model;
      const spatialView = insertSpatialView([spatialModel]);
      const drawingId = insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);

      const props = tc.db.elements.getElementProps(drawingId).jsonProperties![DrawingProvenance.jsonKey];
      expect(props.version).to.equal("01.00.00");
      expect(props.data).to.deep.equal(DrawingProvenance.query(drawingId, tc.db));
    });

    it("does nothing if the SectionDrawing has no associated spatial view", () => {
      const drawingId = insertSectionDrawing(undefined);
      const preProps = tc.db.elements.getElementProps(drawingId);
      DrawingProvenance.update(drawingId, tc.db);
      const postProps = tc.db.elements.getElementProps(drawingId);
      expect(postProps).to.deep.equal(preProps);
    });

    it("updates the existing stored provenance with the newly-computed provenance", () => {
      const spatial = insertSpatialModelAndElement();
      const drawingId = insertSectionDrawing(insertSpatialView([spatial.model]));
      const preGuid = getGeometryGuid(spatial.model);
      DrawingProvenance.update(drawingId, tc.db);

      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([preGuid]);

      touchSpatialElement(spatial.element);
      const postGuid = getGeometryGuid(spatial.model);
      expect(postGuid).not.to.equal(preGuid);

      DrawingProvenance.update(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([postGuid]);
    });

    it("throws if the specified SectionDrawing does not exist", () => {
      expect(() => DrawingProvenance.update("0xdeadbeef", tc.db)).to.throw();
      expect(() => DrawingProvenance.update(Id64.invalid, tc.db)).to.throw();
    });
  });
});
