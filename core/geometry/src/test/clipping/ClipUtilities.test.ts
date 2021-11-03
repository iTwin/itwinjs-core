/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Angle } from "../../geometry3d/Angle";
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, UnionOfConvexClipPlaneSets } from "../../core-geometry";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point2d} from "../../geometry3d/Point2dVector2d";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";

describe("ParityRegionSweep", () => {
it("triangleClip", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const pointA = Point3d.create (-10,4);
  const pointB = Point3d.create (6,1);
  const pointC = Point3d.create (2,5);
  const vector01 = Vector3d.create(1, 7);
  const dxA = 1.5;
  const intervals = [
    Range1d.createXX(0, 1), Range1d.createXX(0.3, 1.0),
    Range1d.createXX(0.6, 1.0), Range1d.createXX(0, 0.5),
    Range1d.createXX(0.5, 1.0), Range1d.createXX(0.2, 0.8)];
  const xOut = 0;
  const yOut0 = 0;
  const yOut1 = 10.0;
  const yOut2 = 20.0;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut1);
  for (let x0 = -3; x0 <= 5.0; x0 += dxA){
    const segment0 = Point3d.create(x0, 0, 0);
    const segment1 = segment0.plus(vector01);
    let dx = 0.0;
    for (const interval of intervals) {
      segment0.x += dx;
      segment1.x += dx;
      dx += 0.02;
      const segment2 = segment0.interpolate(interval.low, segment1);
      const segment3 = segment0.interpolate(interval.high, segment1);
      const resultABC = Range1d.createXX(0, 1);
      ClipUtilities.clipSegmentToCCWTriangleXY(pointA, pointB, pointC, segment2, segment3, resultABC);
      const resultBCA = Range1d.createXX(0, 1);
      ClipUtilities.clipSegmentToCCWTriangleXY(pointB, pointC, pointA, segment2, segment3, resultBCA);
      ck.testTightNumber(resultABC.length(), resultBCA.length(), "clip fraction length with rotated triangle order");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment2, segment3], xOut, yOut0);
      if (!resultABC.isNull) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry,
          [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
          xOut, yOut1);
        }
      if (!resultBCA.isNull) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry,
          [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
          xOut, yOut2);
        }
      }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "triangleClip");
  expect(ck.getNumErrors()).equals(0);
});

});

describe("ClipUtilities", () => {
  it("ConvexClipPlaneSetComplement", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
    const a = 0.2;
    const b = 0.6;
    const c = 0.4;
    const rangeA = Range3d.createXYZXYZ(a, a, a, b, b, c);
    const a1 = a + 0.1;
    const b1 = b + 0.1;
    const c1 = c - 0.05;
    const d1 = 1.8;
    const rangeB = Range3d.createXYZXYZ(b, a1, a1, d1, b1, c1);
    const xy0 = Point2d.create(0, 0);
    const a3= 1.5;
    const b3 = 3.0;
    const outerRange = Range3d.createXYZXYZ(a3, a3, a3, b3, b3, b3);
    const clipperA = ConvexClipPlaneSet.createRange3dPlanes(rangeA);
    const clipperB = ConvexClipPlaneSet.createRange3dPlanes(rangeB);
    ck.testTrue(ClipUtilities.doesClipperIntersectRange(clipperA, unitRange));
    ck.testFalse(ClipUtilities.doesClipperIntersectRange(clipperB, outerRange));
    const unionClip = UnionOfConvexClipPlaneSets.createEmpty();
    for (const range of [rangeA, rangeB]) {
      xy0.y =  0;
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range, true, true, true, true, true, true);
      unionClip.addConvexSet(clipper);
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      const rotation = Transform.createFixedPointAndMatrix(range.fractionToPoint(0.5, 0.5, 0.5),
        Matrix3d.createRotationAroundVector(Vector3d.create(1, 0.4, 0.3), Angle.createDegrees(20))!);
      clipper.transformInPlace(rotation);
      xy0.x += 5.0;
      xy0.y = 0.0;
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      xy0.x += 5.0;

      // chop off a corner
      const chop0 = range.fractionToPoint(1, 0, 0.2);
      const chop1 = range.fractionToPoint(1, 1, 0.6);
      const chop2 = range.fractionToPoint(0.2, 0, 1);
      rotation.multiplyPoint3d(chop0, chop0);
      rotation.multiplyPoint3d(chop1, chop1);
      rotation.multiplyPoint3d(chop2, chop2);
      const chopNormal = Vector3d.createCrossProductToPoints(chop0, chop2, chop1);
      const chopPlane = Plane3dByOriginAndUnitNormal.create(chop0, chopNormal);
      clipper.addPlaneToConvexSet(chopPlane);
      xy0.y = 0.0;
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      xy0.x += 5.0;
    }
    xy0.x += 5.0;
    const clipperLoopsA = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(unionClip, unitRange, true, false, true);
    const rangeLoopsA = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(unionClip, unitRange, false, true, true);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipperLoopsA, xy0.x, xy0.y);
    xy0.x += 5.0;
    GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rangeLoopsA, xy0.x, xy0.y);

    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ConvexClipPlaneSetComplement");
  expect(ck.getNumErrors()).equals(0);
});

});

function rangeOfGeometry(geometry: GeometryQuery[]): Range3d{
  const range = Range3d.createNull();
  for (const g of geometry)
    range.extendRange(g.range());
  return range;
}

function exerciseClipper(ck: Checker, allGeometry: GeometryQuery[], outerRange: Range3d, clipper: ConvexClipPlaneSet,
  xy0: Point2d) {
  const clipperLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipper, outerRange, true, false, true);
  const rangeLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipper, outerRange, false, true, true);

  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  xy0.y += 2;
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipperLoops, xy0.x, xy0.y);
  xy0.y += 2;
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, rangeLoops, xy0.x, xy0.y);

  const range100 = ClipUtilities.rangeOfClipperIntersectionWithRange(clipper, outerRange, false);
  const range101 = rangeOfGeometry(clipperLoops.concat(rangeLoops));
  ck.testRange3d(range100, range101);
  xy0.y += 3;
  const outerClipSet = ClipUtilities.createComplementaryClips(clipper);
  const outerLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(outerClipSet, outerRange, true, false);
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, outerLoops, xy0.x, xy0.y);
  xy0.y += 3;
  for (const cell of outerClipSet.convexSets) {
    const loops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(cell, outerRange, true, false);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops, xy0.x, xy0.y);
    xy0.y += 1.5;
  }
}
