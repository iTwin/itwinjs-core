/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Arc3d } from "../../curve/Arc3d";
import { AnyCurve } from "../../curve/CurveTypes";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { CurveOps } from "../../curve/CurveOps";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function exerciseClonePartialLineString3d(ck: Checker, allGeometry: GeometryQuery[], lsA: LineString3d, delta: Point3d) {
  const expectValidResults = lsA.numPoints() > 1;
  const yInc = 1.2 * lsA.range().yLength();
  delta.x += 1.2 * lsA.range().xLength();
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, lsA, delta.x, delta.y = 0);
  for (const extendFraction of [0.05, 0.721, 1.4, 3.96]) {
    const cee0 = lsA.clonePartialCurve(-extendFraction, -extendFraction / 2);         // does not contain [0,1]
    const ce0 = lsA.clonePartialCurve(-extendFraction, 0);                            // contains [0]
    const ce01 = lsA.clonePartialCurve(-extendFraction, 1);                           // contains [0,1]
    const ce01e = lsA.clonePartialCurve(-extendFraction, 1 + extendFraction);         // contains [0,1]
    const c01e = lsA.clonePartialCurve(0, 1 + extendFraction);                        // contains [0,1]
    const c1e = lsA.clonePartialCurve(1, 1 + extendFraction);                         // contains [1]
    const c1ee = lsA.clonePartialCurve(1 + extendFraction / 2, 1 + extendFraction);   // does not contain [0,1]

    // first segment distance multipliers
    const preLocal = lsA.globalFractionToSegmentIndexAndLocalFraction(-extendFraction);
    const preLocalFraction = Math.abs(preLocal.fraction);
    ck.testExactNumber(0, preLocal.index, "global parameter < 0 converts to local index 0");
    const preLocalFractionHalf = Math.abs(lsA.globalFractionToSegmentIndexAndLocalFraction(-extendFraction / 2).fraction);
    // last segment distance multipliers
    const postLocal = lsA.globalFractionToSegmentIndexAndLocalFraction(1 + extendFraction);
    const postLocalFraction = postLocal.fraction - 1;
    ck.testExactNumber(lsA.numPoints() - 2, postLocal.index, "global parameter > 1 converts to local index numPoints-2");
    const postLocalFractionHalf = lsA.globalFractionToSegmentIndexAndLocalFraction(1 + extendFraction / 2).fraction - 1;

    if (ck.testPointer(cee0) && expectValidResults) {
      ck.testExactNumber(cee0.numPoints(), 2, "isolated pre-extension is a segment");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(cee0.curveLength(), preLocalFractionHalf * lsA.points[0].distance(lsA.points[1]), "isolated pre-extension length is fraction of first segment");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cee0, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(ce0) && expectValidResults) {
      ck.testExactNumber(ce0.numPoints(), 2, "pre-extension is a segment");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(ce0.curveLength(), preLocalFraction * lsA.points[0].distance(lsA.points[1]), "pre-extension length is fraction of first segment");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, ce0, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(ce01) && expectValidResults) {
      ck.testExactNumber(ce01.numPoints(), lsA.numPoints(), "pre-extended linestring has same point count");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(ce01.curveLength(), lsA.curveLength() + preLocalFraction * lsA.points[0].distance(lsA.points[1]), "pre-extended linestring has expected length");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, ce01, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(ce01e) && expectValidResults) {
      ck.testExactNumber(ce01e.numPoints(), lsA.numPoints(), "bi-extended linestring has same point count");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(ce01e.curveLength(), preLocalFraction * lsA.points[0].distance(lsA.points[1]) + lsA.curveLength() + postLocalFraction * lsA.points[lsA.numPoints() - 2].distance(lsA.points[lsA.numPoints() - 1]), "bi-extended linestring has expected length");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, ce01e, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(c01e) && expectValidResults) {
      ck.testExactNumber(c01e.numPoints(), lsA.numPoints(), "post-extended linestring has same point count");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(c01e.curveLength(), lsA.curveLength() + postLocalFraction * lsA.points[lsA.numPoints() - 2].distance(lsA.points[lsA.numPoints() - 1]), "post-extended linestring has expected length");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, c01e, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(c1e) && expectValidResults) {
      ck.testExactNumber(c1e.numPoints(), 2, "post-extension is a segment");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(c1e.curveLength(), postLocalFraction * lsA.points[lsA.numPoints() - 2].distance(lsA.points[lsA.numPoints() - 1]), "post-extension length is fraction of last segment");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, c1e, delta.x, delta.y += yInc);
    }
    if (ck.testPointer(c1ee) && expectValidResults) {
      ck.testExactNumber(c1ee.numPoints(), 2, "isolated post-extension is a segment");
      if (!lsA.isPhysicallyClosed)
        ck.testCoordinate(c1ee.curveLength(), postLocalFractionHalf * lsA.points[lsA.numPoints() - 2].distance(lsA.points[lsA.numPoints() - 1]), "isolated post-extension length is fraction of last segment");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, c1ee, delta.x, delta.y += yInc);
    }
  }
}

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
  if (ck.testPointer(partA, "forward partial") && ck.testPointer(partB, "backward partial"))
    ck.testCoordinate(lsA.curveLength(), partA.curveLength() + partB.curveLength(), "Partial curves sum to length", lsA, partA, partB);
}

