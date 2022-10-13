/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { fakeContext } from "./Mocks";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { ArcGisFeatureRenderer } from "../../ArcGisFeature/ArcGisFeatureRenderer";
import { Point3d, Transform } from "@itwin/core-geometry";

describe("ArcGisFeatureRenderer", () => {

  const sandbox = sinon.createSandbox();

  let beginPathSpy: sinon.SinonSpy<[], void>;
  let moveToSpy: sinon.SinonSpy<[x: number, y: number], void>;
  let lineToSpy: sinon.SinonSpy<[x: number, y: number], void>;
  let strokeSpy: sinon.SinonSpy<[path: Path2D], void>;
  let fillSpy: sinon.SinonSpy<[path: Path2D, fillRule?: CanvasFillRule | undefined], void>;
  let closePathSpy: sinon.SinonSpy<[], void>;

  beforeEach(async () => {
    beginPathSpy = sandbox.spy(fakeContext, "beginPath");
    moveToSpy = sandbox.spy(fakeContext, "moveTo");
    lineToSpy = sandbox.spy(fakeContext, "lineTo");
    strokeSpy = sandbox.spy(fakeContext, "stroke");
    fillSpy = sandbox.spy(fakeContext, "fill");
    closePathSpy = sandbox.spy(fakeContext, "closePath");
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should render simple path, stride = 2", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const coords = [1,2,3,4];
    const applyFillStyleSpy = sandbox.spy(symbolRenderer, "applyFillStyle");
    const applyStrokeStyleSpy = sandbox.spy(symbolRenderer, "applyStrokeStyle");

    renderer.renderPath([2], coords, false, 2, true);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]);

    expect(lineToSpy.calledOnce).to.be.true;

    // IMPORTANT: Only first coord is absolute, following coords are expressed relative to previous coord.
    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[0] + coords[2]);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[1] + coords[3]);

    expect(strokeSpy.calledOnce).to.be.true;
    expect(fillSpy.called).to.be.false;
    expect(closePathSpy.called).to.be.false;
    expect(applyFillStyleSpy.calledOnce).to.be.false;
    expect(applyStrokeStyleSpy.calledOnce).to.be.true;
  });

  it("should render simple filled path", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const coords = [1,2,3,4];

    const applyFillStyleSpy = sandbox.spy(symbolRenderer, "applyFillStyle");
    const applyStrokeStyleSpy = sandbox.spy(symbolRenderer, "applyStrokeStyle");
    renderer.renderPath([2], coords, true, 2, true);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]);

    expect(lineToSpy.calledOnce).to.be.true;

    // IMPORTANT: Only first coord is absolute, following coords are expressed relative to previous coord.
    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[0] + coords[2]);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[1] + coords[3]);

    expect(strokeSpy.calledOnce).to.be.true;
    expect(fillSpy.calledOnce).to.be.true;
    expect(closePathSpy.calledOnce).to.be.true;

    expect(applyFillStyleSpy.calledOnce).to.be.true;
    expect(applyStrokeStyleSpy.calledOnce).to.be.true;

  });

  it("should render simple Path, stride = 3", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const coords = [1,2,3,4,5,6];

    renderer.renderPath([2], coords, false, 3, true);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]);

    expect(lineToSpy.calledOnce).to.be.true;

    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[0] + coords[3]);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[1] + coords[4]);

    expect(strokeSpy.calledOnce).to.be.true;
    expect(fillSpy.called).to.be.false;
    expect(closePathSpy.called).to.be.false;

  });

  it("should render multiple Paths, stride = 2", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const coords = [1,2,3,4];
    const applyFillStyleSpy = sandbox.spy(symbolRenderer, "applyFillStyle");
    const applyStrokeStyleSpy = sandbox.spy(symbolRenderer, "applyStrokeStyle");

    renderer.renderPath([2], coords, false, 2, true);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]);

    expect(lineToSpy.calledOnce).to.be.true;

    // IMPORTANT: Only first coord is absolute, following coords are expressed relative to previous coord.
    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[0] + coords[2]);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[1] + coords[3]);

    expect(strokeSpy.calledOnce).to.be.true;
    expect(fillSpy.called).to.be.false;
    expect(closePathSpy.called).to.be.false;
    expect(applyFillStyleSpy.calledOnce).to.be.false;
    expect(applyStrokeStyleSpy.calledOnce).to.be.true;
  });

  it("should not render invalid with stride value", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const coords = [1,2,3,4];

    renderer.renderPath([2], coords, false, 1, true);
    renderer.renderPath([2], coords, false, 4, true);

    expect(lineToSpy.calledOnce).to.be.false;
    expect(strokeSpy.calledOnce).to.be.false;
    expect(fillSpy.called).to.be.false;
    expect(closePathSpy.called).to.be.false;
  });

  it("should render and apply transform, relativeCoords OFF", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const fakeOffset = 10;
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer, Transform.createTranslation(Point3d.create(fakeOffset,fakeOffset)));
    const coords = [1,2,3,4];

    renderer.renderPath([2], coords, false, 2, false);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]+fakeOffset);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]+fakeOffset);

    expect(lineToSpy.calledOnce).to.be.true;

    // IMPORTANT: Only first coord is absolute, following coords are expressed relative to previous coord.
    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[2] + fakeOffset);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[3] + fakeOffset);

  });

  it("should render and apply transform, relativeCoords ON", async () => {

    const symbolRenderer = new ArcGisSymbologyRenderer("esriGeometryLine", PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const fakeOffset = 10;
    const renderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer, Transform.createTranslation(Point3d.create(fakeOffset,fakeOffset)));
    const coords = [1,2,3,4];

    renderer.renderPath([2], coords, false, 2, true);

    expect(beginPathSpy.calledOnce).to.be.true;
    expect(moveToSpy.calledOnce).to.be.true;
    expect(moveToSpy.getCalls()[0].args[0]).to.equals(coords[0]+fakeOffset);
    expect(moveToSpy.getCalls()[0].args[1]).to.equals(coords[1]+fakeOffset);

    expect(lineToSpy.calledOnce).to.be.true;

    // IMPORTANT: Only first coord is absolute, following coords are expressed relative to previous coord.
    expect(lineToSpy.getCalls()[0].args[0]).to.equals(coords[0] + coords[2] + fakeOffset);
    expect(lineToSpy.getCalls()[0].args[1]).to.equals(coords[1] + coords[3] + fakeOffset);

  });

});
