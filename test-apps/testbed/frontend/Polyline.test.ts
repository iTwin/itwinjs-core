/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/* ###TODO adjust these tests...

import { expect } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { PolylineGeometry, PolylineArgs, PolylineInfo, PolylineTesselator, TesselatedPolyline, VertexLUT } from "@bentley/imodeljs-frontend/lib/rendering";
import { QPoint3dList, QParams3d } from "@bentley/imodeljs-common/lib/QPoint";
import { PolylineData, ColorIndex, ColorDef } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { Point3d } from "@bentley/geometry-core";

function testCreateGeometry() {
  // Create a PolylineArgs from known data.
  const points: Point3d[] = [
    Point3d.create(158.7800000000, 335.0000000000, 0.0000000000),
    Point3d.create(157.8624454198, 338.1249039249, 0.0000000000),
    Point3d.create(155.4010987752, 340.2576729331, 0.0000000000),
    Point3d.create(152.1774202348, 340.7211679341, 0.0000000000),
    Point3d.create(149.2149049578, 339.3682325398, 0.0000000000),
    Point3d.create(147.4541306125, 336.6284141785, 0.0000000000),
    Point3d.create(147.4541306125, 333.3715858215, 0.0000000000),
    Point3d.create(149.2149049578, 330.6317674602, 0.0000000000),
    Point3d.create(152.1774202348, 329.2788320659, 0.0000000000),
    Point3d.create(155.4010987752, 329.7423270669, 0.0000000000),
    Point3d.create(157.8624454198, 331.8750960751, 0.0000000000)];
  const indices: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0];
  const vertIndexExpected: number[] = [
    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0,
    1, 0, 0, 2, 0, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0,
    2, 0, 0, 3, 0, 0, 2, 0, 0, 2, 0, 0, 3, 0, 0, 3, 0, 0,
    3, 0, 0, 4, 0, 0, 3, 0, 0, 3, 0, 0, 4, 0, 0, 4, 0, 0,
    4, 0, 0, 5, 0, 0, 4, 0, 0, 4, 0, 0, 5, 0, 0, 5, 0, 0,
    5, 0, 0, 6, 0, 0, 5, 0, 0, 5, 0, 0, 6, 0, 0, 6, 0, 0,
    6, 0, 0, 7, 0, 0, 6, 0, 0, 6, 0, 0, 7, 0, 0, 7, 0, 0,
    7, 0, 0, 8, 0, 0, 7, 0, 0, 7, 0, 0, 8, 0, 0, 8, 0, 0,
    8, 0, 0, 9, 0, 0, 8, 0, 0, 8, 0, 0, 9, 0, 0, 9, 0, 0,
    9, 0, 0, 10, 0, 0, 9, 0, 0, 9, 0, 0, 10, 0, 0, 10, 0, 0,
    10, 0, 0, 0, 0, 0, 10, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0];
  const prevIndexExpected: number[] = [
    10, 0, 0, 2, 0, 0, 10, 0, 0, 10, 0, 0, 2, 0, 0, 2, 0, 0,
    0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 3, 0, 0,
    1, 0, 0, 4, 0, 0, 1, 0, 0, 1, 0, 0, 4, 0, 0, 4, 0, 0,
    2, 0, 0, 5, 0, 0, 2, 0, 0, 2, 0, 0, 5, 0, 0, 5, 0, 0,
    3, 0, 0, 6, 0, 0, 3, 0, 0, 3, 0, 0, 6, 0, 0, 6, 0, 0,
    4, 0, 0, 7, 0, 0, 4, 0, 0, 4, 0, 0, 7, 0, 0, 7, 0, 0,
    5, 0, 0, 8, 0, 0, 5, 0, 0, 5, 0, 0, 8, 0, 0, 8, 0, 0,
    6, 0, 0, 9, 0, 0, 6, 0, 0, 6, 0, 0, 9, 0, 0, 9, 0, 0,
    7, 0, 0, 10, 0, 0, 7, 0, 0, 7, 0, 0, 10, 0, 0, 10, 0, 0,
    8, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0,
    9, 0, 0, 1, 0, 0, 9, 0, 0, 9, 0, 0, 1, 0, 0, 1, 0, 0];
  const nextIndexAndParamExpected: number[] = [
    1, 0, 0, 30, 0, 0, 0, 54, 1, 0, 0, 6, 1, 0, 0, 6, 0, 0, 0, 54, 0, 0, 0, 78,
    2, 0, 0, 30, 1, 0, 0, 54, 2, 0, 0, 6, 2, 0, 0, 6, 1, 0, 0, 54, 1, 0, 0, 78,
    3, 0, 0, 30, 2, 0, 0, 54, 3, 0, 0, 6, 3, 0, 0, 6, 2, 0, 0, 54, 2, 0, 0, 78,
    4, 0, 0, 30, 3, 0, 0, 54, 4, 0, 0, 6, 4, 0, 0, 6, 3, 0, 0, 54, 3, 0, 0, 78,
    5, 0, 0, 30, 4, 0, 0, 54, 5, 0, 0, 6, 5, 0, 0, 6, 4, 0, 0, 54, 4, 0, 0, 78,
    6, 0, 0, 30, 5, 0, 0, 54, 6, 0, 0, 6, 6, 0, 0, 6, 5, 0, 0, 54, 5, 0, 0, 78,
    7, 0, 0, 30, 6, 0, 0, 54, 7, 0, 0, 6, 7, 0, 0, 6, 6, 0, 0, 54, 6, 0, 0, 78,
    8, 0, 0, 30, 7, 0, 0, 54, 8, 0, 0, 6, 8, 0, 0, 6, 7, 0, 0, 54, 7, 0, 0, 78,
    9, 0, 0, 30, 8, 0, 0, 54, 9, 0, 0, 6, 9, 0, 0, 6, 8, 0, 0, 54, 8, 0, 0, 78,
    10, 0, 0, 30, 9, 0, 0, 54, 10, 0, 0, 6, 10, 0, 0, 6, 9, 0, 0, 54, 9, 0, 0, 78,
    0, 0, 0, 30, 10, 0, 0, 54, 0, 0, 0, 6, 0, 0, 0, 6, 10, 0, 0, 54, 10, 0, 0, 78];
  const distanceExpected: number[] = [
    0.0000000000, 3.2568879128, 0.0000000000, 0.0000000000, 3.2568879128, 3.2568879128, 3.2568879128,
    6.5138335228, 3.2568879128, 3.2568879128, 6.5138335228, 6.5138335228, 6.5138335228, 9.7706756592,
    6.5138335228, 6.5138335228, 9.7706756592, 9.7706756592, 9.7706756592, 13.0275812149, 9.7706756592,
    9.7706756592, 13.0275812149, 13.0275812149, 13.0275812149, 16.2842464447, 13.0275812149, 13.0275812149,
    16.2842464447, 16.2842464447, 16.2842464447, 19.5412540436, 16.2842464447, 16.2842464447, 19.5412540436,
    19.5412540436, 19.5412540436, 22.7979202271, 19.5412540436, 19.5412540436, 22.7979202271, 22.7979202271,
    22.7979202271, 26.0548248291, 22.7979202271, 22.7979202271, 26.0548248291, 26.0548248291, 26.0548248291,
    29.3116683960, 26.0548248291, 26.0548248291, 29.3116683960, 29.3116683960, 29.3116683960, 32.5686149597,
    29.3116683960, 29.3116683960, 32.5686149597, 32.5686149597, 32.5686149597, 35.8253021240, 32.5686149597,
    32.5686149597, 35.8253021240, 35.8253021240];

  const range = Range3d.createNull();
  for (const p of points) {
    range.extendPoint(p);
  }
  const qp = QParams3d.fromRange(range);
  const pList = new QPoint3dList(qp);
  for (const p of points) {
    pList.add(p);
  }
  const pa = new PolylineArgs(pList);
  pa.colors = new ColorIndex();
  pa.colors.initUniform(ColorDef.from(255, 127, 0, 0));
  const pa2 = new PolylineArgs(pList);
  pa2.colors.initUniform(ColorDef.from(255, 255, 255, 0));
  pa2.width = 5;
  const pd = new PolylineData(indices, indices.length, 0.0);
  pa.polylines.push(pd);
  pa2.polylines.push(pd);

  // Use the PolylineArgs to tesselate the polyline as we would in the PolylineGeometry.create function.
  // This way we can check the output of the tesselator.  Once it is in the BufferHandles of the geometry
  // we can't look at it anymore.
  const lutParams: VertexLUT.Params = new VertexLUT.Params(new VertexLUT.SimpleBuilder(pa), pa.colors);
  const info = new PolylineInfo(pa);
  const lut = lutParams.toData(info.vertexParams);
  if (undefined !== lut) {
    const tess: PolylineTesselator = PolylineTesselator.fromPolyline(pa);
    const tp: TesselatedPolyline = tess.tesselate();

    expect(tp.vertIndex.length).to.equal(vertIndexExpected.length, "Wrong number of vertex indices created.");
    let i: number = 0;
    let same: boolean = true;
    for (const ndx of tp.vertIndex) {
      if (ndx !== vertIndexExpected[i++])
        same = false;
    }
    expect(same).to.equal(true, "Vertex indices in polyline are not as expected.");

    expect(tp.prevIndex.length).to.equal(prevIndexExpected.length, "Wrong number of previous vertex indices created.");
    i = 0;
    same = true;
    for (const ndx of tp.prevIndex) {
      if (ndx !== prevIndexExpected[i++])
        same = false;
    }
    expect(same).to.equal(true, "Previous vertex indices in polyline are not as expected.");

    expect(tp.prevIndex.length).to.equal(prevIndexExpected.length, "Wrong number of previous vertex indices created.");
    i = 0;
    same = true;
    for (const ndx of tp.prevIndex) {
      if (ndx !== prevIndexExpected[i++])
        same = false;
    }
    expect(same).to.equal(true, "Previous vertex indices in polyline are not as expected.");

    expect(tp.nextIndexAndParam.length).to.equal(nextIndexAndParamExpected.length, "Wrong number of next indices and params created.");
    i = 0;
    same = true;
    for (const ndx of tp.nextIndexAndParam) {
      if (ndx !== nextIndexAndParamExpected[i++])
        same = false;
    }
    expect(same).to.equal(true, "Next vertex indices and Params in polyline are not as expected.");

    expect(tp.distance.length).to.equal(distanceExpected.length, "Wrong number of distances created.");
    i = 0;
    same = true;
    const tol = 0.00021;
    for (const ndx of tp.distance) {
      if (Math.abs(ndx - distanceExpected[i++]) > tol)
        same = false;
    }
    expect(same).to.equal(true, "Distances in polyline created are not as expected.");
  }

  // Creating some PolylineGeometry.
  let pg = PolylineGeometry.create(pa);
  expect(pg).not.to.be.undefined;
  pg = PolylineGeometry.create(pa2);
  expect(pg).not.to.be.undefined;
}

describe("PolylineGeometry", () => {
  before(() => {
    WebGLTestContext.startup();
  });
  after(() => WebGLTestContext.shutdown());

  it("should produce correct PolylineGeometry from PolylineGeometry.createGeometry().", () => {
    if (WebGLTestContext.isInitialized) {
      testCreateGeometry();
    }
  });
});

###TODO adjust these tests */
