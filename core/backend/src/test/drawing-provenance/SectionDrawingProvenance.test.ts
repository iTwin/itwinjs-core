/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { TxnIdString } from "../../TxnManager";
import { GeometricModel } from "../../Model";
import { SectionDrawingProvenance } from "../../SectionDrawingProvenance";
import { TestCase } from "./TestCase";
import { SectionDrawing } from "../../Element";

describe("SectionDrawingProvenance", () => {
  let tc: TestCase;
  let initialTxnId: TxnIdString;

  before(async () => {
    tc = TestCase.create("SectionDrawingProvenance");
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

  function compute(drawingId: Id64String): SectionDrawingProvenance {
    const drawing = tc.db.elements.getElement<SectionDrawing>(drawingId);
    return SectionDrawingProvenance.compute(drawing);
  }

  function query(drawingId: Id64String): SectionDrawingProvenance | undefined {
    const drawing = tc.db.elements.getElement<SectionDrawing>(drawingId);
    return SectionDrawingProvenance.extract(drawing);
  }

  function update(drawingId: Id64String): void {
    const drawing = tc.db.elements.getElement<SectionDrawing>(drawingId);
    const provenance = SectionDrawingProvenance.compute(drawing);
    SectionDrawingProvenance.store(drawing, provenance);
    expect(SectionDrawingProvenance.extract(drawing)).to.deep.equal(provenance);
    drawing.update();
    tc.db.saveChanges();
  }

  function remove(drawingId: Id64String): void {
    const drawing = tc.db.elements.getElement<SectionDrawing>(drawingId);
    SectionDrawingProvenance.store(drawing, undefined);
    drawing.update();
    tc.db.saveChanges();
  }

  describe("compute", () => {
    it("produces a sorted list of the geometry GUIDs of all the models viewed by a spatial view", () => {
      const models = [0,0,0].map(() => tc.insertSpatialModelAndElement().model);
      const guids = models.map((modelId) => getGeometryGuid(modelId));
      const view = tc.insertSpatialView(models);
      const drawing = tc.insertSectionDrawing(view)
      const provenance = compute(drawing);
      expect(provenance.guids).to.deep.equal(guids.sort());
    });
  });

  describe("store", () => {
    it("inserts provenance if not previously stored", () => {
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(query(drawingId)).to.be.undefined;
      update(drawingId);
      expect(query(drawingId)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);
    });

    it("includes the JSON version", () => {
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(query(drawingId)).to.be.undefined;
      update(drawingId);

      const props = tc.db.elements.getElementProps(drawingId).jsonProperties![SectionDrawingProvenance.jsonKey];
      expect(props.version).to.equal("01.00.00");
      expect(JSON.stringify(props.data)).to.deep.equal(JSON.stringify(query(drawingId)));
    });

    it("updates the existing stored provenance with the newly-computed provenance", () => {
      const spatial = tc.insertSpatialModelAndElement();
      const drawingId = tc.insertSectionDrawing(tc.insertSpatialView([spatial.model]));
      const preGuid = getGeometryGuid(spatial.model);
      update(drawingId);

      expect(query(drawingId)!.guids).to.deep.equal([preGuid]);

      tc.touchSpatialElement(spatial.element);
      const postGuid = getGeometryGuid(spatial.model);
      expect(postGuid).not.to.equal(preGuid);

      update(drawingId);
      expect(query(drawingId)!.guids).to.deep.equal([postGuid]);
    });

    it("deletes the provenance if present", () => {
      const spatialModel = tc.insertSpatialModelAndElement().model;
      const spatialView = tc.insertSpatialView([spatialModel]);
      const drawingId = tc.insertSectionDrawing(spatialView);

      expect(query(drawingId)).to.be.undefined;
      update(drawingId);
      expect(query(drawingId)!.guids).to.deep.equal([getGeometryGuid(spatialModel)]);

      remove(drawingId);
      expect(query(drawingId)).to.be.undefined;
    });
  });
});

