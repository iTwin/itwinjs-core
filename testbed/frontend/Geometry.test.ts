/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  Geometry,
  DisplayParams,
  StrokesPrimitiveList,
  StrokesPrimitivePointLists,
  StrokesPrimitivePointList,
  PolyfacePrimitiveList,
  PolyfacePrimitive,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { Loop, Path, LineString3d, Point3d, Transform, Range3d, StrokeOptions, IndexedPolyface } from "@bentley/geometry-core";
import { GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ColorDef } from "@bentley/imodeljs-common";

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
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce PrimitiveLoopGeometry with strokes and polyface", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

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
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));

    const line = LineString3d.create(points);
    const path = Path.create(line);

    const pathRange: Range3d = new Range3d();
    path.range(undefined, pathRange);
    expect(pathRange).to.not.be.null;

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    const displayParams: DisplayParams = DisplayParams.createForLinear(gfParams);

    const pathGeom = Geometry.createFromPath(path, Transform.createIdentity(), pathRange, displayParams, false);

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
});
