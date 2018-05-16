/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { IModelApp, IModelConnection, Viewport, SpatialViewState, StandardViewId } from "@bentley/imodeljs-frontend";
import * as path from "path";
import {
  Geometry,
  DisplayParams,
  StrokesPrimitiveList,
  StrokesPrimitivePointLists,
  StrokesPrimitivePointList,
  PolyfacePrimitiveList,
  PolyfacePrimitive,
  PrimitiveBuilder,
  System,
  GraphicBuilderCreateParams,
  GraphicType,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { Loop, Path, LineString3d, Point3d, Transform, Range3d, StrokeOptions, IndexedPolyface, Arc3d } from "@bentley/geometry-core";
import { GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ColorDef } from "@bentley/imodeljs-common";
import { CONSTANTS } from "../common/Testbed";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

function pointIsInArray(pt: Point3d, arr: Point3d[]): boolean {
  for (const arrPt of arr) {
    if (pt.isAlmostEqual(arrPt))
      return true;
  }
  return false;
}

function pointIsInPolyface(pt: Point3d, pf: IndexedPolyface): boolean {
  for (let i = 0; i < pf.data.pointCount; i++) {
    if (pt.isAlmostEqual(pf.data.getPoint(i)))
      return true;
  }
  return false;
}

describe("Geometry tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert(null !== canvas);
  canvas!.width = canvas!.height = 1000;
  document.body.appendChild(canvas!);

  before(async () => {   // Create a ViewState to load into a Viewport
    IModelApp.startup("QA", true);
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.closeStandalone();
    IModelApp.shutdown();
  });

  it("should produce PrimitiveLoopGeometry with strokes and polyface", () => {
    /*
    if (!IModelApp.hasRenderSystem) {
      return;
    }
    */

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).to.not.be.null;

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    // query stroke list from loopGeom
    let facetOptions: StrokeOptions = StrokeOptions.createForCurves();
    const strokesPrimList: StrokesPrimitiveList | undefined = loopGeom.getStrokes(facetOptions);

    assert(strokesPrimList !== undefined);
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;
    expect(strksPrims.length).to.be.greaterThan(0);
    const strks: StrokesPrimitivePointList = strksPrims[0];
    expect(strks.points.length).to.equal(points.length);

    for (const pt of points) { // compare generated (stroked) points to original points
      expect(pointIsInArray(pt, strks.points)).to.be.true;
    }

    // query polyface list from loopGeom
    facetOptions = StrokeOptions.createForFacets();
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(facetOptions);

    assert(pfPrimList !== undefined);
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).to.be.greaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).to.equal(points.length);

    for (const pt of points) { // compare generated polyface points to original points
      expect(pointIsInPolyface(pt, pfPrim.indexedPolyface)).to.be.true;
    }
  });

  it("should produce PrimitivePathGeometry with strokes and no polyfaces", () => {
    /*
    if (!IModelApp.hasRenderSystem) {
      return;
    }
    */

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));

    const line = LineString3d.create(points);
    const pth = Path.create(line);

    const pathRange: Range3d = new Range3d();
    pth.range(undefined, pathRange);
    expect(pathRange).to.not.be.null;

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    const displayParams: DisplayParams = DisplayParams.createForLinear(gfParams);

    const pathGeom = Geometry.createFromPath(pth, Transform.createIdentity(), pathRange, displayParams, false);

    // query stroke list from pathGeom
    let facetOptions: StrokeOptions = StrokeOptions.createForCurves();
    const strokesPrimList: StrokesPrimitiveList | undefined = pathGeom.getStrokes(facetOptions);

    assert(strokesPrimList !== undefined);
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;
    expect(strksPrims.length).to.be.greaterThan(0);
    const strks: StrokesPrimitivePointList = strksPrims[0];
    expect(strks.points.length).to.equal(points.length);

    for (const pt of points) { // compare generated (stroked) points to original points
      expect(pointIsInArray(pt, strks.points)).to.be.true;
    }

    // query polyface list from pathGeom (should be undefined - can't get polys from paths)
    facetOptions = StrokeOptions.createForFacets();
    const pfPrimList: PolyfacePrimitiveList | undefined = pathGeom.getPolyfaces(facetOptions);
    expect(pfPrimList).to.be.undefined;
  });

  it("PrimitiveBuilder should produce proper arc strokes for specific tolerances", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const viewport = new Viewport(canvas, spatialView);
    const gfParams = GraphicBuilderCreateParams.create(GraphicType.Scene, viewport);
    const primBuilder = new PrimitiveBuilder(System.instance, gfParams);

    const pointA = new Point3d(-1, 0, 0);
    const pointB = new Point3d(0, 1, 0);
    const pointC = new Point3d(1, 0, 0);
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

    // query the arcGeom stroked with chordTol = 10
    const facetOptions: StrokeOptions = StrokeOptions.createForCurves();
    facetOptions.chordTol = 10.0;
    let strokesPrimList: StrokesPrimitiveList | undefined = arcGeom.getStrokes(facetOptions);

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
    // const numPointsA = strks.points.length;

    // query the arcGeom stroked with chordTol = 1
    facetOptions.chordTol = 1.0;
    strokesPrimList = arcGeom.getStrokes(facetOptions);

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
    // const numPointsB = strks.points.length;

    // ###TODO
    // expect(numPointsA).to.be.lessThan(numPointsB);
  });
});
