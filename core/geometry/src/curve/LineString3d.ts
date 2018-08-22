/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry, BeJSONFunctions, Angle } from "../Geometry";
import { Point3d, Vector3d, XAndY } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, RotMatrix } from "../Transform";
import { Plane3dByOriginAndUnitNormal, Plane3dByOriginAndVectors, Ray3d } from "../AnalyticGeometry";
import { GrowableXYZArray, GrowableFloat64Array } from "../GrowableArray";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";
import { StrokeOptions } from "../curve/StrokeOptions";
import { CurvePrimitive, GeometryQuery, CurveLocationDetail, CurveIntervalRole, AnnounceNumberNumberCurvePrimitive } from "./CurvePrimitive";
import { AxisOrder } from "../Geometry";
import { Clipper } from "../clipping/ClipUtils";
/* tslint:disable:variable-name no-empty*/

/* Starting wtih baseIndex and moving index by stepDirection:
If the vector from baseIndex to baseIndex +1 crossed with vectorA can be normalized, accumulate it (scaled) to normal.
Return when successful.
(Do nothing if everything is parallel through limits of the array)
*/
function accumulateGoodUnitPerpendicular(
  points: GrowableXYZArray,
  vectorA: Vector3d,
  baseIndex: number,
  stepDirection: number,
  weight: number,
  normal: Vector3d,
  workVector: Vector3d): boolean {
  const n = points.length;
  if (stepDirection > 0) {
    for (let i = baseIndex; i + 1 < n; i++) {
      points.vectorIndexIndex(i + 1, i, workVector);
      vectorA.crossProduct(workVector, workVector);
      if (workVector.normalizeInPlace()) {
        normal.addScaledInPlace(workVector, weight);
        return true;
      }
    }
  } else {
    if (baseIndex + 1 >= n)
      baseIndex = n - 2;
    for (let i = baseIndex; i >= 0; i--) {
      points.vectorIndexIndex(i, i + 1, workVector);
      vectorA.crossProduct(workVector, workVector);
      if (workVector.normalizeInPlace()) {
        normal.addScaledInPlace(workVector, weight);
        return true;
      }
    }
  }
  return false;
}

