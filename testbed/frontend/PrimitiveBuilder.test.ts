/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { IModelApp, IModelConnection, Viewport, SpatialViewState, StandardViewId } from "@bentley/imodeljs-frontend";
import * as path from "path";
import {
  Geometry,
  StrokesPrimitiveList,
  StrokesPrimitivePointLists,
  StrokesPrimitivePointList,
  PrimitiveBuilder,
  System,
  GraphicBuilderCreateParams,
  GraphicType,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { Arc3d, Point3d } from "@bentley/geometry-core";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("PrimitiveBuilder tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert(null !== canvas);
  canvas!.width = canvas!.height = 1000;
  document.body.appendChild(canvas!);

  before(async () => {   // Create a ViewState to load into a Viewport
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("PrimitiveBuilder should produce proper arc strokes for specific tolerances", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const viewport = new Viewport(canvas, spatialView);
    const gfParams = GraphicBuilderCreateParams.create(GraphicType.Scene, viewport);
    const primBuilder = new PrimitiveBuilder(System.instance, gfParams);

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const arc = Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC);
    assert(arc !== undefined && arc instanceof Arc3d);
    if (arc === undefined || !(arc instanceof Arc3d))
      return;

    primBuilder.addArc(arc, false, false);

    assert(!(primBuilder.accum.geometries.isEmpty));

    const arcGeom: Geometry | undefined = primBuilder.accum.geometries.first;
    assert(arcGeom !== undefined);
    if (arcGeom === undefined)
      return;

    let strokesPrimList: StrokesPrimitiveList | undefined = arcGeom.getStrokes(0.22);

    assert(strokesPrimList !== undefined);
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    let strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;
    expect(strksPrims.length).to.be.greaterThan(0);
    let strks: StrokesPrimitivePointList = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).to.be.true;
    expect(strks.points[strks.points.length - 1].isAlmostEqual(pointC)).to.be.true;
    const numPointsA = strks.points.length;

    strokesPrimList = arcGeom.getStrokes(0.12);

    assert(strokesPrimList !== undefined);
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).to.be.greaterThan(0);
    strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).to.be.true;
    expect(strks.points[strks.points.length - 1].isAlmostEqual(pointC)).to.be.true;
    const numPointsB = strks.points.length;

    expect(numPointsA).to.be.lessThan(numPointsB);
  });

  // ###TODO
  // it("PrimitiveBuilder should be able to finish graphics", () => {

  // });
});
