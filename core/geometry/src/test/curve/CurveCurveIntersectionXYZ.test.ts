/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/** Test number of intersections and coordinates of intersections. */
function testIntersectionsXYZ(
  ck: Checker,
  intersections: CurveLocationDetailPair[],
  minExpected: number,
  maxExpected: number,
  testCoordinates: boolean = true,
): boolean {
  const baseErrorCount = ck.getNumErrors();
  if (!intersections) {
    ck.testExactNumber(0, minExpected, `No intersections found but ${minExpected} expected`);
  } else {
    const n = intersections.length;
    if (n < minExpected || n > maxExpected) {
      ck.announceError("intersection count out of range", n, minExpected, maxExpected);
    }
    if (testCoordinates) {
      for (let i = 0; i < n; i++) {
        ck.testPoint3dXY(intersections[i].detailB.point, intersections[i].detailB.point, "CLD coordinate match");
        const fA = intersections[i].detailA.fraction;
        const fB = intersections[i].detailB.fraction;
        const cpA = intersections[i].detailA.curve;
        const cpB = intersections[i].detailB.curve;
        if (ck.testPointer(cpA) && ck.testPointer(cpB)) {
          ck.testPoint3d(cpA.fractionToPoint(fA), intersections[i].detailA.point);
          ck.testPoint3d(cpB.fractionToPoint(fB), intersections[i].detailB.point);
        }
      }
    }
  }
  return ck.getNumErrors() === baseErrorCount;
}

describe("CurveCurveIntersectXYZ", () => {
  it("LineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 5;
    const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
    const segment1 = LineSegment3d.createXYXY(4, 1, 2, 3);
    const segment2 = segment1.clone();
    segment2.tryTranslateInPlace(0, 0, 1);
    const intersectionsAB = CurveCurve.intersectionXYZPairs(segment0, false, segment1, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, segment1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);
    let numExpected = 1;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    const intersectionsBA = CurveCurve.intersectionXYZPairs(segment2, false, segment0, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment2, segment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx);
    numExpected = 0;
    testIntersectionsXYZ(ck, intersectionsBA, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLine");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineArcCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 15;
    const arc = Arc3d.create(Point3d.create(3, 1, 0), Vector3d.create(5, 1, 0), Vector3d.create(-1, 7, 0));
    const f0 = 0.0;
    const f1 = 0.25;
    const pointA = arc.fractionToPoint(f0);
    const pointB = arc.fractionToPoint(f1);
    const segment0 = LineSegment3d.create(pointA, pointB);
    const intersectionsAB = CurveCurve.intersectionXYZPairs(segment0, true, arc, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, arc]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    const intersectionsBA = CurveCurve.intersectionXYZPairs(arc, true, segment0, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, segment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx);
    testIntersectionsXYZ(ck, intersectionsBA, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineArcCoplanar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineArcNotCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const origPt = Point3d.create(0, 5);
    const origSeg = LineSegment3d.create(
      Point3d.create(origPt.x, origPt.y, 1), Point3d.create(origPt.x, origPt.y, -1),
    );
    const origArc = Arc3d.create(
      Point3d.createZero(), Vector3d.create(3, 4), Vector3d.create(-4, 3), AngleSweep.createStartSweepDegrees(0, 90),
    );
    let dx = 0;
    for (const trans of
      [
        Transform.identity,
        Transform.createRefs(undefined, Matrix3d.create90DegreeRotationAroundAxis(0)),
        Transform.createRefs(undefined, Matrix3d.create90DegreeRotationAroundAxis(1)),
        Transform.createRefs(
          Point3d.create(3, -2, -4),
          Matrix3d.createRotationAroundVector(Vector3d.create(-1, 1, 2), Angle.createDegrees(-27))!,
        ),
      ]
    ) {
      const arc = origArc.clone();
      const pt = trans.multiplyPoint3d(origPt);
      arc.tryTransformInPlace(trans);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, dx);
      const eps = 0.1;
      for (let i = 0; i < 10; ++i) {
        // Initially the segment is perpendicular to the arc normal.
        // Successive loop iterations slant the segment away from perpendicular.
        const seg = origSeg.clone();
        seg.point0Ref.x += i * eps;
        seg.point1Ref.x -= i * eps;
        seg.tryTransformInPlace(trans);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, seg, dx);
        const intersections = CurveCurve.intersectionXYZPairs(seg, false, arc, false);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.04, dx);
        if (ck.testLE(1, intersections.length)) {
          for (const intersection of intersections) {
            ck.testPoint3d(pt, intersection.detailA.point);
            ck.testPoint3d(pt, intersection.detailB.point);
          }
        }
      }
      dx += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineArcNotCoplanar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const linestring0 = LineString3d.create([1, 1, 1], [3, 0, 1], [3, 5, 1]);
    const linestring1 = LineString3d.create([2, 4, 1], [4, 1, 1], [2, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(linestring0, true, linestring1, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, linestring1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.04);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineStringLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 5;
    const lineSegment0 = LineSegment3d.create(Point3d.create(1, 4, 1), Point3d.create(5, 1, 1));
    const lineString1 = LineString3d.create([2, 4, 1], [4, 1, 1], [5, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(lineSegment0, true, lineString1, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [lineSegment0, lineString1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.04);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);
    const intersectionsX1 = CurveCurve.intersectionXYZPairs(lineString1, true, lineSegment0, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [lineString1, lineSegment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX1, 0.04, dx);
    testIntersectionsXYZ(ck, intersectionsX1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 8;
    const arc = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 4, 1), Point3d.create(4, 2, 1), Point3d.create(7, 4, 1),
    ) as Arc3d;
    const linestring = LineString3d.create([2, 4, 1], [4, 1, 1], [5, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(arc, false, linestring, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, linestring]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.04);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);
    const intersectionsX1 = CurveCurve.intersectionXYZPairs(linestring, false, arc, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring, arc], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX1, 0.04, dx);
    testIntersectionsXYZ(ck, intersectionsX1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcSkew", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.create(Point3d.create(1, 1, 1), Vector3d.create(4, 0, 0), Vector3d.create(0, 1, 0));
    const arcB = Arc3d.create(Point3d.create(1, 1, 1), Vector3d.create(0, 1, 0), Vector3d.create(0, 0, 2));
    const intersectionsAB = CurveCurve.intersectionXYZPairs(arcA, true, arcB, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcArcSkew");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcInPlane", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 12;
    const arcA = Arc3d.create(Point3d.create(1, 1, 1), Vector3d.create(4, 0, 0), Vector3d.create(0, 4, 0));
    const arcB = Arc3d.create(Point3d.create(4, 1, 1), Vector3d.create(2, 2, 0), Vector3d.create(-2, 2, 0));
    const intersectionsAB = CurveCurve.intersectionXYZPairs(arcA, true, arcB, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);
    let numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    arcA.tryTranslateInPlace(0, 0, 1);
    const intersectionsAB1 = CurveCurve.intersectionXYZPairs(arcA, true, arcB, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB1, 0.04, dx);
    numExpected = 0;
    testIntersectionsXYZ(ck, intersectionsAB1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcArcInPlane");
    expect(ck.getNumErrors()).equals(0);
  });
});