export class LineString3d extends CurvePrimitive implements BeJSONFunctions {
  private static _workPointA = Point3d.create();
  private static _workPointB = Point3d.create();
  private static _workPointC = Point3d.create();

  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof LineString3d; }
  private _points: GrowableXYZArray;
  /** return the points array (cloned). */
  public get points(): Point3d[] { return this._points.getPoint3dArray(); }
  /** Return (reference to) point data in packed GrowableXYZArray. */
  public get packedPoints(): GrowableXYZArray { return this._points; }
  private constructor() {
    super();
    this._points = new GrowableXYZArray();
  }
  public cloneTransformed(transform: Transform): CurvePrimitive {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }

  private static flattenArray(arr: any): any {
    return arr.reduce((flat: any, toFlatten: any) => {
      return flat.concat(Array.isArray(toFlatten) ? LineString3d.flattenArray(toFlatten) : toFlatten);
    }, []);
  }

  public static create(...points: any[]): LineString3d {
    const result = new LineString3d();
    result.addPoints(points);
    return result;
  }

  public static createXY(points: XAndY[], z: number, enforceClosure: boolean = false): LineString3d {
    const result = new LineString3d();
    const xyz = result._points;
    for (const xy of points) {
      xyz.pushXYZ(xy.x, xy.y, z);
    }
    if (enforceClosure && points.length > 1) {
      const distance = xyz.distance(0, xyz.length - 1);
      if (distance !== 0.0) {
        if (Geometry.isSameCoordinate(0, distance)) {
          xyz.pop();   // nonzero but small distance -- to be replaced by point 0 exactly.
          const xyzA = xyz.front();
          xyz.push(xyzA!);
        }
      }
    }
    result.addPoints(points);
    return result;
  }

  public addPoints(...points: any[]) {
    const toAdd: any[] = LineString3d.flattenArray(points);
    for (const p of toAdd) {
      if (p instanceof Point3d)
        this._points.push(p);
    }
  }
  /**
   * Add a point to the linestring.
   * @param point
   */
  public addPoint(point: Point3d) {
    this._points.push(point);
  }
  /**
   * Add a point to the linestring.
   * @param point
   */
  public addPointXYZ(x: number, y: number, z: number = 0) {
    this._points.pushXYZ(x, y, z);
  }

  /**
   * If the linestring is not already closed, add a closure point.
   */
  public addClosurePoint() {
    const n = this._points.length;
    if (n > 1) {
      if (!Geometry.isSameCoordinate(0, this._points.distance(0, n - 1)))
        this._points.pushWrap(1);
    }
  }

  public popPoint() {
    this._points.pop();
  }

  public static createRectangleXY(point0: Point3d, ax: number, ay: number, closed: boolean = true): LineString3d {
    const ls = LineString3d.create();
    const x0 = point0.x;
    const x1 = point0.x + ax;
    const y0 = point0.y;
    const y1 = point0.y + ay;
    const z = point0.z;
    ls.addPointXYZ(x0, y0, z);
    ls.addPointXYZ(x1, y0, z);
    ls.addPointXYZ(x1, y1, z);
    ls.addPointXYZ(x0, y1, z);
    if (closed)
      ls.addClosurePoint();
    return ls;
  }
  /**
   * Create a regular polygon centered
   * @param center center of the polygon.
   * @param edgeCount number of edges.
   * @param radius distance to vertex or edge (see `radiusToVertices`)
   * @param radiusToVertices true if polygon is inscribed in circle (radius measured to vertices); false if polygon is outside circle (radius to edges)
   */
  public static createRegularPolygonXY(center: Point3d, edgeCount: number, radius: number, radiusToVertices: boolean = true): LineString3d {
    if (edgeCount < 3)
      edgeCount = 3;
    const ls = LineString3d.create();
    const i0 = radiusToVertices ? 0 : -1;   // offset to make first vector (radius,0,0)
    const radiansStep = Math.PI / edgeCount;
    let c;
    let s;
    let radians;
    if (!radiusToVertices)
      radius = radius / (1.0 - Math.cos(2.0 * radiansStep));
    for (let i = 0; i < edgeCount; i++) {
      radians = (i0 + 2 * i) * radiansStep;
      c = Angle.cleanupTrigValue(Math.cos(radians));
      s = Angle.cleanupTrigValue(Math.sin(radians));
      ls.addPointXYZ(center.x + radius * c, center.y * radius * s, center.z);
    }
    ls.addClosurePoint();
    return ls;
  }

  public setFrom(other: LineString3d) {
    this._points.clear();
    let i = 0;
    while (other._points.isIndexValid(i)) {
      this._points.push(other._points.getPoint3dAt(i));
      i++;
    }
  }

  public static createPoints(points: Point3d[]): LineString3d {
    const ls = new LineString3d();
    let point;
    for (point of points)
      ls._points.push(point);
    return ls;
  }
  /** Create a LineString3d from xyz coordinates packed in a Float64Array */
  public static createFloat64Array(xyzData: Float64Array): LineString3d {
    const ls = new LineString3d();
    for (let i = 0; i + 3 <= xyzData.length; i += 3)
      ls._points.push(Point3d.create(xyzData[i], xyzData[i + 1], xyzData[i + 2]));
    return ls;
  }

  public clone(): LineString3d {
    const retVal = new LineString3d();
    retVal.setFrom(this);
    return retVal;
  }

  public setFromJSON(json?: any) {
    this._points.clear();
    if (Array.isArray(json)) {
      let xyz;
      for (xyz of json)
        this._points.push(Point3d.fromJSON(xyz));
    }
  }
  /**
   * Convert an LineString3d to a JSON object.
   * @return {*} [[x,y,z],...[x,y,z]]
   */
  public toJSON(): any {
    const value = [];
    let i = 0;
    while (this._points.isIndexValid(i)) {
      value.push(this._points.getPoint3dAt(i).toJSON());
      i++;
    }
    return value;
  }
  public static fromJSON(json?: any): LineString3d {
    const ls = new LineString3d(); ls.setFromJSON(json); return ls;
  }
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const n = this._points.length;
    if (n === 0)
      return Point3d.createZero();
    if (n === 1)
      return Point3d.createFrom(this._points.getPoint3dAt(0), result);
    const df = 1.0 / (n - 1);
    if (fraction <= df)
      return this._points.interpolate(0, fraction / df, 1, result)!;
    if (fraction + df >= 1.0)
      return this._points.interpolate(n - 1, (1.0 - fraction) / df, n - 2, result)!;
    const index0 = Math.floor(fraction / df);
    return this._points.interpolate(index0, (fraction - index0 * df) / df, index0 + 1, result)!;
  }

  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    const n = this._points.length;
    if (n <= 1) {
      result.direction.setZero();
      if (n === 1)
        result.origin.setFrom(this._points.getPoint3dAt(0));
      else result.origin.setZero();
      return result;
    }
    const numSegment = n - 1;
    const df = 1.0 / numSegment;
    if (fraction <= df) {
      result = result ? result : Ray3d.createZero();
      this._points.interpolate(0, fraction / df, 1, result.origin);
      this._points.vectorIndexIndex(0, 1, result.direction);
      result.direction.scaleInPlace(1.0 / df);
      return result;
    }

    if (fraction + df >= 1.0) {
      result = result ? result : Ray3d.createZero();
      this._points.interpolate(n - 2, 1.0 - (1.0 - fraction) / df, n - 1, result.origin);
      this._points.vectorIndexIndex(n - 2, n - 1, result.direction);
      result.direction.scaleInPlace(1.0 / df);
      return result;
    }

    /* true interior point */
    result = result ? result : Ray3d.createZero();
    const index0 = Math.floor(fraction / df);
    const localFraction = (fraction - index0 * df) / df;
    this._points.interpolate(index0, localFraction, index0 + 1, result.origin);
    this._points.vectorIndexIndex(index0, index0 + 1, result.direction);
    result.direction.scaleInPlace(1.0 / df);
    return result;
  }

  /** Return point and derivative at fraction, with 000 second derivative. */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const ray = this.fractionToPointAndDerivative(fraction);
    result = Plane3dByOriginAndVectors.createCapture(ray.origin, ray.direction, Vector3d.createZero(), result);
    return result;
  }
  /**
   * Convert a segment index and local fraction to a global fraction.
   * @param index index of segment being evaluated
   * @param localFraction local fraction within that segment
   */
  public segmentIndexAndLocalFractionToGlobalFraction(index: number, localFraction: number): number {
    const numSegment = this._points.length - 1;
    if (numSegment < 1)
      return 0.0;
    return (index + localFraction) / numSegment;
  }
  /** Return a frenet frame, using nearby points to estimate a plane. */
  public fractionToFrenetFrame(fraction: number, result?: Transform): Transform {
    const n = this._points.length;
    if (n <= 1) {
      if (n === 1)
        return Transform.createTranslation(this._points.getPoint3dAt(0), result);
      return Transform.createIdentity(result);
    }

    if (n === 2)
      return Transform.createRefs(
        this._points.interpolate(0, fraction, 1)!,
        RotMatrix.createRigidHeadsUp(this._points.vectorIndexIndex(0, 1)!, AxisOrder.XYZ));

    /** 3 or more points. */
    const numSegment = n - 1;
    const df = 1.0 / numSegment;
    let baseIndex = 0;
    let localFraction = 0;
    if (fraction <= df) {
      localFraction = fraction / df;
      baseIndex = 0;
    } else if (fraction + df >= 1.0) {
      baseIndex = n - 2;
      localFraction = 1.0 - (1.0 - fraction) / df;
    } else {
      baseIndex = Math.floor(fraction / df);
      localFraction = fraction * numSegment - baseIndex;
    }

    const origin = this._points.interpolate(baseIndex, localFraction, baseIndex + 1)!;
    const vectorA = this._points.vectorIndexIndex(baseIndex, baseIndex + 1)!;
    // tricky stuff to handle colinear points.   But if vectorA is zero it is still a mess . ..
    const normal = Vector3d.create();
    const workVector = Vector3d.create();
    // try forming normal using both forward and reverse stepping.
    // if at an end segment, only one will succeed.
    // if interior, both produce candidates, both can succeed and will be weighted.
    accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex - 1, -1, localFraction, normal, workVector);
    accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex + 1, 1, (1.0 - localFraction), normal, workVector);
    const matrix = RotMatrix.createRigidFromColumns(normal, vectorA, AxisOrder.ZXY);
    if (matrix)
      return Transform.createOriginAndMatrix(origin, matrix, result);
    return Transform.createTranslation(origin, result);
  }

  public startPoint() {
    if (this._points.length === 0)
      return Point3d.createZero();
    return this._points.getPoint3dAt(0);
  }
  public pointAt(i: number, result?: Point3d): Point3d | undefined {
    return this._points.getPoint3dAt(i, result);
  }
  public numPoints(): number { return this._points.length; }

  public endPoint() {
    if (this._points.length === 0)
      return Point3d.createZero();
    return this._points.getPoint3dAt(this._points.length - 1);
  }

  public reverseInPlace(): void {
    if (this._points.length >= 2) {
      let i0 = 0;
      let i1 = this._points.length - 1;
      let a: Point3d = this._points.getPoint3dAt(0);
      while (i0 < i1) {
        a = this._points.getPoint3dAt(i0);
        this._points.setAt(i0, this._points.getPoint3dAt(i1));
        this._points.setAt(i1, a);
        i0++;
        i1--;
      }
    }
  }
  public tryTransformInPlace(transform: Transform): boolean {
    this._points.transformInPlace(transform);
    return true;
  }

  public curveLength(): number { return this._points.sumLengths(); }

  public quickLength(): number { return this.curveLength(); }

  public closestPoint(spacePoint: Point3d, extend: boolean, result?: CurveLocationDetail): CurveLocationDetail {
    result = CurveLocationDetail.create(this, result);

    const numPoints = this._points.length;
    if (numPoints > 0) {
      const lastIndex = numPoints - 1;
      result.setFP(1.0, this._points.getPoint3dAt(lastIndex), undefined);
      result.setDistanceTo(spacePoint);
      if (numPoints > 1) {
        let segmentFraction = 0;
        let d = 0;
        const df = 1.0 / lastIndex;
        for (let i = 1; i < numPoints; i++) {
          segmentFraction = spacePoint.fractionOfProjectionToLine(this._points.getPoint3dAt(i - 1), this._points.getPoint3dAt(i));
          if (segmentFraction < 0) {
            if (!extend || i > 1)
              segmentFraction = 0.0;
          } else if (segmentFraction > 1.0) {
            if (!extend || i < lastIndex)
              segmentFraction = 1.0;
          }
          this._points.getPoint3dAt(i - 1).interpolate(segmentFraction, this._points.getPoint3dAt(i), result.pointQ);
          d = result.pointQ.distance(spacePoint);
          if (d < result.a) {
            result.setFP((i - 1 + segmentFraction) * df, result.pointQ, undefined, d);
          }
        }
      }
    }
    return result;
  }

  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return this._points.isCloseToPlane(plane, Geometry.smallMetricDistance);
  }

  /** push a hit, fixing up the prior entry if needed.
   * return the incremented counter.
   */
  private static pushVertexHit(result: CurveLocationDetail[], counter: number, cp: CurvePrimitive, fraction: number, point: Point3d) {
    const detail = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point);
    result.push(detail);
    if (counter === 0) {
      detail.setIntervalRole(CurveIntervalRole.isolatedAtVertex);
    } else if (counter === 1) {  // last entry must be isolatedAtVertex !!!
      result[result.length - 2].setIntervalRole(CurveIntervalRole.intervalStart);
      detail.setIntervalRole(CurveIntervalRole.intervalEnd);
    } else {
      result[result.length - 2].setIntervalRole(CurveIntervalRole.intervalInterior);
      detail.setIntervalRole(CurveIntervalRole.intervalEnd);
    }
  }
  /** find intersections with a plane.
   *  Intersections within segments are recorded as CurveIntervalRole.isolated
   *   Intersections at isolated "on" vertex are recoded as CurveIntervalRole.isolatedAtVertex.
   */
  public appendPlaneIntersectionPoints(plane: Plane3dByOriginAndUnitNormal, result: CurveLocationDetail[]): number {
    if (this._points.length < 1) return 0;
    const initialLength = result.length;
    const n = this._points.length;
    const divisor = n === 1 ? 1.0 : n - 1;
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    const pointC = LineString3d._workPointC;
    this._points.getPoint3dAt(0, pointA);
    let hB = 0;
    let numConsecutiveZero = 0;
    let hA = 0;
    let segmentFraction = 0;
    for (let i = 0; i < this._points.length; i++ , pointA.setFrom(pointB), hA = hB) {
      this._points.getPoint3dAt(i, pointB);
      hB = Geometry.correctSmallMetricDistance(plane.altitude(pointB));
      if (hB === 0.0)
        LineString3d.pushVertexHit(result, numConsecutiveZero++, this, i / divisor, pointB);
      else {
        if (hA * hB < 0.0) {  // at point0, hA=0 will keep us out of here . ..
          segmentFraction = hA / (hA - hB); // this division is safe because the signs are different.
          pointA.interpolate(segmentFraction, pointB, pointC);
          const detail = CurveLocationDetail.createCurveFractionPoint(this, (i - 1 + segmentFraction) / divisor, pointC);
          detail.setIntervalRole(CurveIntervalRole.isolated);
          result.push(detail);
          numConsecutiveZero = 0;
        }
      }
    }
    return result.length - initialLength;
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void { this._points.extendRange(rangeToExtend, transform); }

  public isAlmostEqual(other: GeometryQuery): boolean {
    if (!(other instanceof LineString3d))
      return false;
    if (!GrowableXYZArray.isAlmostEqual(this._points, other._points)) return false;
    return true;
  }
  /** Append (clone of) one point.
   * BUT ... skip if duplicates the tail of prior points.
   */
  public appendStrokePoint(point: Point3d) {
    const n = this._points.length;
    if (n === 0 || !point.isAlmostEqual(this._points.getPoint3dAt(n - 1)))
      this._points.push(point);
  }
  public clear() { this._points.clear(); }
  /** Evaluate a curve at uniform fractions.  Append the evaluations to this linestring.
   * @param curve primitive to evaluate.
   * @param numStrokes number of strokes (edges).
   * @param fraction0 starting fraction coordinate
   * @param fraction1 end fraction coordinate
   * @param include01 if false, points at fraction0 and fraction1 are omitted.
   */
  public appendFractionalStrokePoints(curve: CurvePrimitive, numStrokes: number, fraction0: number = 0, fraction1: number = 1, include01: boolean): void {
    if (include01)
      this.appendStrokePoint(curve.fractionToPoint(fraction0));
    if (numStrokes > 1) {
      const df = (fraction1 - fraction0) / numStrokes;
      for (let i = 1; i < numStrokes; i++)
        this.appendStrokePoint(curve.fractionToPoint(fraction0 + i * df));
    }
    if (include01)
      this.appendStrokePoint(curve.fractionToPoint(fraction1));
  }

  public appendInterpolatedStrokePoints(numStrokes: number, point0: Point3d, point1: Point3d, include01: boolean): void {
    if (include01)
      this.appendStrokePoint(point0);
    if (numStrokes > 1) {
      const df = 1.0 / numStrokes;
      for (let i = 1; i < numStrokes; i++)
        this.appendStrokePoint(point0.interpolate(i * df, point1));
    }
    if (include01)
      this.appendStrokePoint(point1);
  }

  /** Emit strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const n = this._points.length;
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;

    if (n > 0) {
      // This is a linestring.
      // There is no need for chordTol and angleTol within a segment.
      // Do NOT apply minstrokes per primitive.
      if (options && options.hasMaxEdgeLength) {
        dest.appendStrokePoint(this._points.getPoint3dAt(0));
        for (let i = 1; i < n; i++) {
          this._points.getPoint3dAt(i - 1, pointA);
          this._points.getPoint3dAt(i, pointB);
          const numStroke = options.applyMaxEdgeLength(1, pointA.distance(pointB));
          if (numStroke > 1)
            dest.appendInterpolatedStrokePoints(numStroke, pointA, pointB, false);
          dest.appendStrokePoint(pointB);
        }
      } else {
        for (let i = 0; i < n; i++) {
          dest.appendStrokePoint(this._points.getPoint3dAt(i));
        }
      }
    }
  }

  /** Emit strokable parts of the curve to a caller-supplied handler.
   * If the stroke options does not have a maxEdgeLength, one stroke is emited for each segment of the linestring.
   * If the stroke options has a maxEdgeLength, smaller segments are emitted as needed.
   */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const n = this._points.length;
    handler.startCurvePrimitive(this);
    if (n > 1) {
      const df = 1.0 / (n - 1);
      // This is a linestring.
      // There is no need for chordTol and angleTol within a segment.
      // Do NOT apply minstrokes per primitive.
      if (options && options.hasMaxEdgeLength) {
        for (let i = 1; i < n; i++) {
          const numStroke = options.applyMaxEdgeLength(1, this._points.getPoint3dAt(i - 1).distance(this._points.getPoint3dAt(i)));
          handler.announceSegmentInterval(this, this._points.getPoint3dAt(i - 1), this._points.getPoint3dAt(i), numStroke, (i - 1) * df, i * df);
        }
      } else {
        for (let i = 1; i < n; i++) {
          handler.announceSegmentInterval(this, this._points.getPoint3dAt(i - 1), this._points.getPoint3dAt(i), 1, (i - 1) * df, i * df);
        }
      }
    }
    handler.endCurvePrimitive(this);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLineString3d(this);
  }
  // HARD TO TEST -- tests that get to announceClipInterval for arc, bspline do NOT get here with
  // linestring because the controller has special case loops through segments?
  /**
   * Find intervals of this curveprimitve that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce (optional) function to be called announcing fractional intervals"  ` announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const n = this._points.length;
    if (n < 2) return false;
    let globalFractionA = 0.0;
    let globalFractionB = 1.0;
    const capture = (localFraction0: number, localFraction1: number) => {
      if (announce)
        announce(
          Geometry.interpolate(globalFractionA, localFraction0, globalFractionB),
          Geometry.interpolate(globalFractionA, localFraction1, globalFractionB),
          this);
    };
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    this._points.getPoint3dAt(0, pointA);
    let status = false;
    for (let i = 1; i < n; i++ , pointA.setFrom(pointB), globalFractionA = globalFractionB) {
      this._points.getPoint3dAt(i, pointB);
      globalFractionB = i / (n - 1);
      if (clipper.announceClippedSegmentIntervals(0.0, 1.0, pointA, pointB, capture))
        status = true;
    }
    return status;
  }
  private static _indexPoint = Point3d.create();  // private point for indexAndFractionToPoint.
  private addResolvedPoint(index: number, fraction: number, dest: GrowableXYZArray) {
    const n = this._points.length;
    if (n === 0) return;
    if (n === 1) {
      this._points.getPoint3dAt(0, LineString3d._indexPoint);
      dest.push(LineString3d._indexPoint);
      return;
    }
    if (index < 0)
      index = 0;
    if (index >= n) {
      index = n - 1;
      fraction += 1;
    }
    this._points.interpolate(index, fraction, index + 1, LineString3d._indexPoint);
    dest.push(LineString3d._indexPoint);
  }
  /** Return (if possible) a LineString which is a portion of this curve.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public clonePartialCurve(fractionA: number, fractionB: number): CurvePrimitive | undefined {
    if (fractionB < fractionA) {
      const linestringA = this.clonePartialCurve(fractionB, fractionA);
      if (linestringA)
        linestringA.reverseInPlace();
      return linestringA;
    }
    const n = this._points.length;
    const numEdge = n - 1;
    if (n < 2 || fractionA >= 1.0 || fractionB <= 0.0)
      return undefined;
    if (fractionA < 0)
      fractionA = 0;
    if (fractionB > 1)
      fractionB = 1;
    const gA = fractionA * numEdge;
    const gB = fractionB * numEdge;
    const indexA = Math.floor(gA);
    const indexB = Math.floor(gB);
    const localFractionA = gA - indexA;
    const localFractionB = gB - indexB;
    const result = LineString3d.create();
    this.addResolvedPoint(indexA, localFractionA, result._points);
    for (let index = indexA + 1; index <= indexB; index++) {
      this._points.getPoint3dAt(index, LineString3d._workPointA);
      result._points.push(LineString3d._workPointA);
    }
    if (!Geometry.isSmallRelative(localFractionB)) {
      this.addResolvedPoint(indexB, localFractionB, result._points);
    }
    return result;
  }
}

/** An AnnotatedLineString3d is a linestring with additional data attached to each point
 * * This is useful in facet construction.
 */
export class AnnotatedLineString3d {
  public curveParam?: GrowableFloat64Array;
  /**
   * uv parameters, stored as uvw with the w possibly used for distinguishing among multiple "faces".
   */
  public uvwParam?: GrowableXYZArray;
  public vecturU?: GrowableXYZArray;
  public vectorV?: GrowableXYZArray;
}
