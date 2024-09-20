/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { AnyCurve } from "../../curve/CurveTypes";
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
    );
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
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(3, 3, -2), Point3d.create(3, 4, 0), Point3d.create(3, 5, -2),
    );
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
      );
      const geometryB = Arc3d.createCircularStartMiddleEnd(
        Point3d.create(3 + i * dx, 3 + i * dy, -2 + i * dz),
        Point3d.create(3 + i * dx, 4 + i * dy, i * dz),
        Point3d.create(3 + i * dx, 5 + i * dy, -2 + i * dz),
      );
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
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 4), Point3d.create(5, 2));
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
    );
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
    );
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
    );
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
    );
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
    );
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

describe("CurveCurveIntersectXYZChains", () => {
  function captureAndTestIntersection(
    allGeometry: GeometryQuery[], ck: Checker, dx: number, dy: number,
    curveA: any, curveB: any, extendA: boolean, extendB: boolean,
    expectedIntersections: number,
  ) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveA, dx, dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveB, dx, dy);
    const intersectionDetails = CurveCurve.intersectionXYZPairs(curveA, extendA, curveB, extendB);
    for (const pair of intersectionDetails)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pair.detailA.point, 0.2, dx, dy);
    ck.testExactNumber(expectedIntersections, intersectionDetails.length, `${expectedIntersections} intersection(s) expected`);
  }
  function getRotationCurve(curve: AnyCurve, angle: Angle): AnyCurve {
    const rotationAxis: Vector3d = Vector3d.create(1, 0, 0);
    const rotationMatrix = Matrix3d.createRotationAroundVector(rotationAxis, angle)!;
    const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), rotationMatrix);
    return curve.cloneTransformed(rotationTransform) as AnyCurve;
  }
  it("intersectionXyzPrimitiveVsPathLineSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      LineSegment3d.create(
        Point3d.create(95.24913755203208, 20.36095210703357), Point3d.create(95.24913755203208, 12.748564710980762),
      ),
      LineSegment3d.create(
        Point3d.create(95.24913755203208, 12.748564710980762), Point3d.create(89.42790013152023, 12.74856471098076),
      ),
      LineSegment3d.create(
        Point3d.create(89.42790013152023, 12.74856471098076), Point3d.create(89.42790013152023, 7.375114784355288),
      ),
      LineSegment3d.create(
        Point3d.create(89.42790013152023, 7.375114784355288), Point3d.create(97.67998394741026, 7.3751147843552864),
      ),
      LineSegment3d.create(
        Point3d.create(97.67998394741026, 7.3751147843552864), Point3d.create(97.67998394741026, 2.961209487484229),
      ),
      LineSegment3d.create(
        Point3d.create(97.67998394741026, 2.961209487484229), Point3d.create(102.60564638015066, 2.961209487484229),
      ),
    );

    let dx = 0, dy = 0;
    let degrees = 70;
    let rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineSegment = getRotationCurve(lineSegment1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineSegment = getRotationCurve(lineSegment2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 0);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    rotatedLineSegment = getRotationCurve(lineSegment3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 0);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineSegment = getRotationCurve(lineSegment4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineSegment = getRotationCurve(lineSegment5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = 130;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineString = getRotationCurve(lineString1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineString = getRotationCurve(lineString2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 0);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    rotatedLineString = getRotationCurve(lineString3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 0);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineString = getRotationCurve(lineString4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineString = getRotationCurve(lineString5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = -40;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    let rotatedArc = getRotationCurve(arc1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 180),
    );
    rotatedArc = getRotationCurve(arc2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(97, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(93, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc6, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(95, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc7, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc8, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);

    // TODO: B-spline XYZ intersection implementation
    /*
    dx = 0;
    dy += 30;
    const bspline1 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(95, 0), Point3d.create(96, 0.5), Point3d.create(97, 0), Point3d.create(98, 2), Point3d.create(99, 0)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, false, true, 0);
    dx += 20;
    const bspline2 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(93, 23), Point3d.create(94, 23.5), Point3d.create(95, 23), Point3d.create(96, 25), Point3d.create(97, 23)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, false, true, 0);
    dx += 20;
    const bspline3 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(91, 20), Point3d.create(92, 20.5), Point3d.create(93, 20), Point3d.create(94, 22), Point3d.create(95, 20)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, false, true, 0);
    dx += 20;
    const bspline4 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(104, 2), Point3d.create(105, 2.5), Point3d.create(106, 2), Point3d.create(107, 4), Point3d.create(108, 2)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, false, true, 0);
    dx += 20;
    const bspline5 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(99, 7), Point3d.create(100, 7.5), Point3d.create(101, 7), Point3d.create(102, 9), Point3d.create(103, 7)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, false, true, 0);
    */

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPrimitiveVsPathLineSegment");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzPrimitiveVsPathLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      LineString3d.create(
        Point3d.create(95.24913755203208, 20.36095210703357),
        Point3d.create(95.24913755203208, 12.748564710980762),
      ),
      LineString3d.create(
        Point3d.create(95.24913755203208, 12.748564710980762),
        Point3d.create(89.42790013152023, 12.74856471098076),
      ),
      LineString3d.create(
        Point3d.create(89.42790013152023, 12.74856471098076),
        Point3d.create(89.42790013152023, 7.375114784355288),
        Point3d.create(97.67998394741026, 7.3751147843552864),
      ),
      LineString3d.create(
        Point3d.create(97.67998394741026, 7.3751147843552864),
        Point3d.create(97.67998394741026, 2.961209487484229),
      ),
      LineString3d.create(
        Point3d.create(97.67998394741026, 2.961209487484229),
        Point3d.create(102.60564638015066, 2.961209487484229),
      ),
    );

    let dx = 0, dy = 0;
    let degrees = 290;
    let rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineSegment = getRotationCurve(lineSegment1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineSegment = getRotationCurve(lineSegment2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 0);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    rotatedLineSegment = getRotationCurve(lineSegment3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 0);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineSegment = getRotationCurve(lineSegment4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineSegment = getRotationCurve(lineSegment5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = -150;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineString = getRotationCurve(lineString1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineString = getRotationCurve(lineString2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 0);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    rotatedLineString = getRotationCurve(lineString3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 0);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineString = getRotationCurve(lineString4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineString = getRotationCurve(lineString5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = 90;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    let rotatedArc = getRotationCurve(arc1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 180),
    );
    rotatedArc = getRotationCurve(arc2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(97, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(93, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc6, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(95, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc7, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc8, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);

    // TODO: B-spline XYZ intersection implementation
    /*
    dx = 0;
    dy += 30;
    const bspline1 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(95, 0), Point3d.create(96, 0.5), Point3d.create(97, 0), Point3d.create(98, 2), Point3d.create(99, 0)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, false, true, 0);
    dx += 20;
    const bspline2 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(93, 23), Point3d.create(94, 23.5), Point3d.create(95, 23), Point3d.create(96, 25), Point3d.create(97, 23)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, false, true, 0);
    dx += 20;
    const bspline3 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(91, 20), Point3d.create(92, 20.5), Point3d.create(93, 20), Point3d.create(94, 22), Point3d.create(95, 20)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, false, true, 0);
    dx += 20;
    const bspline4 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(104, 2), Point3d.create(105, 2.5), Point3d.create(106, 2), Point3d.create(107, 4), Point3d.create(108, 2)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, false, true, 0);
    dx += 20;
    const bspline5 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(99, 7), Point3d.create(100, 7.5), Point3d.create(101, 7), Point3d.create(102, 9), Point3d.create(103, 7)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, false, true, 0);
    */

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPrimitiveVsPathLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzPrimitiveVsPathArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(100, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
    );

    let dx = 0, dy = 0;
    let degrees = -20;
    let rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineSegment = getRotationCurve(lineSegment1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 16), Point3d.create(95, 16));
    rotatedLineSegment = getRotationCurve(lineSegment2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(101, 3), Point3d.create(101, 5));
    rotatedLineSegment = getRotationCurve(lineSegment3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineSegment = getRotationCurve(lineSegment4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineSegment = getRotationCurve(lineSegment5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineSegment, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = 240;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineString = getRotationCurve(lineString1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 16), Point3d.create(95, 16));
    rotatedLineString = getRotationCurve(lineString2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(101, 3), Point3d.create(101, 5));
    rotatedLineString = getRotationCurve(lineString3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    rotatedLineString = getRotationCurve(lineString4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineString = getRotationCurve(lineString5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLineString, false, true, 1);

    dx = 0;
    dy += 30;
    degrees = -330;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    let rotatedArc = getRotationCurve(arc1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(0, 180),
    );
    rotatedArc = getRotationCurve(arc2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(96, 15), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    rotatedArc = getRotationCurve(arc4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(91, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc6, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(96, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc7, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    rotatedArc = getRotationCurve(arc8, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedArc, false, true, 0);

    // TODO: B-spline XYZ intersection implementation
    /*
    dx = 0;
    dy += 30;
    const bspline1 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(95, 0), Point3d.create(96, 0.5), Point3d.create(97, 0), Point3d.create(98, 2), Point3d.create(99, 0)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline1, false, true, 0);
    dx += 20;
    const bspline2 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(93, 23), Point3d.create(94, 23.5), Point3d.create(95, 23), Point3d.create(96, 25), Point3d.create(97, 23)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline2, false, true, 0);
    dx += 20;
    const bspline3 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(91, 17), Point3d.create(92, 17.5), Point3d.create(93, 17), Point3d.create(94, 19), Point3d.create(95, 17)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline3, false, true, 0);
    dx += 20;
    const bspline4 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(102, 3), Point3d.create(103, 3.5), Point3d.create(104, 3), Point3d.create(105, 5), Point3d.create(106, 3)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline4, false, true, 0);
    dx += 20;
    const bspline5 = BSplineCurve3d.createUniformKnots(
      [Point3d.create(96, 7), Point3d.create(97, 7.5), Point3d.create(98, 7), Point3d.create(99, 9), Point3d.create(100, 7)], 4,
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, bspline5, false, true, 0);
    */

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPrimitiveVsPathArc");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzLoopVsPrimitive", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const loop = Loop.create(
      LineString3d.create(
        Point3d.create(95.24913755203208, 20.36095210703357), Point3d.create(95.24913755203208, 12.748564710980762),
      ),
      LineString3d.create(
        Point3d.create(95.24913755203208, 12.748564710980762), Point3d.create(89.42790013152023, 12.74856471098076),
      ),
      LineString3d.create(
        Point3d.create(89.42790013152023, 12.74856471098076), Point3d.create(89.42790013152023, 7.375114784355288),
      ),
      LineString3d.create(
        Point3d.create(89.42790013152023, 7.375114784355288), Point3d.create(97.67998394741026, 7.3751147843552864),
      ),
      LineString3d.create(
        Point3d.create(97.67998394741026, 7.3751147843552864), Point3d.create(97.67998394741026, 2.961209487484229),
      ),
      LineString3d.create(
        Point3d.create(97.67998394741026, 2.961209487484229), Point3d.create(102.60564638015066, 2.961209487484229),
      ),
      LineString3d.create(
        Point3d.create(102.60564638015066, 2.961209487484229), Point3d.create(102.60564638015066, 20.36095210703357),
      ),
      LineString3d.create(
        Point3d.create(95.24913755203208, 20.36095210703357), Point3d.create(95.24913755203208, 12.748564710980762),
      ),
    );

    let dx = 0;
    const dy = 0;
    const degrees = 80;
    const rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineString = getRotationCurve(lineString1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, false, 0);
    dx += 30;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineString = getRotationCurve(lineString2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, true, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, false, 0);
    dx += 30;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 15));
    rotatedLineString = getRotationCurve(lineString3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, true, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, false, 0);
    dx += 30;
    const lineString4 = LineString3d.create(Point3d.create(100, 6), Point3d.create(105, 6));
    rotatedLineString = getRotationCurve(lineString4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, false, 1);
    dx += 30;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineString = getRotationCurve(lineString5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedLineString, true, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzLoopVsPrimitive");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzCurveChainVsPrimitive", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      LineString3d.create(Point3d.create(95.24913755203208, 20.36095210703357), Point3d.create(95.24913755203208, 12.748564710980762)),
      LineString3d.create(Point3d.create(95.24913755203208, 12.748564710980762), Point3d.create(89.42790013152023, 12.74856471098076)),
      LineString3d.create(Point3d.create(89.42790013152023, 12.74856471098076), Point3d.create(89.42790013152023, 7.375114784355288)),
      LineString3d.create(Point3d.create(89.42790013152023, 7.375114784355288), Point3d.create(97.67998394741026, 7.3751147843552864)),
      LineString3d.create(Point3d.create(97.67998394741026, 7.3751147843552864), Point3d.create(97.67998394741026, 2.961209487484229)),
      LineString3d.create(Point3d.create(97.67998394741026, 2.961209487484229), Point3d.create(102.60564638015066, 2.961209487484229)),
    );
    const curveChain = CurveChainWithDistanceIndex.createCapture(path);

    let dx = 0;
    const dy = 0;
    const degrees = -180;
    const rotatedCurveChain = getRotationCurve(curveChain, Angle.createDegrees(degrees));
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    let rotatedLineString = getRotationCurve(lineString1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain, rotatedLineString, true, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    rotatedLineString = getRotationCurve(lineString2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain, rotatedLineString, true, true, 1);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    rotatedLineString = getRotationCurve(lineString3, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain, rotatedLineString, true, true, 1);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 6), Point3d.create(105, 6));
    rotatedLineString = getRotationCurve(lineString4, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain, rotatedLineString, true, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    rotatedLineString = getRotationCurve(lineString5, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain, rotatedLineString, true, true, 1);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzCurveChainVsPrimitive");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzPathVsPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path1 = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(103, 3)),
    );
    const path2 = Path.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
    );

    let dx = 0;
    const dy = 0;
    const degrees = 45;
    const rotatedPath1 = getRotationCurve(path1, Angle.createDegrees(degrees));
    const rotatedPath2 = getRotationCurve(path2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath1, rotatedPath2, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath1, rotatedPath2, true, false, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath1, rotatedPath2, false, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath1, rotatedPath2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPathVsPath");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzPathVsLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(103, 3)),
    );
    const loop = Loop.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4),
        Point3d.create(104, 4),
        Point3d.create(104, 0),
        Point3d.create(85, 0),
        Point3d.create(85, 15),
        Point3d.create(95, 15),
        Point3d.create(95, 16),
      ),
    );

    let dx = 0;
    const dy = 0;
    const degrees = -300;
    const rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoop, true, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoop, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoop, false, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoop, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPathVsLoop");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzPathVsCurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(103, 3)),
    );
    const loop = Loop.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4),
        Point3d.create(104, 4),
        Point3d.create(104, 0),
        Point3d.create(85, 0),
        Point3d.create(85, 15),
        Point3d.create(95, 15),
        Point3d.create(95, 16),
      ),
    );
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(loop);
    ck.testType(curveChain1.path, Path, "CurveChainWithDistanceIndex stores a Path even when created from a Loop");

    let dx = 0, dy = 0;
    let degrees = 60;
    let rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const rotatedCurveChain1 = getRotationCurve(curveChain1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain1, true, true, 5);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain1, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain1, false, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain1, false, false, 0);

    const pathWithCurveChain = Path.create(curveChain1.clone());
    for (let i = 0; i < pathWithCurveChain.children.length; ++i) {
      ck.testTrue(
        pathWithCurveChain.children[i].isAlmostEqual(curveChain1.path.children[i]),
        "Embedding a CurveChainWithDistanceIndex in a Path loses its distance index",
      );
    }

    dx = 0;
    dy += 30;
    degrees = -200;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const rotatedPathWithCurveChain = getRotationCurve(pathWithCurveChain, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedPathWithCurveChain, true, true, 5);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedPathWithCurveChain, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedPathWithCurveChain, false, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedPathWithCurveChain, false, false, 0);

    const loopWithCurveChain = Loop.create(curveChain1.clone());
    for (let i = 0; i < loopWithCurveChain.children.length; ++i) {
      ck.testTrue(
        loopWithCurveChain.children[i].isAlmostEqual(curveChain1.path.children[i]),
        "Embedding a CurveChainWithDistanceIndex in a Loop loses its distance index",
      );
    }

    dx = 0;
    dy += 30;
    degrees = 120;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const rotatedLoopWithCurveChain = getRotationCurve(loopWithCurveChain, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoopWithCurveChain, true, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoopWithCurveChain, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoopWithCurveChain, false, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedLoopWithCurveChain, false, false, 0);

    const path2 = Path.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
    );
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    dx = 0;
    dy += 30;
    degrees = 10;
    rotatedPath = getRotationCurve(path, Angle.createDegrees(degrees));
    const rotatedCurveChain2 = getRotationCurve(curveChain2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain2, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain2, true, false, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain2, false, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedPath, rotatedCurveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzPathVsCurveChain");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzLoopVsLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const loop1 = Loop.create(
      LineSegment3d.create(Point3d.create(75, 10), Point3d.create(80, 10)),
      LineSegment3d.create(Point3d.create(80, 10), Point3d.create(80, 5)),
      LineString3d.create(Point3d.create(80, 5), Point3d.create(77, 0), Point3d.create(75, 5), Point3d.create(75, 10)),
    );
    const loop2 = Loop.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4),
        Point3d.create(104, 4),
        Point3d.create(104, 0),
        Point3d.create(85, 0),
        Point3d.create(85, 15),
        Point3d.create(95, 15),
        Point3d.create(95, 16),
      ),
    );

    let dx = 0;
    const dy = 0;
    const degrees = 60;
    const rotatedLoop1 = getRotationCurve(loop1, Angle.createDegrees(degrees));
    const rotatedLoop2 = getRotationCurve(loop2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop1, rotatedLoop2, true, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop1, rotatedLoop2, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop1, rotatedLoop2, false, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop1, rotatedLoop2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzLoopVsLoop");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzLoopVsCurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const loop = Loop.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4),
        Point3d.create(104, 4),
        Point3d.create(104, 0),
        Point3d.create(85, 0),
        Point3d.create(85, 15),
        Point3d.create(95, 15),
        Point3d.create(95, 16),
      ),
    );
    const path1 = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(103, 3)),
    );
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);

    let dx = 0, dy = 0;
    let degrees = -100;
    let rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    const rotatedCurveChain1 = getRotationCurve(curveChain1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, true, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, false, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, false, false, 0);

    const path2 = Path.create(
      Arc3d.create(
        Point3d.create(81, 10), Vector3d.create(5, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 180),
      ),
      LineSegment3d.create(Point3d.create(75, 10), Point3d.create(80, 10)),
      LineSegment3d.create(Point3d.create(80, 10), Point3d.create(80, 5)),
      LineString3d.create(Point3d.create(80, 5), Point3d.create(83, 5)),
    );
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    dx = 0;
    dy += 30;
    degrees = 30;
    rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    const rotatedCurveChain2 = getRotationCurve(curveChain2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, true, true, 4);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, false, true, 4);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzLoopVsCurveChain");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzCurveChainVsCurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path1 = Path.create(
      LineSegment3d.create(Point3d.create(95, 16), Point3d.create(91, 16)),
      LineSegment3d.create(Point3d.create(91, 16), Point3d.create(91, 21)),
      LineString3d.create(Point3d.create(91, 21), Point3d.create(99, 21), Point3d.create(99, 7)),
      Arc3d.create(
        Point3d.create(99, 4), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4),
        Point3d.create(104, 4),
        Point3d.create(104, 0),
      ),
    );
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);

    const path2 = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(103, 3)),
    );
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    let dx = 0;
    const dy = 0;
    const degrees = 120;
    const rotatedCurveChain1 = getRotationCurve(curveChain1, Angle.createDegrees(degrees));
    const rotatedCurveChain2 = getRotationCurve(curveChain2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain1, rotatedCurveChain2, true, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain1, rotatedCurveChain2, true, false, 1);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain1, rotatedCurveChain2, false, true, 2);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedCurveChain1, rotatedCurveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzCurveChainVsCurveChain");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzSingleChild", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const loop = Loop.create(
      LineString3d.create(Point3d.create(85, 0), Point3d.create(85, 15), Point3d.create(95, 15), Point3d.create(85, 0)),
    );
    const path1 = Path.create(LineSegment3d.create(Point3d.create(75, 10), Point3d.create(80, 10)));
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);

    let dx = 0, dy = 0;
    let degrees = 320;
    let rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    const rotatedCurveChain1 = getRotationCurve(curveChain1, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, true, false, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, false, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain1, false, false, 0);

    const path2 = Path.create(LineSegment3d.create(Point3d.create(95, 10), Point3d.create(100, 10)));
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    dx = 0;
    dy += 30;
    degrees = -40;
    rotatedLoop = getRotationCurve(loop, Angle.createDegrees(degrees));
    const rotatedCurveChain2 = getRotationCurve(curveChain2, Angle.createDegrees(degrees));
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, true, false, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, false, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, rotatedLoop, rotatedCurveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzSingleChild");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectionXyzCurveChainVsCurveChainDifferentPlanes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const path1 = Path.create(
      LineSegment3d.create(Point3d.create(95, 16, 10), Point3d.create(91, 16, 10)),
      LineSegment3d.create(Point3d.create(91, 16, 10), Point3d.create(91, 21, 10)),
      LineString3d.create(Point3d.create(91, 21, 10), Point3d.create(99, 21, 10), Point3d.create(99, 7, 10)),
      Arc3d.create(
        Point3d.create(99, 4, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 0),
      ),
      LineString3d.create(
        Point3d.create(100, 4, 10),
        Point3d.create(104, 4, 10),
        Point3d.create(104, 0, 10),
      ),
    );
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);

    const path2 = Path.create(
      Arc3d.create(
        Point3d.create(95, 16), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, -90),
      ),
      Arc3d.create(
        Point3d.create(92, 13), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(360, 180),
      ),
      Arc3d.create(
        Point3d.create(89, 10), Vector3d.create(1, 0), Vector3d.create(0, 3), AngleSweep.createStartEndDegrees(90, 270),
      ),
      Arc3d.create(
        Point3d.create(93, 7), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
      ),
      Arc3d.create(
        Point3d.create(97, 5), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineString3d.create(Point3d.create(97, 3), Point3d.create(110, 3)),
    );
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    let dx = 0;
    const dy = 0;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, true, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, false, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXYZChains", "intersectionXyzCurveChainVsCurveChainDifferentPlanes");
    expect(ck.getNumErrors()).equals(0);
  });
});
