/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { UnionRegion } from "../../curve/UnionRegion";
import { AxisIndex, Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
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
 * intersection marker in output geometry does not always sit at virtual xy-intersections seen in the top view.
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, 0, dy);
      dy += 2;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineMapped");
    expect(ck.getNumErrors()).toBe(0);
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
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineCoincident");
    expect(ck.getNumErrors()).toBe(0);
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
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineStringCoincident");
    expect(ck.getNumErrors()).toBe(0);
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
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);
    let dy = 6;
    for (let segmentIndex = 0; segmentIndex + 1 < linestring.length; segmentIndex++) {
      const lineSegment = linestringA.getIndexedSegment(segmentIndex);
      if (lineSegment) {
        const intersections = CurveCurve.intersectionXYPairs(lineSegment, false, linestringA, false);
        const numExpected = (segmentIndex === 0 || segmentIndex + 2 === linestringA.numPoints()) ? 2 : 3;
        testIntersectionPairsXY(ck, undefined, intersections, numExpected, numExpected);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestringA, lineSegment], 0, dy);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05, 0, dy);
      }
      dy += 3;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringLineStringCoincident");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcArcCoincident", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc0 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 2, 0),
    );
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      arc0.fractionToPoint(0.25), arc0.fractionToPoint(0.5), arc0.fractionToPoint(1.5),
    );
    const intersectionsAB = CurveCurve.intersectionXYPairs(arc0, false, arc1, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc0, arc1]);
    const numExpected = 1;
    testIntersectionPairsXY(ck, undefined, intersectionsAB, numExpected, numExpected);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcArcCoincident");
    expect(ck.getNumErrors()).toBe(0);
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
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arc, true, segment, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
        dx += 12;
      }
      dy += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineArcMapped");
    expect(ck.getNumErrors()).toBe(0);
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
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arc, true, linestring, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
        dx += 20;
      }
      dy += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringArcMapped");
    expect(ck.getNumErrors()).toBe(0);
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05, dx, dy);
      dx += 5;
      const intersections1 = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring0, false, segment, false);
      testIntersectionsXY(ck, worldToLocal, intersections1, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, segment], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections1, 0.05, dx, dy);
      dx += 5;
      const intersections2 = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring0, false, linestring1, false);
      numExpected = 2;
      testIntersectionsXY(ck, worldToLocal, intersections2, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring0, linestring1], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections2, 0.05, dx, dy);
      dx += 5;
      const intersections2r = CurveCurve.intersectionProjectedXYPairs(worldToLocal, linestring1, false, linestring0, false);
      testIntersectionsXY(ck, worldToLocal, intersections2r, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring1, linestring0], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections2r, 0.05, dx, dy);
      dx += 5;
      const intersectionsX = CurveCurve.intersectionProjectedXYPairs(worldToLocal, segment, true, linestring1, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsX, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment, linestring1], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsX, 0.05, dx, dy);
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineStringMapped");
    expect(ck.getNumErrors()).toBe(0);
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
      dx += 10;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, arcB, true, arcA, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcB, arcA], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
      dx = 0;
      dy += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcArcMapped");
    expect(ck.getNumErrors()).toBe(0);
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
      dx += 5;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, segment, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, segment], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
      dx = 0;
      dy += 5;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineBsplineMapped");
    expect(ck.getNumErrors()).toBe(0);
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
      dx += 7;
      const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, ls, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, ls], dx, dy);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringBsplineMapped");
    expect(ck.getNumErrors()).toBe(0);
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
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsAB, 0.05, dx, dy);
        dx += 7;
        const intersectionsBA = CurveCurve.intersectionProjectedXYPairs(worldToLocal, bspline, false, arc, false);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, numExpected, numExpected);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [bspline, arc], dx, dy);
        GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsBA, 0.05, dx, dy);
        dx += 7;
      }
      dx = 0;
      dy += 7;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcBsplineMapped");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  function captureAndTestIntersection(
    allGeometry: GeometryQuery[], ck: Checker, dx: number, dy: number,
    curveA: any, curveB: any, extendA: boolean, extendB: boolean,
    expectedIntersections: number,
  ) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveA, dx, dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveB, dx, dy);
    const intersectionDetails = CurveCurve.intersectionProjectedXYPairs(undefined, curveA, extendA, curveB, extendB);
    for (const pair of intersectionDetails)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pair.detailA.point, 0.2, dx, dy);
    ck.testExactNumber(expectedIntersections, intersectionDetails.length, `${expectedIntersections} intersection(s) expected`);
  }
  it("intersectionPrimitiveVsPathLineSegment", () => {
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
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, false, true, 0);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, false, true, 0);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, false, true, 1);

    dx = 0;
    dy += 30;
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, false, true, 0);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, false, true, 0);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, false, true, 1);

    dx = 0;
    dy += 30;
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 180),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(97, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(93, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(95, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, false, true, 0);

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

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPrimitiveVsPathLineSegment");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionPrimitiveVsPathLineString", () => {
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
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, false, true, 0);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, false, true, 0);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, false, true, 1);

    dx = 0;
    dy += 30;
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, false, true, 0);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, false, true, 0);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, false, true, 1);

    dx = 0;
    dy += 30;
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 180),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(97, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(93, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(95, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, false, true, 0);

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

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPrimitiveVsPathLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionPrimitiveVsPathArc", () => {
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
    const lineSegment1 = LineSegment3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment1, false, true, 1);
    dx += 20;
    const lineSegment2 = LineSegment3d.create(Point3d.create(93, 16), Point3d.create(95, 16));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment2, false, true, 1);
    dx += 20;
    const lineSegment3 = LineSegment3d.create(Point3d.create(101, 3), Point3d.create(101, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment3, false, true, 1);
    dx += 20;
    const lineSegment4 = LineSegment3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment4, false, true, 1);
    dx += 20;
    const lineSegment5 = LineSegment3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineSegment5, false, true, 1);

    dx = 0;
    dy += 30;
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString1, false, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 16), Point3d.create(95, 16));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString2, false, true, 1);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(101, 3), Point3d.create(101, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString3, false, true, 1);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 15), Point3d.create(105, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString4, false, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, true, true, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, lineString5, false, true, 1);

    dx = 0;
    dy += 30;
    const arc1 = Arc3d.create(
      Point3d.create(87, 10), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc1, false, true, 2);
    dx += 20;
    const arc2 = Arc3d.create(
      Point3d.create(95, 20), Vector3d.create(3, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(0, 180),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc2, false, true, 1);
    dx += 20;
    const arc3 = Arc3d.create(
      Point3d.create(104, 3), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, true, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc3, false, true, 1);
    dx += 20;
    const arc4 = Arc3d.create(
      Point3d.create(96, 15), Vector3d.create(4, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc4, false, true, 2);
    dx += 20;
    const arc5 = Arc3d.create(
      Point3d.create(90, 15), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc5, false, true, 0);
    dx += 20;
    const arc6 = Arc3d.create(
      Point3d.create(91, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc6, false, true, 0);
    dx += 20;
    const arc7 = Arc3d.create(
      Point3d.create(96, 11), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc7, false, true, 0);
    dx += 20;
    const arc8 = Arc3d.create(
      Point3d.create(90, 5), Vector3d.create(3, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, true, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, arc8, false, true, 0);

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

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPrimitiveVsPathArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionLoopVsPrimitive", () => {
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
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString1, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString1, true, false, 0);
    dx += 30;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString2, true, true, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString2, true, false, 0);
    dx += 30;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 15));
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString3, true, true, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString3, true, false, 0);
    dx += 30;
    const lineString4 = LineString3d.create(Point3d.create(100, 6), Point3d.create(105, 6));
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString4, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString4, true, false, 1);
    dx += 30;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString5, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, lineString5, true, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionLoopVsPrimitive");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionCurveChainVsPrimitive", () => {
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
    const lineString1 = LineString3d.create(Point3d.create(83, 10), Point3d.create(86, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain, lineString1, true, true, 1);
    dx += 20;
    const lineString2 = LineString3d.create(Point3d.create(93, 22), Point3d.create(97, 22));
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain, lineString2, true, true, 1);
    dx += 20;
    const lineString3 = LineString3d.create(Point3d.create(104, 1), Point3d.create(104, 5));
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain, lineString3, true, true, 1);
    dx += 20;
    const lineString4 = LineString3d.create(Point3d.create(100, 6), Point3d.create(105, 6));
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain, lineString4, true, true, 1);
    dx += 20;
    const lineString5 = LineString3d.create(Point3d.create(93, 10), Point3d.create(101, 10));
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain, lineString5, true, true, 1);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionCurveChainVsPrimitive");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionPathVsPath", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, path1, path2, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path1, path2, true, false, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path1, path2, false, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path1, path2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPathVsPath");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionPathVsLoop", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loop, true, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loop, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loop, false, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loop, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPathVsLoop");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionPathVsCurveChain", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain1, true, true, 5);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain1, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain1, false, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain1, false, false, 0);

    const pathWithCurveChain = Path.create(curveChain1.clone());
    for (let i = 0; i < pathWithCurveChain.children.length; ++i) {
      ck.testTrue(
        pathWithCurveChain.children[i].isAlmostEqual(curveChain1.path.children[i]),
        "Embedding a CurveChainWithDistanceIndex in a Path loses its distance index",
      );
    }

    dx = 0;
    dy += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, pathWithCurveChain, true, true, 5);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, pathWithCurveChain, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, pathWithCurveChain, false, true, 2);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, pathWithCurveChain, false, false, 0);

    const loopWithCurveChain = Loop.create(curveChain1.clone());
    for (let i = 0; i < loopWithCurveChain.children.length; ++i) {
      ck.testTrue(
        loopWithCurveChain.children[i].isAlmostEqual(curveChain1.path.children[i]),
        "Embedding a CurveChainWithDistanceIndex in a Loop loses its distance index",
      );
    }

    dx = 0;
    dy += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loopWithCurveChain, true, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loopWithCurveChain, true, false, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loopWithCurveChain, false, true, 0);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, loopWithCurveChain, false, false, 0);

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
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain2, true, true, 4);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain2, true, false, 1);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain2, false, true, 3);
    dx += 20;
    captureAndTestIntersection(allGeometry, ck, dx, dy, path, curveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionPathVsCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionLoopVsLoop", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop1, loop2, true, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop1, loop2, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop1, loop2, false, true, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop1, loop2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionLoopVsLoop");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionLoopVsCurveChain", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, true, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, false, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, false, false, 0);

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
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, true, true, 4);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, true, false, 0);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, false, true, 4);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionLoopVsCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionCurveChainVsCurveChain", () => {
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
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, true, true, 3);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, true, false, 1);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, false, true, 2);
    dx += 40;
    captureAndTestIntersection(allGeometry, ck, dx, dy, curveChain1, curveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "intersectionCurveChainVsCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("intersectionSingleChild", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const loop = Loop.create(
      LineString3d.create(Point3d.create(85, 0), Point3d.create(85, 15), Point3d.create(95, 15), Point3d.create(85, 0)),
    );
    const path1 = Path.create(LineString3d.create(Point3d.create(75, 10), Point3d.create(80, 10)));
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);

    let dx = 0, dy = 0;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, true, false, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, false, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain1, false, false, 0);

    const path2 = Path.create(LineSegment3d.create(Point3d.create(95, 10), Point3d.create(100, 10)));
    const curveChain2 = CurveChainWithDistanceIndex.createCapture(path2);

    dx = 0;
    dy += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, true, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, true, false, 0);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, false, true, 2);
    dx += 30;
    captureAndTestIntersection(allGeometry, ck, dx, dy, loop, curveChain2, false, false, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersect", "intersectionSingleChild");
    expect(ck.getNumErrors()).toBe(0);
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
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsTight, 0.05);
    }
    const intersectionsLoose = CurveCurve.allIntersectionsAmongPrimitivesXY([geomA, geomB], 0.001);
    if (ck.testExactNumber(1, intersectionsLoose.length, "found 1 intersection with loose tol")) {
      ck.testTrue(
        intersectionsLoose[0].detailA.hasFraction1 && intersectionsLoose[0].detailB.hasFraction1,
        "loose tol intersection is an interval",
      );
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geomA, geomB], dx);
      GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionsLoose, 0.05, dx);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "IntersectXYWithTolerance");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 0, 1, 7, 7, 2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYZXYZ(6, 2, -1, 1, 7, -2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point2d.create(4, 4);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3dXY(i1, i2);
    ck.testExactNumber(i1.x, expectedIntersectionXY.x);
    ck.testExactNumber(i1.y, expectedIntersectionXY.y);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLine");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLineString1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 0, 3, 8, 3, 3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 6;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineString1");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLineString2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(3, 1, 3, 5, 3, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point2d.create(4, 2);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3dXY(i1, i2);
    ck.testExactNumber(i1.x, expectedIntersectionXY.x);
    ck.testExactNumber(i1.y, expectedIntersectionXY.y);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLineString2");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 0, 0, 0, 3, -4);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0), Point3d.create(0, 2), Point3d.create(2, 0),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point2d.create(0, 2);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3dXY(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LinePath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 0, 0, 10, 2, -1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2),
    );
    const lineString = LineString3d.create([5, 2], [6, 0], [7, 2]);
    const lineSegment = LineSegment3d.create(Point3d.create(7, 2), Point3d.create(10, 0));
    const geometryB = Path.create();
    geometryB.tryAddChild(arc);
    geometryB.tryAddChild(lineString);
    geometryB.tryAddChild(lineSegment);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 3;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LinePath");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(0, 5, 1, 8, -1, -1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2),
    );
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
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineLoop");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-1, 2), Point3d.create(3, 4), Point3d.create(7, 2),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5), Point3d.create(3, 4), Point3d.create(1, 3),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point2d.create(3, 4);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3dXY(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([1, 2, 1], [5, 2, -1], [3, 5, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 3, 0], [2, 1, 2], [5, 5, -1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 3;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 2), Point3d.create(3, 4), Point3d.create(5, 2),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([3, 5], [3, 1], [6, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 1;
    const expectedIntersectionXY = Point2d.create(3, 4);
    ck.testExactNumber(numExpected, intersections.length);
    const i1 = intersections[0].detailA.point;
    const i2 = intersections[0].detailB.point;
    ck.testPoint3dXY(i1, i2);
    ck.testTightNumber(i1.x, expectedIntersectionXY.x);
    ck.testTightNumber(i1.y, expectedIntersectionXY.y);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ArcLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("BsplineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(3, 2, 0),
        Point3d.create(4, 0, 0),
      ],
      4,
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYXY(0, 1, 4, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "BsplineLine");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("BsplineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(3, 2, 0),
        Point3d.create(4, 0, 0),
      ],
      4,
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([0, 1, 0], [1, 0, -1], [2, 1, 1], [3, 0, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 3;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "BsplineLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("BsplineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(3, 2, 0),
        Point3d.create(4, 0, 0),
      ],
      4,
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 0), Point3d.create(2, 1), Point3d.create(3, 0),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "BsplineArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("BsplineBspline", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(3, 2, 0),
        Point3d.create(4, 0, 0),
      ],
      4,
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 1, 0),
        Point3d.create(1, -1, 0),
        Point3d.create(2, 2, 0),
        Point3d.create(3, 0, 0),
        Point3d.create(4, 2, 0),
      ],
      4,
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "BsplineBspline");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("PathPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // path1
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5),
    );
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3), Point3d.create(1, 5));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // path2
    const arc2 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2),
    );
    const lineString2 = LineString3d.create([4, -2], [6, -1], [8, -2], [9, 6]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(9, 6), Point3d.create(0, -2));
    const geometryB = Path.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 6;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "PathPath");
    expect(ck.getNumErrors()).toBe(0);
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
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 6;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.05);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LoopLoop");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineUnionRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, 1, 15, 7, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // union region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = UnionRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.5);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineUnionRegion");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineParityRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, -1, 15, 7, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // parity region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = ParityRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 4;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.5);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineParityRegion");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ParityRegionUnionRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYZXYZ(-15, -7, -1, 15, 7, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
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
    const intersections1 = CurveCurve.intersectionXYPairs(geometryA, false, geometryB1, false);
    const intersections2 = CurveCurve.intersectionXYPairs(geometryA, false, geometryB1, false);
    const numExpected = 4;
    for (let i = 0; i < numExpected; i++) {
      const i1 = intersections1[i].detailA.point;
      const i2 = intersections2[i].detailA.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ParityRegionUnionRegion");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineStringBagOfCurves", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([0, 0, 0], [2, 7, -1], [15, 1, -2]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // bag of curves
    const arc1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5),
    );
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const path = Path.create();
    path.tryAddChild(arc1);
    path.tryAddChild(lineString1);
    const lineString2 = LineString3d.create([10, 3], [12, 5], [14, -1]);
    const geometryB = BagOfCurves.create(path, lineString2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find intersections
    const intersections = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const numExpected = 7;
    ck.testExactNumber(numExpected, intersections.length);
    for (const i of intersections) {
      const i1 = i.detailA.point;
      const i2 = i.detailB.point;
      ck.testPoint3dXY(i1, i2);
    }
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersections, 0.1);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "LineStringBagOfCurves");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("ChainArcBSpline", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const bezier = BSplineCurve3d.createUniformKnots([Point3d.createZero(), Point3d.create(1, 1), Point3d.create(2), Point3d.create(3, 1)], 4);
    if (ck.testDefined(bezier)) {
      const arc = Arc3d.createStartMiddleEnd(bezier.endPoint(), Point3d.create(4.5, 0.5), Point3d.create(5, -1), AngleSweep.createStartEndDegrees(0, 60));
      if (ck.testDefined(arc)) {
        const options = new StrokeOptions();
        options.angleTol = Angle.createDegrees(0.0001);

        const testChainIntersection = (chainA: CurveChainWithDistanceIndex, intersectAAtStart: boolean, chainB: CurveChainWithDistanceIndex, intersectBAtStart: boolean, x0: number): number => {
          let numIntersects = 0;

          const primA = chainA.path.getChild(intersectAAtStart ? 0 : chainA.path.children.length - 1)!;
          const primB = chainB.path.getChild(intersectBAtStart ? 0 : chainB.path.children.length - 1)!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [chainA, chainB], x0);

          const globalIntersections = CurveCurve.intersectionXYPairs(chainA, true, chainB, true, 1.0e-20);
          GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, globalIntersections, 0.1, x0);

          const localIntersections = CurveCurve.intersectionXYPairs(primA, true, primB, true);
          GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, localIntersections, 0.05, x0);

          if (ck.testExactNumber(globalIntersections.length, localIntersections.length, "same # chain-chain and arc-arc extended intersections")) {
            numIntersects = globalIntersections.length;
            for (let i = 0; i < numIntersects; ++i) {
              ck.testPoint3d(globalIntersections[i].detailA.point, localIntersections[i].detailA.point, "global and local intersections same for detailA");
              ck.testPoint3d(globalIntersections[i].detailB.point, localIntersections[i].detailB.point, "global and local intersections same for detailB");
              const globalFracA = globalIntersections[i].detailA.fraction;
              const globalFracB = globalIntersections[i].detailB.fraction;
              if (!Geometry.isIn01(globalFracA)) {
                ck.testType(primA, Arc3d);
                if (intersectAAtStart)
                  ck.testLE(globalFracA, 0, "extending pathA off the start yields global intersection fraction < 0");
                else
                  ck.testLE(1, globalFracA, "extending pathA off the end yields global intersection fraction > 1");
              }
              if (!Geometry.isIn01(globalFracB)) {
                ck.testType(primB, Arc3d);
                if (intersectBAtStart)
                  ck.testLE(globalFracB, 0, "extending pathB off the start yields global intersection fraction < 0");
                else
                  ck.testLE(1, globalFracB, "extending pathB off the end yields global intersection fraction > 1");
              }
              // adjust local fractions off the extended end
              const adjustLocalFractionForArc = (prim: CurvePrimitive, localFraction: number, intersectAtStart: boolean): number => {
                if (prim instanceof Arc3d) {
                  const period = arc.sweep.fractionPeriod();
                  if (intersectAtStart && localFraction > 1.0)
                    localFraction -= period;
                  else if (!intersectAtStart && localFraction < 0.0)
                    localFraction += period;
                }
                return localFraction;
              };
              const localFracA = adjustLocalFractionForArc(primA, localIntersections[i].detailA.fraction, intersectAAtStart);
              const localFracB = adjustLocalFractionForArc(primB, localIntersections[i].detailB.fraction, intersectBAtStart);
              // compare local fractions to chain child details
              const chainLocalFracA = globalIntersections[i].detailA.childDetail?.fraction;
              if (ck.testDefined(chainLocalFracA, "chain detailA stores child detail"))
                ck.testFraction(localFracA, chainLocalFracA, "chain detailA child fraction is the expected local fraction");
              const chainLocalFracB = globalIntersections[i].detailB.childDetail?.fraction;
              if (ck.testDefined(chainLocalFracB, "chain detailB stores child detail"))
                ck.testFraction(localFracB, chainLocalFracB, "chain detailB child fraction is the expected local fraction");
              // extend the paths to the intersection, passing chain detail
              const extPathA = chainA.clonePartialCurve(0, globalIntersections[i].detailA, options);
              const extPathB = intersectBAtStart
                ? chainB.clonePartialCurve(globalIntersections[i].detailB, 1, options)
                : chainB.clonePartialCurve(0, globalIntersections[i].detailB, options);
              // extend the arcs to the intersection
              const extArcA = primA.clonePartialCurve(0, localFracA);
              const extArcB = intersectBAtStart ? primB.clonePartialCurve(localFracB, 1) : primB.clonePartialCurve(0, localFracB);
              if (ck.testDefined(extPathA) && ck.testDefined(extPathB) && ck.testDefined(extArcA) && ck.testDefined(extArcB)) {
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [extPathA, extPathB, extArcA, extArcB], x0, 0, i + 1);
                ck.testPoint3d(extPathA.endPoint(), intersectBAtStart ? extPathB.startPoint() : extPathB.endPoint(), "extended paths to the intersection");
                ck.testPoint3d(extArcA.endPoint(), intersectBAtStart ? extArcB.startPoint() : extArcB.endPoint(), "extended arcs to the intersection");
              }
            }
          }
          return numIntersects;
        };

        const pathA = CurveChainWithDistanceIndex.createCapture(Path.createArray([bezier, arc]), options);

        // intersect extended chains
        let pathB = pathA.cloneTransformed(Transform.createFixedPointAndMatrix(Point3d.create(4), Matrix3d.createDirectionalScale(Vector3d.unitX(-1), -1)), options);
        if (ck.testDefined(pathB)) {
          pathB.reverseInPlace(); // mirrored and reversed
          ck.testExactNumber(4, testChainIntersection(pathA, false, pathB, true, 0), "chains have expected # arc-arc intersections");
        }
        // test arc-bsp intersection
        pathB = pathA.cloneTransformed(Transform.createOriginAndMatrix(Point3d.create(4, -1), Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(90))), options);
        if (ck.testDefined(pathB))
          ck.testExactNumber(2, testChainIntersection(pathA, false, pathB, true, 10), "chains have expected # arc-bspline intersections");
        pathB = pathA.cloneTransformed(Transform.createOriginAndMatrix(Point3d.create(2, -3), Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(90))), options);
        if (ck.testDefined(pathB))
          ck.testExactNumber(2, testChainIntersection(pathA, true, pathB, false, 15), "chains have expected # bspline-arc intersections");
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersectXY", "ChainArcBSpline");
    expect(ck.getNumErrors()).toBe(0);
  });
});