describe("LineString3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    exerciseLineString3d(ck, ls0);
    ls0.addPoint(Point3d.create(4, 3, 2));
    exerciseLineString3d(ck, ls0);
    const point100 = Point3d.create(1, 0, 0);
    const point420 = Point3d.create(4, 2, 0);
    const point450 = Point3d.create(4, 5, 0);
    const point150 = Point3d.create(1, 5, 0);
    const lsA = LineString3d.create([point100, point420, point450, point150]);
    exerciseLineString3d(ck, lsA);
    const lsB = LineString3d.createRectangleXY(Point3d.create(1, 1), 3, 2, true);
    exerciseLineString3d(ck, lsB);
    const lsC = LineString3d.create([point100]);
    ck.testUndefined(lsC.quickUnitNormal(), "quickUnitNormal expected failure 1 point");
    lsC.addPoint(point420);
    ck.testUndefined(lsC.quickUnitNormal(), "quickUnitNormal expected failure 2 point");
    lsC.addPoint(point420.interpolate(0.6, point100));
    ck.testUndefined(lsC.quickUnitNormal(), "quickUnitNormal expected failure 3 point colinear");
    const normalA = lsA.quickUnitNormal();
    if (ck.testPointer(normalA, "quickUnitNormal") && normalA)
      ck.testCoordinate(1.0, normalA.magnitude(), "unit normal magnitude");
    ck.checkpoint("LineString3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("createXY", () => {
    const ck = new Checker();
    const xyArray = [
      Point2d.create(1, 1),
      Point2d.create(4, 1),
      Point2d.create(4, 2),
      Point2d.create(0, 2),
    ];
    const jsArrayXY = [];
    const jsArrayXYZ = [];
    const dz = 10.0;
    for (const p of xyArray) {
      jsArrayXY.push([p.x, p.y]);
      jsArrayXYZ.push([p.x, p.y, dz]);
    }
    const ls10 = LineString3d.createXY(xyArray, dz);
    const ls0 = LineString3d.create(xyArray);
    const lsArrayXY = LineString3d.create(jsArrayXY);
    const lsArrayXYZ = LineString3d.create(jsArrayXYZ);
    lsArrayXY.tryTranslateInPlace(0, 0, dz);
    ls0.tryTranslateInPlace(0, 0, dz);

    ck.testTrue(ls0.isAlmostEqual(ls10));
    ck.testTrue(ls0.isAlmostEqual(lsArrayXY));
    ck.testTrue(ls0.isAlmostEqual(lsArrayXYZ));

    ck.testExactNumber(4, ls10.numPoints());
    expect(ck.getNumErrors()).equals(0);
  });

  it("clonePartial", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const delta = Point3d.createZero();
    const lsA = LineString3d.create([Point3d.create(1, 0, 0), Point3d.create(4, 2, 0), Point3d.create(4, 5, 0), Point3d.create(1, 5, 0)]);
    exerciseClonePartialLineString3d(ck, allGeometry, lsA, delta);
    GeometryCoreTestIO.saveGeometry(allGeometry, "LineString3d", "ClonePartial");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClonePartialFromExtendedClosestPointDetailFraction", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pts = new GrowableXYZArray();
    const numPts = 5;
    for (let i = 0; i < numPts; ++i)
      pts.pushXYZ(i, (numPts - 2) - i * i / numPts, Math.sin(2 * Math.PI * i / numPts));
    const ls = LineString3d.create(pts);

    const offsetDist = 3;
    const ray0 = ls.fractionToPointAndUnitTangent(0);
    const ray1 = ls.fractionToPointAndUnitTangent(1);
    ray0.direction.scaleInPlace(-offsetDist);
    ray1.direction.scaleInPlace(offsetDist);
    const detail0 = ls.closestPoint(ray0.fractionToPoint(1), true);
    const detail1 = ls.closestPoint(ray1.fractionToPoint(1), true);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, [detail0.point, detail1.point], 0.1);

    const ls0 = ls.clonePartialCurve(detail0.fraction, 1);
    const ls1 = ls.clonePartialCurve(0, detail1.fraction);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [ls, ls0, ls1]);

    ck.testLT(detail0.fraction, 1, "Point projected off curve start has projection fraction < 0");
    ck.testLT(1, detail1.fraction, "Point projected off curve end has projection fraction > 1");
    ck.testPoint3d(detail0.point, ls0.startPoint(), "Point projected off curve start equals start of clonedPartialCurve at projection fraction < 0");
    ck.testPoint3d(detail0.point, ls.fractionToPoint(detail0.fraction), "Point projected off curve start equals fractionToPoint at projection fraction < 0");
    ck.testPoint3d(detail1.point, ls1.endPoint(), "Point projected off curve end equals end of clonedPartialCurve at projection fraction > 1");
    ck.testPoint3d(detail1.point, ls.fractionToPoint(detail1.fraction), "Point projected off curve end equals fractionToPoint at projection fraction > 1");

    GeometryCoreTestIO.saveGeometry(allGeometry, "LineString3d", "ClonePartialFromExtendedClosestPointDetailFraction");
    expect(ck.getNumErrors()).equals(0);
  });

  it("addResolvedPoint", () => {
    const ck = new Checker();
    // addResolvedPoint is private -- tricky tricky...
    const a = 10.0;
    const ls = LineString3d.createXY([Point2d.create(0, 1), Point2d.create(0.5 * a, 1), Point2d.create(a, 1)], 0);
    const lsZ = ls as any;
    const dest = new GrowableXYZArray(5);
    // deviously reproduce the whole linestring via clamping ...
    lsZ.addResolvedPoint(-1, 0.3, dest);
    lsZ.addResolvedPoint(1, 0, dest);
    lsZ.addResolvedPoint(5, 0, dest);
    const n0 = dest.length;
    const ls0 = LineString3d.create();
    const ls0Z = ls0 as any;
    ls0Z.addResolvedPoint(0, 0, dest);
    ck.testExactNumber(n0, dest.length, "confirm no-op");
    ls0.addPointXYZ(1, 2, 3);
    ls0Z.addResolvedPoint(0, 0, dest);
    ck.testExactNumber(n0 + 1, dest.length, "confirm access to singleton");
    expect(ck.getNumErrors()).equals(0);
  });

  it("addAuxData", () => {
    const ck = new Checker();
    const ls = LineString3d.create();
    let n = 0;
    for (let f = 0; f <= 1.0; f += 0.25) {
      ls.addPointXYZ(f, 0, 0);
      ls.addFraction(f);
      ls.addUVParam(Point2d.create(f, f));
      ls.addDerivative(Vector3d.create(1, 2, 3));
      n++;
    }
    if (ck.testPointer(ls.fractions))
      ck.testExactNumber(n, ls.fractions.length);
    if (ck.testPointer(ls.packedDerivatives))
      ck.testExactNumber(n, ls.packedDerivatives.length);
    if (ck.testPointer(n, ls.packedDerivatives))
      ck.testExactNumber(n, ls.packedDerivatives!.length);
    ck.testExactNumber(n, ls.numPoints());
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
/**
 * Class to act as an iterator over points in a linestring.
 * * Internal data is:
 *   * pointer to the parent linestring
 *   * index of index of the next point to read.
 * * the parent LineString class
 */
class IterableLineStringPoint3dIterator implements Iterator<Point3d> {
  private _linestring: LineStringWithIterator;
  private _nextReadIndex: number;
  public constructor(linestring: LineStringWithIterator) {
    this._linestring = linestring;
    this._nextReadIndex = 0;
  }
  public next(): IteratorResult<Point3d> {
    const point = this._linestring.pointAt(this._nextReadIndex++);
    if (point)
      return { done: false, value: point };
    return { done: true, value: undefined } as any as IteratorResult<Point3d>;
  }
  public [Symbol.iterator](): IterableIterator<Point3d> { return this; }
}
/**
 * This is a linestring class which
 * * Stores its point data in a Float64Array (NOT as individual Point3d objects)
 * * has a `pointIterator ()` method which returns an iterator so that users can visit points with `for (const p of linestring.pointIterator()){}`
 */
class LineStringWithIterator {
  private _data: Float64Array;
  public constructor(points: Point3d[]) {
    this._data = new Float64Array(3 * points.length);
    let i = 0;
    for (const p of points) {
      this._data[i++] = p.x;
      this._data[i++] = p.y;
      this._data[i++] = p.z;
    }
  }
  public [Symbol.iterator](): IterableIterator<Point3d> { return new IterableLineStringPoint3dIterator(this); }
  /**
   * access a point by index.  The point coordinates are returned as a first class point object.
   * @param index index of point to access
   */
  public pointAt(index: number): Point3d | undefined {
    const k = index * 3;
    if (k < this._data.length)
      return new Point3d(this._data[k], this._data[k + 1], this._data[k + 2]);
    return undefined;
  }
}
describe("LineStringIterator", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allPoints: Point3d[] = [
      Point3d.create(0, 0, 0),
      Point3d.create(0, 10, 0),
      Point3d.create(10, 10, 0),
      Point3d.create(10, 0, 0),
      Point3d.create(20, 0, 0),
      Point3d.create(20, 10, 0)];
    const ls = new LineStringWithIterator(allPoints);
    let i = 0;
    for (const p of ls) {
      ck.testPoint3d(p, allPoints[i], "LineStringIterator");
      i++;
      // GeometryCoreTestIO.consoleLog("for..of ", p.toJSON());
    }
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("LineStringAnnotation", () => {
  it("DegenerateCases", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    const badPoint0 = ls0.startPoint();
    const badPoint1 = ls0.endPoint();
    const zeroPoint = Point3d.create();
    const intersections: CurveLocationDetail[] = [];
    ck.testFalse(ls0.isAlmostEqual(LineSegment3d.createXYZXYZ(0, 0, 0, 1, 1, 1)));
    ck.testExactNumber(0, ls0.appendPlaneIntersectionPoints(Plane3dByOriginAndUnitNormal.createXYPlane(), intersections));
    ck.testPoint3d(zeroPoint, badPoint0);
    ck.testPoint3d(zeroPoint, badPoint1);
    ck.testExactNumber(0, ls0.curveLengthBetweenFractions(0, 0));
    ck.testExactNumber(0, ls0.curveLengthBetweenFractions(0, 1));
    const p0 = Point3d.create(1, 2, 3);
    const p1 = Point3d.create(4, 1, 2);
    const ls2 = LineString3d.create([p0, p1]);
    ck.testCoordinate(p0.distance(p1), ls2.curveLengthBetweenFractions(0, 1));

    const ls2A = LineString3d.create([p0, p0]);
    const frame = ls2.fractionToFrenetFrame(0.5);
    const frameA = ls2A.fractionToFrenetFrame(0.5);
    const l24Bad = LineString3d.create([p0, p0, p0, p0]);
    const frame4Bad = l24Bad.fractionToFrenetFrame(0.5);
    ck.testPointer(frame);
    ck.testPointer(frameA);
    ck.testPointer(frame4Bad);
    expect(ck.getNumErrors()).equals(0);
  });
  it("FractionArray", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    ls0.ensureEmptyFractions();
    ls0.ensureEmptyFractions();
    const p0 = Point3d.create(1, 2, 3);
    const p1 = Point3d.create(4, 1, 2);
    ls0.appendStrokePoint(p0, 0.0);
    ls0.appendStrokePoint(p1, 1.0);
    ck.testExactNumber(2, ls0.numPoints());
    ls0.appendStrokePoint(p1, 1.0);   // this is a duplicate
    ck.testExactNumber(2, ls0.numPoints());
    ls0.appendStrokePoint(p1, 0.0);   // this is xyz dup but fraction different
    ck.testExactNumber(2, ls0.numPoints());

    const line = LineSegment3d.createXYZXYZ(1, 2, 3, 2, 5, 1);
    ls0.clear();
    ls0.ensureEmptyFractions();
    ls0.appendFractionToPoint(line, 0.0);
    ck.testExactNumber(1, ls0.numPoints());

    ls0.clear();
    ls0.ensureEmptyDerivatives();
    ls0.ensureEmptyDerivatives();
    ls0.appendFractionToPoint(line, 0.0);
    ls0.appendFractionToPoint(line, 1.0);
    ck.testExactNumber(ls0.fractions!.length, ls0.packedDerivatives!.length);
    ls0.clear();
    ck.testExactNumber(0, ls0.numPoints());
    ck.testExactNumber(0, ls0.fractions!.length);
    expect(ck.getNumErrors()).equals(0);
  });

  it("AppendInterpolated", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    const p0 = Point3d.create(1, 2, 3);
    const p1 = Point3d.create(4, 1, 2);
    const p2 = Point3d.create(6, 3, 0);
    for (const i of [0, 1]) {
      ls0.clear();
      ls0.appendInterpolatedStrokePoints(3, p0, p1, true);
      ck.testExactNumber(4, ls0.numPoints());
      ls0.appendInterpolatedStrokePoints(4, p1, p2, false);
      ck.testExactNumber(7, ls0.numPoints());
      if (i === 0)
        ls0.ensureEmptyFractions();
    }
    ls0.fractionToFrenetFrame(1.1);
    expect(ck.getNumErrors()).equals(0);
  });

  it("StrokeCountWithMaxEdgeLength", () => {
    const ck = new Checker();
    const p0 = Point3d.create(1, 0, 0);
    const p1 = Point3d.create(3, 0, 0);
    const p2 = Point3d.create(3, 5, 0);
    const ls0 = LineString3d.create(p0, p1, p2);
    const options = StrokeOptions.createForCurves();
    options.maxEdgeLength = 1.0;
    const n = ls0.computeStrokeCountForOptions(options);
    ck.testExactNumber(7, n);
    expect(ck.getNumErrors()).equals(0);
  });

  it("CreateAnnotations", () => {
    const ck = new Checker();
    const allPoints: Point3d[] = [
      Point3d.create(0, 0, 0),
      Point3d.create(0, 10, 0),
      Point3d.create(10, 10, 0),
      Point3d.create(10, 0, 0),
      Point3d.create(20, 0, 0),
      Point3d.create(20, 10, 0)];
    const ls = LineString3d.create(allPoints);

    const normalIndices = ls.ensureEmptyNormalIndices();
    const pointIndices = ls.ensureEmptyPointIndices();
    const paramIndices = ls.ensureEmptyUVIndices();
    const params = ls.ensureEmptyUVParams();
    const surfaceNormals = ls.ensureEmptySurfaceNormals();

    ck.testUndefined(ls.derivativeAt(1));
    ck.testUndefined(ls.surfaceNormalAt(3));
    ck.testPointer(normalIndices);
    ck.testPointer(pointIndices);
    ck.testPointer(paramIndices);
    ck.testPointer(params);
    ck.testPointer(surfaceNormals);

    // meaningless data -- just fill all the arrays ..
    const n = allPoints.length;

    for (let i = 0; i < n; i++) {
      const v = Vector3d.create(2 * i, i * i * i);
      ls.addSurfaceNormal(v);
      const vN = ls.surfaceNormalAt(i);
      if (ck.testPointer(vN))
        ck.testVector3d(v, vN);
      ls.addDerivative(v);
      const v1 = ls.derivativeAt(i);
      if (ck.testPointer(v1))
        ck.testVector3d(v, v1);
      if ((i & 0x01) !== 0)
        ls.addUVParam(Point2d.create(0, i));
      else
        ls.addUVParamAsUV(i, 0);
    }

    ck.testExactNumber(n, surfaceNormals.length);
    ck.testExactNumber(n, params.length);

    // again to reach overwrite blocks
    const normalIndicesA = ls.ensureEmptyNormalIndices();
    const pointIndicesA = ls.ensureEmptyPointIndices();
    const paramIndicesA = ls.ensureEmptyUVIndices();
    const paramsA = ls.ensureEmptyUVParams();
    const surfaceNormalsA = ls.ensureEmptySurfaceNormals();

    ck.testPointer(normalIndicesA);
    ck.testPointer(pointIndicesA);
    ck.testPointer(paramIndicesA);
    ck.testPointer(paramsA);
    ck.testPointer(surfaceNormalsA);

    expect(ck.getNumErrors()).equals(0);
  });
  it("RangeAndLengthBetweenFractions", () => {
    const ck = new Checker();
    // equidistant points .... all breakpoints are at binary fractions
    const p0 = Point3d.create(1, 0, 0);
    const p1 = Point3d.create(2, 0, 0);
    const p2 = Point3d.create(3, 0, 0);
    const p3 = Point3d.create(4, 0, 0);
    const p4 = Point3d.create(5, 0, 0);
    // as a linestring which will have identical parameterization
    const linestring = LineString3d.create(p0, p1, p2, p3, p4);
    const segment = LineSegment3d.create(p0, p4);
    // const fractions = [0.0, 0.1, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8, 0.95, 1.0];
    const fractions = [0.0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0];
    // all all fraction pairs, expect same result from
    //    lineSegment3d between fractions
    //    lineString3d between fractions
    //    lineString3d clonePartial
    //    lineSegment3d clonePartial
    for (const f0 of fractions) {
      for (const f1 of fractions) {
        if (f0 !== f1) {
          const partialSegment = segment.clonePartialCurve(f0, f1);
          const partialString = linestring.clonePartialCurve(f0, f1);
          ck.testRange3d(partialSegment.range(), segment.rangeBetweenFractions(f0, f1), { title: "segment rangeBetweenFractions", f0, f1 });
          ck.testRange3d(partialString.range(), linestring.rangeBetweenFractions(f0, f1), { title: "Linestring rangeBetweenFractions", f0, f1 });
          ck.testRange3d(partialSegment.range(), partialString.range(), { title: "partial linestring, partial segment range", f0, f1 });
          ck.testCoordinate(partialSegment.curveLength(), segment.curveLengthBetweenFractions(f0, f1), { title: "segment length between fractions", f0, f1 });
          ck.testCoordinate(partialString.curveLength(), linestring.curveLengthBetweenFractions(f0, f1), { title: "linestring length between fractions", f0, f1 });
          ck.testCoordinate(partialSegment.curveLength(), partialString.curveLength(), { title: "partial linestring, partial segment  length", f0, f1 });
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("LineString3dOps", () => {
  it("CollectChainsAsLineString3d", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const createFragments = (perturbClosure: boolean, includeDangler: boolean): AnyCurve[] => {
      const fragments: AnyCurve[] = [];
      if (includeDangler)
        fragments.push(LineSegment3d.create(Point3d.create(4, 4, 0), Point3d.create(3, 2, 0)));
      fragments.push(Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), AngleSweep.createStartEndDegrees(0, 180)));
      fragments.push(LineString3d.create(Point3d.createZero(), Point3d.create(0, 2, 0), Point3d.create(3, 2, 0)));
      fragments.push(LineSegment3d.create(Point3d.create(2, 0, 0), Point3d.create(3, 0, 0)));
      fragments.push(LineSegment3d.create(Point3d.create(3, 2, 0), Point3d.create(3, 0, 0)));
      fragments.push(LineString3d.create(Point3d.create(1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(-1, 0, 0), Point3d.create(0, -1, 0)));
      fragments.push(LineSegment3d.create(Point3d.create(0, -1, 0), Point3d.create(1, perturbClosure ? -2 * Geometry.smallMetricDistance : 0, 0)));
      return fragments;
    };

    let deltaY = 0;
    for (const select of [true, false]) {
      const frags = createFragments(select, select);
      const loops: Loop[] = [];
      const paths: Path[] = [];
      CurveOps.collectChainsAsLineString3d(frags, (pts: LineString3d) => {
        if (pts.isPhysicallyClosed)
          loops.push(Loop.create(pts));
        else
          paths.push(Path.create(pts));
      });
      if (select) {
        ck.testExactNumber(loops.length, 0, "CurveOps.collectChainsAsLineString3d forms no loops as expected");
        ck.testExactNumber(paths.length, 2, "CurveOps.collectChainsAsLineString3d forms 2 paths as expected");
      } else {
        ck.testExactNumber(loops.length, 2, "CurveOps.collectChainsAsLineString3d forms 2 loops as expected");
        ck.testExactNumber(paths.length, 0, "CurveOps.collectChainsAsLineString3d forms no paths as expected");
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, frags, 0, deltaY);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops, 5, deltaY);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, paths, 10, deltaY);
      deltaY += 5;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "LineString3dOps", "CollectChainsAsLineString3d");
    expect(ck.getNumErrors()).equals(0);
  });
});
