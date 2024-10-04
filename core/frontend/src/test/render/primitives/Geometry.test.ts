/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { IndexedPolyface, LineString3d, Loop, Path, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, GraphicParams } from "@itwin/core-common";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";
import { StrokesPrimitiveList, StrokesPrimitivePointList, StrokesPrimitivePointLists } from "../../../common/internal/render/Strokes";
import { PolyfacePrimitive, PolyfacePrimitiveList } from "../../../common/internal/render/Polyface";

function pointIsInArray(pt: Point3d, arr: Point3d[]): boolean {
  for (const arrPt of arr) {
    if (pt.isAlmostEqual(arrPt))
      return true;
  }
  return false;
}

function pointIsInPolyface(pt: Point3d, pf: IndexedPolyface): boolean {
  for (let i = 0; i < pf.data.pointCount; i++) {
    if (pt.isAlmostEqual(pf.data.getPoint(i)!))
      return true;
  }
  return false;
}

describe("GeometryPrimitives tests", () => {
  it("should produce PrimitiveLoopGeometry with strokes and polyface", () => {
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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    // query stroke list from loopGeom
    const strokesPrimList: StrokesPrimitiveList | undefined = loopGeom.getStrokes(0.0);

    expect(strokesPrimList).toBeDefined();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;
    expect(strksPrims.length).to.be.greaterThan(0);
    const strks: StrokesPrimitivePointList = strksPrims[0];
    expect(strks.points.length).toEqual(points.length);

    for (const pt of points) { // compare generated (stroked) points to original points
      expect(pointIsInArray(pt, strks.points)).toBe(true);
    }

    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);

    expect(pfPrimList).toBeDefined();
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).to.be.greaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).toEqual(points.length);

    for (const pt of points) { // compare generated polyface points to original points
      expect(pointIsInPolyface(pt, pfPrim.indexedPolyface)).toBe(true);
    }

    /*
    // this shouldn't really have many facets (it's just a quad)...
    const visitor = pfPrim.indexedPolyface.createVisitor();
    let numFacets = 0;
    do {
      numFacets++;
    } while (visitor.moveToNextFacet());
    expect(numFacets).to.be.lessThan(4);
    */
  });

  it("should produce PrimitivePathGeometry with strokes and no polyfaces", () => {
    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));

    const line = LineString3d.create(points);
    const pth = Path.create(line);

    const pathRange: Range3d = new Range3d();
    pth.range(undefined, pathRange);
    expect(pathRange).to.not.be.null;

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.lineColor = ColorDef.white;
    const displayParams: DisplayParams = DisplayParams.createForLinear(gfParams);

    const pathGeom = Geometry.createFromPath(pth, Transform.createIdentity(), pathRange, displayParams, false, undefined);

    // query stroke list from pathGeom
    const strokesPrimList: StrokesPrimitiveList | undefined = pathGeom.getStrokes(0.0);

    expect(strokesPrimList).toBeDefined();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    const strks: StrokesPrimitivePointList = strksPrims[0];
    expect(strks.points.length).toEqual(points.length);

    for (const pt of points) { // compare generated (stroked) points to original points
      expect(pointIsInArray(pt, strks.points)).toBe(true);
    }

    // query polyface list from pathGeom (should be undefined - can't get polys from paths)
    const pfPrimList: PolyfacePrimitiveList | undefined = pathGeom.getPolyfaces(0);
    expect(pfPrimList).toBeUndefined();
  });
});
