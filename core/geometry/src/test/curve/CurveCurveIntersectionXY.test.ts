/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Map4d } from "../../geometry4d/Map4d";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/**
 * This function creates some sample Map4ds. The transform0 of the Map4d is passed as "worldToLocal" transform to
 * CurveCurve.intersectionProjectedXYPairs along with 2 curves. "worldToLocal" is used to transform the input curves.
 * Therefore, the intersection is found after applying the "worldToLocal" transform to both input curves.
 * That means the intersection that is found is not the intersection of non-transformed curves. That's why the
 * intersection marker is not at the expected intersection between curves in some of visualizations.
 * * Note that on the first row of visuals, the intersection marker matches the actual intersection because
 * the "worldToLocal" is identity.
 */
function createSamplePerspectiveMaps(): Map4d[] {
  const origin = Point3d.create(-20, -20, -1);
  const vectorU = Vector3d.create(100, 0, 0);
  const vectorV = Vector3d.create(0, 100, 0);
  const vectorW = Vector3d.create(0, 0, 40);
  const transform1 = Transform.createOriginAndMatrixColumns(origin, vectorU, vectorV, vectorW);
  const inverse1 = transform1.inverse()!;
  return [
    Map4d.createIdentity(),
    Map4d.createTransform(inverse1, transform1)!,
    Map4d.createVectorFrustum(origin, vectorU, vectorV, vectorW, 0.4)!,
  ];
}
/**
 * Create strokes from 2 points towards eye.
 * Shift by dx,dy
 * Save in allGeometry
 */
