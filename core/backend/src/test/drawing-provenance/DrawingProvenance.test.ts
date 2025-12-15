/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { TxnIdString } from "../../TxnManager";
import { GeometricModel } from "../../Model";
import { DrawingProvenance } from "../../internal/DrawingProvenance";
import { TestCase } from "./TestCase";

describe("DrawingProvenance", () => {
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

  function getGeometryGuid(modelId: Id64String): string {
    const model = tc.db.models.getModel<GeometricModel>(modelId);
    expect(model.geometryGuid).not.to.be.undefined;
    return model.geometryGuid!;
  }

  describe("compute", () => {
    it("produces a sorted list of the geometry GUIDs of all the models viewed by a spatial view", () => {
      const models = [0,0,0].map(() => tc.insertSpatialModelAndElement().model);
      const guids = models.map((modelId) => getGeometryGuid(modelId));
      const view = tc.insertSpatialView(models);
      const provenance = DrawingProvenance.compute(view, tc.db);
      expect(provenance.guids).to.deep.equal(guids.sort());
    });
  });

  describe("remove", () => {
    it("deletes the provenance if present", () => {
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);

      DrawingProvenance.remove(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
    });

    it("does nothing if provenance is not present", () => {
      const spatialViewId = tc.insertSpatialView([tc.insertSpatialModelAndElement().model]);
      const drawingId = tc.insertSectionDrawing(spatialViewId);
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
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);
      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);
    });

    it("includes the JSON version", () => {
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(DrawingProvenance.query(drawingId, tc.db)).to.be.undefined;
      DrawingProvenance.update(drawingId, tc.db);

      const props = tc.db.elements.getElementProps(drawingId).jsonProperties![DrawingProvenance.jsonKey];
      expect(props.version).to.equal("01.00.00");
      expect(props.data).to.deep.equal(DrawingProvenance.query(drawingId, tc.db));
    });

    it("does nothing if the SectionDrawing has no associated spatial view", () => {
      const drawingId = tc.insertSectionDrawing(undefined);
      const preProps = tc.db.elements.getElementProps(drawingId);
      DrawingProvenance.update(drawingId, tc.db);
      const postProps = tc.db.elements.getElementProps(drawingId);
      expect(postProps).to.deep.equal(preProps);
    });

    it("updates the existing stored provenance with the newly-computed provenance", () => {
      const spatial = tc.insertSpatialModelAndElement();
      const drawingId = tc.insertSectionDrawing(tc.insertSpatialView([spatial.model]));
      const preGuid = getGeometryGuid(spatial.model);
      DrawingProvenance.update(drawingId, tc.db);

      expect(DrawingProvenance.query(drawingId, tc.db)!.guids).to.deep.equal([preGuid]);

      tc.touchSpatialElement(spatial.element);
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
