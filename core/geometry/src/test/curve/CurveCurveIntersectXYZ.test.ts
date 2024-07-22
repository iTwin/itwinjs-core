/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { UnionRegion } from "../../curve/UnionRegion";
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
        ck.testPoint3d(intersections[i].detailB.point, intersections[i].detailB.point, "CLD coordinate match");
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
  it("LineLineCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 5;
    const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
    const segment1 = LineSegment3d.createXYXY(4, 1, 2, 3);
    const segment2 = segment1.clone();
    segment2.tryTranslateInPlace(0, 0, 1);
    const intersectionsAB = CurveCurve.intersectionXYZPairs(segment0, false, segment1, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, segment1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);
    let numExpected = 1;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    const intersectionsBA = CurveCurve.intersectionXYZPairs(segment2, false, segment0, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment2, segment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx);
    numExpected = 0;
    testIntersectionsXYZ(ck, intersectionsBA, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLineCoplanar");
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
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    const intersectionsBA = CurveCurve.intersectionXYZPairs(arc, true, segment0, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, segment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx);
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
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05, dx);
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
  it("LineStringLineStringCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const linestring0 = LineString3d.create([1, 1, 1], [3, 0, 1], [3, 5, 1]);
    const linestring1 = LineString3d.create([2, 4, 1], [4, 1, 1], [2, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(linestring0, true, linestring1, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, linestring1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.05);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineStringLineStringCoplanar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineStringCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 5;
    const lineSegment0 = LineSegment3d.create(Point3d.create(1, 4, 1), Point3d.create(5, 1, 1));
    const lineString1 = LineString3d.create([2, 4, 1], [4, 1, 1], [5, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(lineSegment0, true, lineString1, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [lineSegment0, lineString1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.05);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);
    const intersectionsX1 = CurveCurve.intersectionXYZPairs(lineString1, true, lineSegment0, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [lineString1, lineSegment0], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX1, 0.05, dx);
    testIntersectionsXYZ(ck, intersectionsX1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLineStringCoplanar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcLineStringCoplanar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 8;
    const arc = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 4, 1), Point3d.create(4, 2, 1), Point3d.create(7, 4, 1),
    ) as Arc3d;
    const linestring = LineString3d.create([2, 4, 1], [4, 1, 1], [5, 5, 1]);
    const intersectionsX = CurveCurve.intersectionXYZPairs(arc, false, linestring, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, linestring]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.05);
    const numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsX, numExpected, numExpected);
    const intersectionsX1 = CurveCurve.intersectionXYZPairs(linestring, false, arc, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring, arc], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX1, 0.05, dx);
    testIntersectionsXYZ(ck, intersectionsX1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcLineStringCoplanar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcSkew", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.create(Point3d.create(1, 1, 1), Vector3d.create(4, 0, 0), Vector3d.create(0, 1, 0));
    const arcB = Arc3d.create(Point3d.create(1, 1, 1), Vector3d.create(0, 1, 0), Vector3d.create(0, 0, 2));
    const intersectionsAB = CurveCurve.intersectionXYZPairs(arcA, true, arcB, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);
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
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);
    let numExpected = 2;
    testIntersectionsXYZ(ck, intersectionsAB, numExpected, numExpected);
    arcA.tryTranslateInPlace(0, 0, 1);
    const intersectionsAB1 = CurveCurve.intersectionXYZPairs(arcA, true, arcB, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB], dx);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB1, 0.05, dx);
    numExpected = 0;
    testIntersectionsXYZ(ck, intersectionsAB1, numExpected, numExpected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcArcInPlane");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-3, 3, 0, 3, 3, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYZXYZ(0, 3, -5, 0, 3, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point3d.create(0, 3, 0);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3d(i1, i2);
    ck.testExactNumber(i1.x, expectedIntersectionXY.x);
    ck.testExactNumber(i1.y, expectedIntersectionXY.y);
    ck.testExactNumber(i1.z, expectedIntersectionXY.z);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLine");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineString1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 0, 0, 8, 3, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0, 0], [2, 3, 0], [3, 0, 0], [4, 2, -1], [5, 0, 0], [6, 3, 0], [7, 0, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 3;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLineString1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineString2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(2, 0, 0, 6, 4, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 0], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point3d.create(4, 2, 0);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3d(i1, i2);
    ck.testExactNumber(i1.x, expectedIntersectionXY.x);
    ck.testExactNumber(i1.y, expectedIntersectionXY.y);
    ck.testExactNumber(i1.z, expectedIntersectionXY.z);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLineString2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(1, 2, -3, -1, 2, 3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0), Point3d.create(0, 2), Point3d.create(2, 0),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point3d.create(0, 2, 0);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3d(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    ck.testTightNumber(i1.z, expectedIntersectionXY.z);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineArc");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LinePath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 3, 0, 11, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([5, 2, 0], [6, 0, 1], [7, 2, 0]);
    const lineSegment = LineSegment3d.create(Point3d.create(7, 2, 0), Point3d.create(10, 0, 0));
    const geometryB = Path.create();
    geometryB.tryAddChild(arc);
    geometryB.tryAddChild(lineString);
    geometryB.tryAddChild(lineSegment);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LinePath");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 5, 0, 8, -1, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([5, 2], [6, 0], [7, 2]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(7, 2), Point3d.create(10, 0));
    const lineSegment2 = LineSegment3d.create(Point3d.create(10, 0), Point3d.create(1, 2));
    const geometryB = Loop.create();
    geometryB.tryAddChild(arc);
    geometryB.tryAddChild(lineString);
    geometryB.tryAddChild(lineSegment1);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineLoop");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-1, 2, 0), Point3d.create(3, 4, 0), Point3d.create(7, 2, 0),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(3, 3, -2), Point3d.create(3, 4, 0), Point3d.create(3, 5, -2),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point3d.create(3, 4);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3d(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    ck.testTightNumber(i1.z, expectedIntersectionXY.z);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcArc");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcTranslation", () => {
    const ck = new Checker();
    const dx = 980.21312;
    const dy = 700.2342;
    const dz = 123.81;
    for (let i = 0; i < 1000; i = i + 10) {
      const geometryA = Arc3d.createCircularStartMiddleEnd(
        Point3d.create(-1 + i * dx, 2 + i * dy, i * dz),
        Point3d.create(3 + i * dx, 4 + i * dy, i * dz),
        Point3d.create(7 + i * dx, 2 + i * dy, i * dz),
      )!;
      const geometryB = Arc3d.createCircularStartMiddleEnd(
        Point3d.create(3 + i * dx, 3 + i * dy, -2 + i * dz),
        Point3d.create(3 + i * dx, 4 + i * dy, i * dz),
        Point3d.create(3 + i * dx, 5 + i * dy, -2 + i * dz),
      )!;
      // find intersections
      const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
      const numExpected = 1;
      const expectedIntersectionXY = Point3d.create(3 + i * dx, 4 + i * dy, i * dz);
      ck.testExactNumber(numExpected, intersections.length);
      const i1 = intersections[0].detailA.point;
      const i2 = intersections[0].detailB.point;
      ck.testPoint3d(i1, i2);
      ck.testTightNumber(i1.x, expectedIntersectionXY.x);
      ck.testTightNumber(i1.y, expectedIntersectionXY.y);
      ck.testTightNumber(i1.z, expectedIntersectionXY.z);
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([1, 2, 0], [5, 2, 0], [3, 5, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 3, 0], [2, 1, 0], [5, 5, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineStringLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 4), Point3d.create(5, 2))!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([3, 4, 1], [3, 4, -1], [3, 1, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point3d.create(3, 4);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3d(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    ck.testTightNumber(i1.z, expectedIntersectionXY.z);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ArcLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PathPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // path1
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5, 0), Point3d.create(3, 6.5, 0), Point3d.create(5, 5, 0),
    )!;
    const lineString1 = LineString3d.create([5, 5, 0], [6, 3, -1], [7, 5, 0], [10, 3, 0]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3, 0), Point3d.create(1, 5, 0));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // path2
    const arc2 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2),
    )!;
    const lineString2 = LineString3d.create([4, -2, 0], [6, -1, 1], [8, -2, -1], [9, 6, 0]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(9, 6), Point3d.create(0, -2));
    const geometryB = Path.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "PathPath");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LoopLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // loop1
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5),
    )!;
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3), Point3d.create(1, 5));
    const geometryA = Loop.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // loop2
    const arc2 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2),
    )!;
    const lineString2 = LineString3d.create([4, -2], [6, -1], [8, -2], [9, 6]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(9, 6), Point3d.create(0, -2));
    const geometryB = Loop.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 6;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LoopLoop");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineUnionRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, 1, 15, 7, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // union region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = UnionRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.4);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineUnionRegion");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineParityRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, 1, 15, 7, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // parity region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = ParityRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.4);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineParityRegion");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ParityRegionUnionRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, 1, 15, 7, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc1 = Arc3d.createXY(Point3d.create(6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0, 1), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    // parity region
    const geometryB1 = ParityRegion.create();
    geometryB1.tryAddChild(loop1);
    geometryB1.tryAddChild(loop2);
    // union region
    const geometryB2 = UnionRegion.create();
    geometryB2.tryAddChild(loop1);
    geometryB2.tryAddChild(loop2);
    // find intersections
    const intersections1 = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB1, false);
    const intersections2 = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB1, false);
    const numExpected = 4;
    for (let i = 0; i < numExpected; i++) {
      const i1 = intersections1[i].detailA.point;
      const i2 = intersections2[i].detailA.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "ParityRegionUnionRegion");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringBagOfCurves", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([0, 0, 1], [2, 7, 0], [15, 1, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // bag of curves
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5),
    )!;
    const lineString1 = LineString3d.create([5, 5, 0], [6, 3, 1], [7, 5, -1], [10, 3, 0]);
    const path = Path.create();
    path.tryAddChild(arc1);
    path.tryAddChild(lineString1);
    const lineString2 = LineString3d.create([10, 3, 0], [12, 5, 0], [14, -1, 1]);
    const geometryB = BagOfCurves.create(path, lineString2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const numExpected = 3;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3d(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.1);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZ", "LineStringBagOfCurves");
    expect(ck.getNumErrors()).equals(0);
  });
});