function captureEyeStroke(
  allGeometry: GeometryQuery[], map: Map4d, pointA: Point3d, pointB: Point3d, dzNpc: number, dx: number, dy: number,
): void {
  for (const point0 of [pointA, pointB]) {
    const npcPoint0 = map.transform0.multiplyPoint3d(point0, 1);
    const point1 = map.transform1.multiplyXYZWQuietRenormalize(npcPoint0.x, npcPoint0.y, npcPoint0.z + dzNpc, npcPoint0.w);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(point0, point1), dx, dy);
  }
}
/** Test number of intersections and coordinates of intersections. */
function testIntersectionsXY(
  ck: Checker,
  worldToLocal: Matrix4d | undefined,
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
        if (worldToLocal) {
          const pointA = worldToLocal.multiplyPoint3d(intersections[i].detailA.point, 1);
          const pointB = worldToLocal.multiplyPoint3d(intersections[i].detailB.point, 1);
          ck.testCoordinate(0, pointA.realDistanceXY(pointB)!, "projected intersections match");
        } else {
          ck.testPoint3dXY(intersections[i].detailB.point, intersections[i].detailB.point, "CLD coordinate match");
        }
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
/**
 * Verify same defined-ness of valueA and valueB, useful for guarding references to possibly undefined values that
 * should be "all or none".
 * * both defined ==> return true.
 * * both undefined ==> no error, return defaultUndefinedValue
 * * mixed ==> ck.announceError and return false.
 */
function verifyTypedPair<T>(
  ck: Checker, valueA: T | undefined, valueB: T | undefined, defaultUndefinedValue: boolean = false,
): boolean {
  if (valueA !== undefined && valueB !== undefined)
    return true;
  if (valueA === undefined && valueB === undefined)
    return defaultUndefinedValue;
  ck.announceError("verifyTypedPair mismatch", valueA, valueB);
  return false;
}
function verifyLocalPointXY(
  ck: Checker, pointAWorld: Point3d | undefined, pointBWorld: Point3d | undefined, worldToLocal: Matrix4d | undefined,
) {
  if (verifyTypedPair(ck, pointAWorld, pointBWorld) && pointAWorld && pointBWorld) {
    if (worldToLocal) {
      const pointA = worldToLocal.multiplyPoint3d(pointAWorld, 1);
      const pointB = worldToLocal.multiplyPoint3d(pointBWorld, 1);
      ck.testCoordinate(0, pointA.realDistanceXY(pointB)!, "projected intersections match");
    } else {
      ck.testPoint3dXY(pointAWorld, pointBWorld, "CLD coordinate match");
    }
  }
}
function testIntersectionPairsXY(
  ck: Checker,
  worldToLocal: Matrix4d | undefined,
  intersections: CurveLocationDetailPair[] | undefined,
  minExpected: number,
  maxExpected: number,
  testCoordinates: boolean = false,
): boolean {
  const baseErrorCount = ck.getNumErrors();
  if (!intersections) {
    ck.testExactNumber(0, minExpected, `"No intersections found but ${minExpected} expected`);
  } else {
    const n = intersections.length;
    if (n < minExpected || n > maxExpected) {
      ck.announceError("intersection count out of range", n, minExpected, maxExpected);
    }
    if (testCoordinates) {
      for (const p of intersections) {
        verifyLocalPointXY(ck, p.detailA.point, p.detailB.point, worldToLocal);
        verifyLocalPointXY(ck, p.detailA.point1, p.detailB.point1, worldToLocal);
        const fA = p.detailA.fraction;
        const fB = p.detailB.fraction;
        const cpA = p.detailA.curve;
        const cpB = p.detailB.curve;
        if (verifyTypedPair(ck, cpA, cpB) && cpA && cpB) {
          ck.testPoint3d(cpA.fractionToPoint(fA), p.detailA.point);
          ck.testPoint3d(cpB.fractionToPoint(fB), p.detailB.point);
          if (verifyTypedPair(ck, p.detailA.fraction1, p.detailB.fraction1)) {
            ck.testPoint3d(cpA.fractionToPoint(p.detailA.fraction1!), p.detailA.point1!);
            ck.testPoint3d(cpB.fractionToPoint(p.detailB.fraction1!), p.detailB.point1!);
          }
        }
      }
    }
  }
  return ck.getNumErrors() === baseErrorCount;
}

describe("CurveCurveIntersectXY", () => {
  it("LineLineMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
      const segment1 = LineSegment3d.createXYXY(4, 1, 2, 3);
      const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment0, false, segment1, false);
      const numExpected = 1;
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment1, false, segment0, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, segment1], 0, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, 0, dy);
      dy += 2;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineCoincident", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
    const segment1 = LineSegment3d.create(segment0.fractionToPoint(0.5), segment0.fractionToPoint(0.75));
    const intersectionsAB = CurveCurve.intersectionXYPairs(segment0, false, segment1, false);
    const numExpected = 1;
    testIntersectionPairsXY(ck, undefined, intersectionsAB, numExpected, numExpected);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, segment1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineCoincident");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineStringCoincident", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const segment0 = LineSegment3d.createXYXY(0, 0, 2, 0);
    const lineString1 = LineString3d.create([0, 1], [0, 0], [1, 0]);
    const intersectionsAB = CurveCurve.intersectionXYPairs(segment0, false, lineString1, false);
    const numExpected = 2;
    testIntersectionPairsXY(ck, undefined, intersectionsAB, numExpected, numExpected);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment0, lineString1]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineStringCoincident");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringLineStringCoincident", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pointsA: Point3d[] = [];
    const pointsB: Point3d[] = [];
    const linestring = Sample.appendSawTooth(pointsA, 2, 1, 0.5, 3, 4);
    let f0 = 0.4;
    let f1 = 0.9;
    const df0 = -0.1;
    const df1 = 0.06;
    // make another linestring that has two points defined at varying fractions on each segment of the sawtooth
    for (let segment = 0; segment + 1 < linestring.length; segment++, f0 += df0, f1 += df1) {
      pointsB.push(pointsA[segment].interpolate(f0, pointsA[segment + 1]));
      pointsB.push(pointsA[segment].interpolate(f1, pointsA[segment + 1]));
    }
    const linestringA = LineString3d.create(pointsA);
    const linestringB = LineString3d.create(pointsB);
    const intersectionsAB = CurveCurve.intersectionXYPairs(linestringA, false, linestringB, false);
    const minExpected = 0;
    const maxExpected = 2 * pointsB.length;
    testIntersectionPairsXY(ck, undefined, intersectionsAB, minExpected, maxExpected);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestringA, linestringB]);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);
    let dy = 6;
    for (let segmentIndex = 0; segmentIndex + 1 < linestring.length; segmentIndex++) {
      const lineSegment = linestringA.getIndexedSegment(segmentIndex);
      if (lineSegment) {
        const intersections = CurveCurve.intersectionXYPairs(lineSegment, false, linestringA, false);
        const numExpected = (segmentIndex === 0 || segmentIndex + 2 === linestringA.numPoints()) ? 2 : 3;
        testIntersectionPairsXY(ck, undefined, intersections, numExpected, numExpected);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestringA, lineSegment], 0, dy);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.04, 0, dy);
      }
      dy += 3;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringLineStringCoincident");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcCoincident", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc0 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 2, 0),
    )!;
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      arc0.fractionToPoint(0.25), arc0.fractionToPoint(0.5), arc0.fractionToPoint(1.5),
    )!;
    const intersectionsAB = CurveCurve.intersectionXYPairs(arc0, false, arc1, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc0, arc1]);
    const numExpected = 1;
    testIntersectionPairsXY(ck, undefined, intersectionsAB, numExpected, numExpected);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcArcCoincident");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineArcMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      dx = 0;
      for (const dz of [0, 0.3]) {
        const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
        const arc = Arc3d.create(Point3d.create(3, 1, 1), Vector3d.create(5, 1, 1), Vector3d.create(-1, 7, 2));
        const f0 = 0.0;
        const f1 = 0.25;
        const pointA = arc.fractionToPoint(f0);
        const pointB = arc.fractionToPoint(f1);
        pointA.z += dz;
        pointB.z += 0.1 * dz;
        const segment = LineSegment3d.create(pointA, pointB);
        const numExpected = 2;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, segment], dx, dy);
        const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment, true, arc, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arc, true, segment, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
        dx += 12;
      }
      dy += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineArcMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringArcMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      dx = 0;
      for (const dz of [0, 0.3]) {
        const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
        const arc = Arc3d.create(Point3d.create(3, 1, 1), Vector3d.create(5, 1, 1), Vector3d.create(-1, 7, 2));
        const f0 = 0.0;
        const f1 = 0.25;
        const pointA = arc.fractionToPoint(f0);
        const pointB = arc.fractionToPoint(f1);
        pointA.z += dz;
        pointB.z += 0.1 * dz;
        const linestring = LineString3d.create([-3, 3, 1], [10, 5, -1], [10, -1, 0], [-3, -3, 1], [-3, 3, 1]);
        const numExpected = 4;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, linestring], dx, dy);
        const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring, true, arc, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arc, true, linestring, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
        dx += 20;
      }
      dy += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringArcMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineStringMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const segment = LineSegment3d.createXYXY(1, 2, 4, 2);
      const linestring0 = LineString3d.create([1, 1], [3, 0], [3, 5]);
      const linestring1 = LineString3d.create([2, 4, 2], [4, 1, 0], [2, 5, 0]);
      const intersections = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment, false, linestring0, false);
      let numExpected = 1;
      testIntersectionsXY(ck, worldToLocal, intersections, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment, linestring0], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.04, dx, dy);
      dx += 5;
      const intersections1 = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring0, false, segment, false);
      testIntersectionsXY(ck, worldToLocal, intersections1, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, segment], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections1, 0.04, dx, dy);
      dx += 5;
      const intersections2 = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring0, false, linestring1, false);
      numExpected = 2;
      testIntersectionsXY(ck, worldToLocal, intersections2, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, linestring1], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections2, 0.04, dx, dy);
      dx += 5;
      const intersections2r = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring1, false, linestring0, false);
      testIntersectionsXY(ck, worldToLocal, intersections2r, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring1, linestring0], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections2r, 0.04, dx, dy);
      dx += 5;
      const intersectionsX = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment, true, linestring1, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsX, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment, linestring1], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.04, dx, dy);
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineStringMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const arcA = Arc3d.create(Point3d.create(1, 2, 0), Vector3d.create(4, 0, 0), Vector3d.create(0, 1, 0));
      const arcB = Arc3d.create(Point3d.create(0, 1, 1), Vector3d.create(2, 0, 0), Vector3d.create(0, 4, 0));
      const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arcA, true, arcB, true);
      const numExpected = 4;
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
      dx += 10;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arcB, true, arcA, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcB, arcA], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
      dx = 0;
      dy += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcArcMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineBsplineMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const segment = LineSegment3d.createXYXY(0, 0, 4, 2);
      const bspline = BSplineCurve3d.createUniformKnots(
        [
          Point3d.create(1, 2, 0),
          Point3d.create(1, 1, 0),
          Point3d.create(1, 0, 0),
          Point3d.create(0, -1, 0),
          Point3d.create(0, -2, 0),
        ],
        3,
      )!;
      const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment, false, bspline, false);
      const numExpected = 1;
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment, bspline], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
      dx += 5;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, segment, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, segment], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
      dx = 0;
      dy += 5;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringBsplineMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const ls = LineString3d.create([0, 0, 0], [4, 2, 0], [5, 1, 0], [0, -1, 0]);
      const bspline = BSplineCurve3d.createUniformKnots(
        [
          Point3d.create(1, 2, 0),
          Point3d.create(1, 1, 0),
          Point3d.create(1, 0, 0),
          Point3d.create(0, -1, 0),
          Point3d.create(0, -2, 0),
        ],
        3,
      )!;
      const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, ls, false, bspline, false);
      const numExpected = 2;
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [ls, bspline], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
      dx += 7;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, ls, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, ls], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcBsplineMapped", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      const z = 0.1;  // Raise the arc a little so various view directions produce different intersections.
      const arc = Arc3d.create(Point3d.create(0, 0, z), Vector3d.create(2, 0, 0), Vector3d.create(0, 2, 1));
      for (const order of [2, 3, 4]) {
        const bspline = BSplineCurve3d.createUniformKnots(
          [
            Point3d.create(-1, 1, 0),
            Point3d.create(0, 1, 0),
            Point3d.create(2, 2, 0),
            Point3d.create(3, 3, 0),
            Point3d.create(4, 3, 0),
          ],
          order,
        )!;
        const intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arc, false, bspline, false);
        const numExpected = 1;
        testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc, bspline], dx, dy);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.04, dx, dy);
        dx += 7;
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, arc, false);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, arc], dx, dy);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.04, dx, dy);
        dx += 7;
      }
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("BsplineBsplineMapped", () => {
    const ck = new Checker();
    let dx = 0.0;
    let dy = 0.0;
    let dyOuter = 0.0;
    const rA = 0.03;
    const rB = 0.05;
    const allGeometry: GeometryQuery[] = [];
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0; // That's world to local. The perspective frustum forced that. Seems backwards.
      dx = 0.0;
      for (const order0 of [2, 3, 4]) {
        const z0 = 0.3;  // Raise the arc a little so various view directions produce different intersections.
        // bspline0 sweeps from high on y axis to low in 4 quadrant
        const bspline0 = BSplineCurve3d.createUniformKnots(
          [
            Point3d.create(0, 5, z0),
            Point3d.create(0, 2, z0),
            Point3d.create(4, -1, z0),
            Point3d.create(4, -4, z0),
          ],
          order0,
        )!;
        dy = dyOuter;
        for (const order1 of [2, 3, 4, 5]) {
          const bspline1 = BSplineCurve3d.createUniformKnots(
            [
              Point3d.create(-1, 2, 0),
              Point3d.create(0, 1, 0),
              Point3d.create(2, 2, 0),
              Point3d.create(3, 4, 0),
              Point3d.create(4, 4, 0),
              Point3d.create(6, 5, 0),
            ],
            order1,
          )!;
          GeometryCoreTestIO.captureGeometry(allGeometry, bspline0.clone(), dx, dy);
          // Inner loop moves bspline1 around to have specific intersections.
          // bspline1 and the computed intersections are drawn at each placement.
          for (const fraction0fraction1 of [
            Point2d.create(0.1, 0.45),
            Point2d.create(0.35, 0.521),
            Point2d.create(0.5, 0.672),
            Point2d.create(0.82, 0.1),
          ]) {
            const fraction0 = fraction0fraction1.x;
            const fraction1 = fraction0fraction1.y;
            const point0 = bspline0.fractionToPoint(fraction0);
            const point1 = bspline1.fractionToPoint(fraction1);
            bspline1.tryTranslateInPlace(point0.x - point1.x, point0.y - point1.y);
            GeometryCoreTestIO.captureGeometry(allGeometry, bspline1.clone(), dx, dy);
            let intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline0, false, bspline1, false);
            const numExpected = 1;
            if (!testIntersectionsXY(ck, worldToLocal, intersectionsAB, numExpected, numExpected))
              intersectionsAB = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline0, false, bspline1, false);
            for (const pair of intersectionsAB) {
              GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(pair.detailA.point, rA), dx, dy);
              GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(pair.detailB.point, rB), dx, dy);
              captureEyeStroke(allGeometry, map, pair.detailA.point, pair.detailB.point, 2.0 * z0, dx, dy);
            }
          }
          dy += 15;
        }
        dx += 30.0;
      }
      dyOuter += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "BsplineBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });
  it("IntersectXYWithTolerance", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 10;
    const geomA = LineSegment3d.createXYXY(-4, 4, -4, -4);
    const geomB = LineSegment3d.createXYXY(-4, 4, -4.0001, -4);
    const intersectionsTight = CurveCurve.allIntersectionsAmongPrimitivesXY([geomA, geomB]);
    if (ck.testExactNumber(1, intersectionsTight.length, "found 1 intersection with default (tight) tol")) {
      ck.testTrue(
        intersectionsTight[0].detailA.isIsolated && intersectionsTight[0].detailB.isIsolated,
        "tight tol intersection is isolated point",
      );
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geomA, geomB]);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsTight, 0.04);
    }
    const intersectionsLoose = CurveCurve.allIntersectionsAmongPrimitivesXY([geomA, geomB], 0.001);
    if (ck.testExactNumber(1, intersectionsLoose.length, "found 1 intersection with loose tol")) {
      ck.testTrue(
        intersectionsLoose[0].detailA.hasFraction1 && intersectionsLoose[0].detailB.hasFraction1,
        "loose tol intersection is an interval",
      );
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geomA, geomB], dx);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsLoose, 0.04, dx);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "IntersectXYWithTolerance");
    expect(ck.getNumErrors()).equals(0);
  });
});
