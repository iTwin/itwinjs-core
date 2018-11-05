/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { LineString3d } from "../curve/LineString3d";
import { Checker } from "./Checker";
import { expect } from "chai";
import { ClipPlane } from "../clipping/ClipPlane";
import { CurvePrimitive } from "../curve/CurvePrimitive";

function exerciseLineString3d(ck: Checker, lsA: LineString3d) {
  const expectValidResults = lsA.numPoints() > 1;
  const a = 4.2;
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(4, 3),
    Matrix3d.createScale(a, a, a));
  const lsB = lsA.clone();
  lsB.reverseInPlace();
  const lsC = lsA.clone()!;
  ck.testTrue(lsC.tryTransformInPlace(scaleTransform));
  // exercise evaluation logic within each segment.
  // force evaluations in zero segment linestring
  for (let segmentIndex = 0; segmentIndex === 0 || segmentIndex + 1 < lsA.numPoints(); segmentIndex++) {
    for (const localFraction of [0.1, 0.1, 0.6, 0.6]) {
      const globalFraction = lsA.segmentIndexAndLocalFractionToGlobalFraction(segmentIndex, localFraction);
      const frame = lsA.fractionToFrenetFrame(globalFraction);
      const xyz = lsA.fractionToPoint(globalFraction);
      const ray = lsA.fractionToPointAndDerivative(globalFraction);
      const closestPointDetail = lsA.closestPoint(xyz, false);
      if (expectValidResults) {
        ck.testTrue(frame.matrix.isRigid());
        ck.testPoint3d(xyz, ray.origin);
        ck.testPoint3d(xyz, frame.getOrigin(), "frenet vs fractionToPoint", lsA, segmentIndex, localFraction, globalFraction);
        ck.testCoordinate(globalFraction, closestPointDetail.fraction);
      }
    }
  }
  const splitFraction = 0.4203;
  const partA = lsA.clonePartialCurve(0.0, splitFraction);
  const partB = lsA.clonePartialCurve(1.0, splitFraction);  // reversed to exercise more code.  But length is absolute so it will add.
  if (expectValidResults
    && ck.testPointer(partA, "forward partial") && partA
    && ck.testPointer(partA, "forward partial") && partB) {
    ck.testCoordinate(lsA.curveLength(), partA.curveLength() + partB.curveLength(), "Partial curves sum to length", lsA, partA, partB);
  }
}
describe("LineString3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    exerciseLineString3d(ck, ls0);
    ls0.addPoint(Point3d.create(4, 3, 2));
    exerciseLineString3d(ck, ls0);

    const lsA = LineString3d.create([
      Point3d.create(1, 0, 0),
      Point3d.create(4, 2, 0),
      Point3d.create(4, 5, 0),
      Point3d.create(1, 5, 0)]);
    exerciseLineString3d(ck, lsA);
    const lsB = LineString3d.createRectangleXY(
      Point3d.create(1, 1),
      3, 2, true);
    exerciseLineString3d(ck, lsB);
    ck.checkpoint("LineString3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("RegularPolygon", () => {
    const ck = new Checker();
    const center = Point3d.create(3, 2, 1);
    const radius = 2.0;
    const poly1 = LineString3d.createRegularPolygonXY(center, 2, radius, true);
    const poly4 = LineString3d.createRegularPolygonXY(center, 4, radius, true);
    const poly4F = LineString3d.createRegularPolygonXY(center, 4, radius, false);
    ck.testUndefined(poly1.getIndexedSegment(5));
    ck.testFalse(poly4.isAlmostEqual(poly1));
    for (let i = 0; i < 4; i++) {
      ck.testCoordinate(radius, center.distance(poly4.pointAt(i)!)); // TRUE poly has points on the radius
      ck.testLE(radius, center.distance(poly4F.pointAt(i)!)); // FALSE poly has points outside the radius
      // const segment = poly4.getIndexedSegment(i);
      const segmentF = poly4F.getIndexedSegment(i)!;
      const detail = segmentF.closestPoint(center, false);
      ck.testCoordinate(0.5, detail.fraction);
      ck.testCoordinate(radius, center.distance(detail.point));
    }
    const data64 = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const polyF64 = LineString3d.createFloat64Array(data64);
    ck.testExactNumber(3 * polyF64.numPoints(), data64.length);
    expect(ck.getNumErrors()).equals(0);
  });
  it("AnnounceClipIntervals", () => {
    const ck = new Checker();
    const ls = LineString3d.create(Point3d.create(1, 1, 0), Point3d.create(4, 1, 0), Point3d.create(4, 2, 0), Point3d.create(0, 2, 0));
    const clipper = ClipPlane.createEdgeXY(Point3d.create(2, 0, 0), Point3d.create(0, 5, 0))!;
    // The linestring starts in, goes out, and comes back.  Verify 2 segments announced.
    let numAnnounce = 0;
    ls.announceClipIntervals(clipper,
      (_a0: number, _a1: number, _cp: CurvePrimitive) => {
        numAnnounce++;
      });
    ck.testExactNumber(numAnnounce, 2);
    expect(ck.getNumErrors()).equals(0);
  });

});
