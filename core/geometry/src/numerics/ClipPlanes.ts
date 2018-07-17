/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Segment1d, Point3d, Vector3d } from "../PointVector";
import { Range1d } from "../Range";
import { Range3d } from "../Range";
import { Transform, RotMatrix } from "../Transform";
import { Point4d, Matrix4d } from "./Geometry4d";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { Geometry, Angle } from "../Geometry";
import { PolygonOps } from "../PointHelpers";
import { GrowableFloat64Array } from "../GrowableArray";
import { AnalyticRoots } from "./Polynomials";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Arc3d } from "../curve/Arc3d";
import { ClipPlaneContainment } from "./ClipPrimitives";
import { CurvePrimitive, AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
export interface ClipperMethods {
  isPointOnOrInside(point: Point3d, tolerance?: number): boolean;
  /** Find the parts of the line segment  (if any) that is within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * * To clip to the usual bounded line segment, start with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative Number.MAX_VALUE.
   * @param fraction0 fraction that is the initial lower fraction of the active interval. (e.g. 0.0 for bounded segment)
   * @param fraction1 fraction that is the initial upper fraction of the active interval.  (e.g. 1.0 for bounded segment)
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean;
  announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean;
}
/**
 * ClipUtilities is a static class whose various methods are useful helpers for clipping.
 */
export class ClipUtilities {
  private static sSelectIntervals01TestPoint = Point3d.create();
  public static selectIntervals01(curve: CurvePrimitive, unsortedFractions: GrowableFloat64Array, clipper: ClipperMethods, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    unsortedFractions.push(0);
    unsortedFractions.push(1);
    unsortedFractions.sort();
    let f0 = unsortedFractions.at(0);
    let f1;
    let fMid;
    const testPoint = ClipUtilities.sSelectIntervals01TestPoint;
    const n = unsortedFractions.length;
    for (let i = 1; i < n; i++ , f0 = f1) {
      f1 = unsortedFractions.at(i);
      fMid = 0.5 * (f0 + f1);
      if (f1 > f0 && (fMid >= 0.0 && fMid <= 1.0)) {
        curve.fractionToPoint(fMid, testPoint);
        if (clipper.isPointOnOrInside(testPoint)) {
          if (announce)
            announce(f0, f1, curve);
          else
            return true;
        }
      }
    }
    return false;
  }
  /**
   * Announce triples of (low, high, cp) for each entry in intervals
   * @param intervals source array
   * @param cp CurvePrimitive for announcement
   * @param announce funtion to receive data
   */
  public static announceNNC(intervals: Range1d[], cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    if (announce) {
      for (const ab of intervals) {
        announce(ab.low, ab.high, cp);
      }
    }
    return intervals.length > 0;
  }

  public static collectClippedCurves(curve: CurvePrimitive, clipper: ClipperMethods): CurvePrimitive[] {
    const result: CurvePrimitive[] = [];
    curve.announceClipIntervals(clipper,
      (fraction0: number, fraction1: number, curveA: CurvePrimitive) => {
        if (fraction1 !== fraction0) {
          const partialCurve = curveA.clonePartialCurve(fraction0, fraction1);
          if (partialCurve)
            result.push(partialCurve);
        }
      });
    return result;
  }
}

/** A ClipPlane is a single plane represented as
 * * An inward unit normal (u,v,w)
 * * A signedDistance
 *
 * Hence
 * * The halfspace function evaluation for "point" [x,y,z,] is: ([x,y,z] DOT (u,v,w)l - signedDistance)
 * * POSITIVE values of the halfspace function are "inside"
 * * ZERO value of the halfspace function is "on"
 * * NEGATIVE value of the halfspace function is "outside"
 * * A representative point on the plane is (signedDistance*u, signedDistance * v, signedDistance *w)
 */
export class ClipPlane implements ClipperMethods {
  // Static variable from original native c++ function ConvexPolygonClipInPlace
  public static fractionTol = 1.0e-8;
  private _inwardNormal: Vector3d;
  /** Construct a parallel plane through the origin.
   * * Move it to the actual position.
   * * _distanceFromOrigin is the distance it moved, with the (inward) normal direction as positive
   */
  private _distanceFromOrigin: number;
  private _invisible: boolean;
  private _interior: boolean;

  private constructor(normal: Vector3d, distance: number, invisible: boolean, interior: boolean) {
    this._invisible = invisible;
    this._interior = interior;
    this._inwardNormal = normal;
    this._distanceFromOrigin = distance;
  }
  /**
   * @returns Return true if all members are almostEqual to corresponding members of other.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: ClipPlane): boolean {
    return Geometry.isSameCoordinate(this._distanceFromOrigin, other._distanceFromOrigin)
      && this._inwardNormal.isAlmostEqual(other._inwardNormal)
      && this._interior === other._interior
      && this._invisible === other._invisible;
  }
  /** @return a cloned plane */
  public clone(): ClipPlane {
    const result = new ClipPlane(this._inwardNormal.clone(), this._distanceFromOrigin, this._invisible, this._interior);
    return result;
  }
  /** @return Return a cloned plane with coordinate data negated. */
  public cloneNegated(): ClipPlane {
    const plane = new ClipPlane(this._inwardNormal.clone(), this._distanceFromOrigin, this._invisible, this._interior);
    plane.negateInPlace();
    return plane;
  }
  /** Create a ClipPlane from Plane3dByOriginAndUnitNormal. */
  public static createPlane(plane: Plane3dByOriginAndUnitNormal, invisible: boolean = false, interior: boolean = false, result?: ClipPlane): ClipPlane {
    const distance = plane.getNormalRef().dotProduct(plane.getOriginRef());
    if (result) {
      result._invisible = invisible;
      result._interior = interior;
      result._inwardNormal = plane.getNormalRef().clone();
      result._distanceFromOrigin = distance;
      return result;
    }
    return new ClipPlane(plane.getNormalRef().clone(), distance, invisible, interior);
  }
  /**
   * * Create a ClipPlane with direct normal and signedDistance.
   * * The vector is normalized for storage.
   */
  public static createNormalAndDistance(normal: Vector3d, distance: number, invisible: boolean = false, interior: boolean = false, result?: ClipPlane): ClipPlane | undefined {
    const normalized = normal.normalize();
    if (normalized) {
      if (result) {
        result._invisible = invisible;
        result._interior = interior;
        result._inwardNormal = normalized;
        result._distanceFromOrigin = distance;
      }
      return new ClipPlane(normalized, distance, invisible, interior);
    }
    return undefined;
  }
  /** Create a ClipPlane
   * * "normal" is the inward normal of the plane. (It is internally normalized)
   * * "point" is any point of the plane.
   * * The stored distance for the plane is the dot product of the point with the normal (i.e. treat the point's xyz as a vector from the origin.)
   */
  public static createNormalAndPoint(normal: Vector3d, point: Point3d, invisible: boolean = false, interior: boolean = false, result?: ClipPlane): ClipPlane | undefined {
    const normalized = normal.normalize();
    if (normalized) {
      const distance = normalized.dotProduct(point);
      if (result) {
        result._invisible = invisible;
        result._interior = interior;
        result._inwardNormal = normalized;
        result._distanceFromOrigin = distance;
      }
      return new ClipPlane(normalized, distance, invisible, interior);
    }
    return undefined;
  }

  /** Create a ClipPlane
   * * "normal" is the inward normal of the plane. (It is internally normalized)
   * * "point" is any point of the plane.
   * * The stored distance for the plane is the dot product of the point with the normal (i.e. treat the point's xyz as a vector from the origin.)
   */
  public static createNormalAndPointXYZXYZ(normalX: number, normalY: number, normalZ: number,
    originX: number, originY: number, originZ: number,
    invisible: boolean = false, interior: boolean = false): ClipPlane | undefined {
    const normal = Vector3d.create(normalX, normalY, normalZ);

    const normalized = normal.normalizeInPlace();
    if (normalized) {
      const distance = normal.dotProductXYZ(originX, originY, originZ);
      return new ClipPlane(normal, distance, invisible, interior);
    }
    return undefined;
  }

  /**
   * return a json object of the form
   * `{"normal":[u,v,w],"dist":signedDistanceValue,"interior":true,"invisible":true}`
   */
  public toJSON(): any {
    const val: any = {};
    val.normal = this.inwardNormalRef.toJSON();
    val.dist = this.distance;
    if (this.interior)
      val.interior = true;
    if (this.invisible)
      val.invisible = true;
    return val;
  }

  public static fromJSON(json: any, result?: ClipPlane): ClipPlane | undefined {
    if (json && json.normal && Number.isFinite(json.dist)) {
      return ClipPlane.createNormalAndDistance(Vector3d.fromJSON(json.normal), json.dist, !!json.invisible, !!json.interior);
    }
    return ClipPlane.createNormalAndDistance(Vector3d.unitZ(), 0, false, false, result);
  }

  public setFlags(invisible: boolean, interior: boolean) {
    this._invisible = invisible;
    this._interior = interior;
  }

  // Getters
  public get distance() { return this._distanceFromOrigin; }
  public get inwardNormalRef(): Vector3d { return this._inwardNormal; }
  public get interior() { return this._interior; }
  public get invisible() { return this._invisible; }

  public static createEdgeAndUpVector(point0: Point3d, point1: Point3d, upVector: Vector3d, tiltAngle: Angle, result?: ClipPlane): ClipPlane | undefined {
    const edgeVector = Vector3d.createFrom(point1.minus(point0));
    let normal = (upVector.crossProduct(edgeVector)).normalize();

    if (normal) {
      if (!tiltAngle.isAlmostZero()) {
        const tiltNormal = Vector3d.createRotateVectorAroundVector(normal, edgeVector, tiltAngle);
        if (tiltNormal) {
          normal = tiltNormal.clone();
        }
      }
      normal.negate(normal);
      return ClipPlane.createNormalAndPoint(normal, point0, false, false, result);
    }
    return undefined;
  }

  public static createEdgeXY(point0: Point3d, point1: Point3d, result?: ClipPlane): ClipPlane | undefined {
    const normal = Vector3d.create(point0.y - point1.y, point1.x - point0.x);
    if (normal.normalizeInPlace())
      return ClipPlane.createNormalAndPoint(normal, point0, false, false, result);
    return undefined;
  }

  public getPlane3d(): Plane3dByOriginAndUnitNormal {
    const d = this._distanceFromOrigin;
    // Normal should be normalized, will not return undefined
    return Plane3dByOriginAndUnitNormal.create(Point3d.create(this._inwardNormal.x * d, this._inwardNormal.y * d, this._inwardNormal.z * d), this._inwardNormal)!;
  }

  public getPlane4d(): Point4d {
    return Point4d.create(this._inwardNormal.x, this._inwardNormal.y, this._inwardNormal.z, - this._distanceFromOrigin);
  }

  public setPlane4d(plane: Point4d) {
    const a = Math.sqrt(plane.x * plane.x + plane.y * plane.y + plane.z * plane.z);
    const r = a === 0.0 ? 1.0 : 1.0 / a;
    this._inwardNormal.x = r * plane.x;
    this._inwardNormal.y = r * plane.y;
    this._inwardNormal.z = r * plane.z;
    this._distanceFromOrigin = -r * plane.w;
  }

  public evaluatePoint(point: Point3d): number {
    return point.x * this._inwardNormal.x + point.y * this._inwardNormal.y + point.z * this._inwardNormal.z - this._distanceFromOrigin;
  }
  /** @returns return the dot product of the plane normal with the vector (NOT using the plane's distanceFromOrigin).
   */
  public dotProductVector(vector: Vector3d): number {
    return vector.x * this._inwardNormal.x + vector.y * this._inwardNormal.y + vector.z * this._inwardNormal.z;
  }
  /** @returns return the dot product of the plane normal with the point (treating the point xyz as a vector, and NOT using the plane's distanceFromOrigin).
   */
  public dotProductPlaneNormalPoint(point: Point3d): number {
    return point.x * this._inwardNormal.x + point.y * this._inwardNormal.y + point.z * this._inwardNormal.z;
  }

  public isPointOnOrInside(point: Point3d, tolerance?: number): boolean {
    let value = this.evaluatePoint(point);
    if (tolerance) { value += tolerance; }
    return value >= 0.0;
  }

  public isPointInside(point: Point3d, tolerance?: number): boolean {
    let value = this.evaluatePoint(point);
    if (tolerance) { value += tolerance; }
    return value > 0.0;
  }

  public isPointOn(point: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    return Math.abs(this.evaluatePoint(point)) <= tolerance;
  }

  public appendIntersectionRadians(arc: Arc3d, intersectionRadians: GrowableFloat64Array) {
    const arcVectors = arc.toVectors();
    const alpha = this.evaluatePoint(arc.center);
    const beta = this.dotProductVector(arcVectors.vector0);
    const gamma = this.dotProductVector(arcVectors.vector90);
    AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, undefined, undefined, intersectionRadians);
  }

  private static sClipArcFractionArray = new GrowableFloat64Array();
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = ClipPlane.sClipArcFractionArray;
    breaks.clear();
    this.appendIntersectionRadians(arc, breaks);
    arc.sweep.radiansArraytoPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }
  /**
   * * Compute intersection of (unbounded) segment with the plane.
   * * If the ends are on the same side of the plane, return undefined.
   * * If the intersection is an endpoint or interior to the segment return the fraction.
   * * If both ends are on, return undefined.
   */
  public getBoundedSegmentSimpleIntersection(pointA: Point3d, pointB: Point3d): number | undefined {
    const h0 = this.evaluatePoint(pointA);
    const h1 = this.evaluatePoint(pointB);
    if (h0 * h1 > 0.0)
      return undefined;
    if (h0 === 0.0 && h1 === 0.0) {
      return undefined;
    }
    return - h0 / (h1 - h0);
  }

  // Returns true if successful
  public transformInPlace(transform: Transform): boolean {
    const plane: Plane3dByOriginAndUnitNormal = this.getPlane3d();
    const matrix: RotMatrix = transform.matrix;
    const newPoint = transform.multiplyPoint3d(plane.getOriginRef());
    // Normal transforms as the inverse transpose of the matrix part
    // BTW: If the matrix is orthogonal, this is a long way to multiply by the matrix part (mumble grumble)
    const newNormal = matrix.multiplyInverseTranspose(plane.getNormalRef());
    if (!newNormal)
      return false;

    plane.set(newPoint, newNormal);
    const normalized = (plane.getNormalRef()).normalize();
    if (!normalized)
      return false;
    this._inwardNormal = normalized;
    this._distanceFromOrigin = this._inwardNormal.dotProduct(plane.getOriginRef());
    return true;
  }

  public setInvisible(invisible: boolean) {
    this._invisible = invisible;
  }

  /**  reverse the sign of all coefficients, so outside and inside reverse */
  public negateInPlace() {
    this._inwardNormal = this._inwardNormal.negate();
    this._distanceFromOrigin = - this._distanceFromOrigin;
  }
  /**
   * Move the plane INWARD by given distance
   * @param offset distance of shift inwards
   */
  public offsetDistance(offset: number) {
    this._distanceFromOrigin += offset;
  }

  public convexPolygonClipInPlace(xyz: Point3d[], work: Point3d[]) {
    work.length = 0;
    let numNegative = 0;
    ClipPlane.fractionTol = 1.0e-8;
    if (xyz.length > 2) {
      let xyz0 = xyz[xyz.length - 1];
      let a0 = this.evaluatePoint(xyz0);
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (const xyz1 of xyz) {
        const a1 = this.evaluatePoint(xyz1);
        if (a1 < 0)
          numNegative++;
        if (a0 * a1 < 0.0) {
          // simple crossing . . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - ClipPlane.fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
          } else {
            work.push(xyz0.interpolate(f, xyz1));
          }
        }
        if (a1 >= 0.0)
          work.push(xyz1);
        xyz0 = Point3d.createFrom(xyz1);
        a0 = a1;
      }
    }

    if (work.length <= 2) {
      xyz.length = 0;
    } else if (numNegative > 0) {
      xyz.length = 0;
      for (const xyzi of work) {
        xyz.push(xyzi);
      }
      work.length = 0;
    }

  }

  public polygonCrossings(xyz: Point3d[], crossings: Point3d[]) {
    crossings.length = 0;
    if (xyz.length >= 2) {
      let xyz0 = xyz[xyz.length - 1];
      let a0 = this.evaluatePoint(xyz0);
      for (const xyz1 of xyz) {
        const a1 = this.evaluatePoint(xyz1);
        if (a0 * a1 < 0.0) {
          // simple crossing. . .
          const f = - a0 / (a1 - a0);
          crossings.push(xyz0.interpolate(f, xyz1));
        }
        if (a1 === 0.0) {        // IMPORTANT -- every point is directly tested here
          crossings.push(xyz1);
        }
        xyz0 = Point3d.createFrom(xyz1);
        a0 = a1;
      }
    }
  }

  public convexPolygonSplitInsideOutside(xyz: Point3d[], xyzIn: Point3d[], xyzOut: Point3d[], altitudeRange: Range1d) {
    xyzOut.length = 0;
    xyzIn.length = 0;
    // let numSplit = 0;
    ClipPlane.fractionTol = 1.0e-8;
    if (xyz.length > 2) {
      let xyz0 = xyz[xyz.length - 1];
      altitudeRange.setNull();
      let a0 = this.evaluatePoint(xyz0);
      altitudeRange.extendX(a0);
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (const xyz1 of xyz) {
        const a1 = this.evaluatePoint(xyz1);
        altitudeRange.extendX(a1);
        let nearZero = false;
        if (a0 * a1 < 0.0) {
          // simple crossing. . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - ClipPlane.fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
            nearZero = true;
          } else {
            const xyzA = xyz0.interpolate(f, xyz1);
            xyzIn.push(xyzA);
            xyzOut.push(xyzA);
          }
          // numSplit++;
        }
        if (a1 >= 0.0 || nearZero)
          xyzIn.push(xyz1);
        if (a1 <= 0.0 || nearZero)
          xyzOut.push(xyz1);
        xyz0 = Point3d.createFrom(xyz1);
        a0 = a1;
      }
    }
  }

  public multiplyPlaneByMatrix(matrix: Matrix4d) {
    const plane: Point4d = this.getPlane4d();
    matrix.multiplyTransposePoint4d(plane, plane);
    this.setPlane4d(plane);
  }

  /** announce the interval (if any) where a line is within the clip plane half space. */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: (fraction0: number, fraction1: number) => void): boolean {
    if (f1 < f0)
      return false;
    const h0 = - this.evaluatePoint(pointA);
    const h1 = - this.evaluatePoint(pointB);
    const delta = h1 - h0;
    const f = Geometry.conditionalDivideFraction(-h0, delta);
    if (f === undefined) { // The segment is parallel to the plane.
      if (h0 <= 0.0) { if (announce) announce(f0, f1); return true; }
      return false;
    }
    if (delta > 0) { // segment aims OUT
      if (f < f1) f1 = f;
    } else {
      // segment aims IN
      if (f > f0)
        f0 = f;
    }
    if (f1 < f0)
      return false;
    if (announce) announce(f0, f1);
    return true;
  }
}

/**
 * A ConvexClipPlaneSet is a collection of ClipPlanes, often used for bounding regions of space.
 */
export class ConvexClipPlaneSet implements ClipperMethods {
  public static readonly hugeVal = 1e37;
  private _planes: ClipPlane[];
  // private _parity: number;   <--- Not yet used
  // public get parity() { return this._parity; }
  // public set parity(value: number) { this._parity = value; }
  private constructor(planes?: ClipPlane[]) {
    // this._parity = 1;
    this._planes = planes ? planes : [];
  }

  public toJSON(): any {
    const val: any = [];
    for (const plane of this._planes) {
      val.push(plane.toJSON());
    }
    return val;
  }

  public static fromJSON(json: any, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    if (!Array.isArray(json))
      return result;
    for (const thisJson of json) {
      const plane = ClipPlane.fromJSON(thisJson);
      if (plane)
        result._planes.push(plane);
    }
    return result;
  }
  /**
   * @returns Return true if all members are almostEqual to corresponding members of other.  This includes identical order in array.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: ConvexClipPlaneSet): boolean {
    if (this._planes.length !== other._planes.length)
      return false;
    for (let i = 0; i < this._planes.length; i++)
      if (!this._planes[i].isAlmostEqual(other._planes[i]))
        return false;
    return true;
  }

  public static createPlanes(planes: ClipPlane[], result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    for (const plane of planes)
      result._planes.push(plane);
    return result;
  }

  /**
   * Create new convex set using selected planes of a Range3d.
   * @param range range with coordinates
   * @param lowX true to clip at the low x plane
   * @param highX true to clip at the high x plane
   * @param lowY true to clip at the low y plane
   * @param highY true to clip at the high z plane
   * @param lowZ true to clip at the low z plane
   * @param highZ true to clip at the high z plane
   */
  public static createRange3dPlanes(range: Range3d,
    lowX: boolean = true, highX: boolean = true,
    lowY: boolean = true, highY: boolean = true,
    lowZ: boolean = true, highZ: boolean = true): ConvexClipPlaneSet {
    const result = ConvexClipPlaneSet.createEmpty();

    if (lowX)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, range.low.x, 0, 0)!);
    if (highX)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(-1, 0, 0, range.high.x, 0, 0)!);

    if (lowY)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 1, 0, 0, range.low.y, 0)!);
    if (highY)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, -1, 0, 0, range.high.y, 0)!);

    if (lowZ)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, range.low.z)!);
    if (highZ)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 0, -1, 0, 0, range.high.z)!);

    return result;
  }

  public static createEmpty(result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    if (result) {
      result._planes.length = 0;
      return result;
    }
    return new ConvexClipPlaneSet();
  }
  /** negate all planes of the set. */
  public negateAllPlanes(): void {
    for (const plane of this._planes)
      plane.negateInPlace();
  }
  public static createXYBox(x0: number, y0: number, x1: number, y1: number, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    const clip0 = ClipPlane.createNormalAndDistance(Vector3d.create(-1, 0, 0), -x1, false, true);
    const clip1 = ClipPlane.createNormalAndDistance(Vector3d.create(1, 0, 0), x0, false, true);
    const clip2 = ClipPlane.createNormalAndDistance(Vector3d.create(0, -1, 0), -y1, false, true);
    const clip3 = ClipPlane.createNormalAndDistance(Vector3d.create(0, 1, 0), y0, false, true);
    if (clip0 && clip1 && clip2 && clip3) {
      result._planes.push(clip0, clip1, clip2, clip3);
    }
    return result;
  }

  public static createXYPolyLine(points: Point3d[], interior: boolean[], leftIsInside: boolean, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (let i0 = 0; (i0 + 1) < points.length; i0++) {
      const edgeVector: Vector3d = Vector3d.createStartEnd(points[i0], points[i0 + 1]);
      const perp: Vector3d = edgeVector.unitPerpendicularXY();
      perp.z = 0.0;

      if (!leftIsInside)
        perp.negate();

      const perpNormalized = perp.normalize();
      if (perpNormalized) {
        const clip = ClipPlane.createNormalAndPoint(perp, points[i0], interior[i0], interior[i0]);
        if (clip) { result._planes.push(clip); }
      }
    }

    return result;
  }

  /**
   * Create a convexClipPlaneSet with planes whose "inside" normal is to the left of each segment.
   * @param points array of points.
   */
  public static createXYPolyLineInsideLeft(points: Point3d[], result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (let i0 = 0; (i0 + 1) < points.length; i0++) {
      const edgeVector: Vector3d = Vector3d.createStartEnd(points[i0], points[i0 + 1]);
      const perp: Vector3d = edgeVector.unitPerpendicularXY();
      perp.z = 0.0;

      const perpNormalized = perp.normalize();
      if (perpNormalized) {
        const clip = ClipPlane.createNormalAndPoint(perp, points[i0], false, false);
        if (clip) { result._planes.push(clip); }
      }
    }

    return result;
  }

  public clone(result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (const plane of this._planes)
      result._planes.push(plane.clone());
    return result;
  }

  public get planes(): ClipPlane[] {
    return this._planes;
  }

  // tNear passed as Float64Array of size 1 to be used as reference
  public static testRayIntersections(tNear: Float64Array, origin: Point3d, direction: Vector3d, planes: ConvexClipPlaneSet): boolean {
    tNear[0] = -ConvexClipPlaneSet.hugeVal;
    let tFar = ConvexClipPlaneSet.hugeVal;

    for (const plane of planes._planes) {
      const vD = plane.dotProductVector(direction);
      const vN = plane.evaluatePoint(origin);

      if (vD === 0.0) {
        // Ray is parallel... No need to continue testing if outside halfspace.
        if (vN < 0.0)
          return false;
      } else {
        const rayDistance = - vN / vD;
        if (vD < 0.0) {
          if (rayDistance < tFar)
            tFar = rayDistance;
        } else {
          if (rayDistance > tNear[0])
            tNear[0] = rayDistance;
        }
      }
    }
    return tNear[0] <= tFar;
  }

  public multiplyPlanesByMatrix(matrix: Matrix4d) {
    for (const plane of this._planes) {
      plane.multiplyPlaneByMatrix(matrix);
    }
  }

  public isPointInside(point: Point3d): boolean {
    for (const plane of this._planes) {
      if (!plane.isPointInside(point))  // Defaults to strict inside check. Other clipping classes may use "on or inside" check for the "on" case
        return false;
    }
    return true;
  }

  public isPointOnOrInside(point: Point3d, tolerance: number): boolean {
    const interiorTolerance = Math.abs(tolerance);   // Interior tolerance should always be positive. (TFS# 246598).
    for (const plane of this._planes) {
      if (!plane.isPointOnOrInside(point, (plane.interior ? interiorTolerance : tolerance)))
        return false;
    }
    return true;
  }

  public isSphereInside(point: Point3d, radius: number): boolean {
    // Note - The sphere logic differ from "PointOnOrInside" only in the handling of interior planes.
    // For a sphere we don't negate the tolerance on interior planes - we have to look for true containment (TFS# 439212).
    for (const plane of this._planes) {
      if (!plane.isPointOnOrInside(point, radius)) {
        return false;
      }
    }
    return true;
  }

  /** Find the parts of the line segment  (if any) that is within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * * To clip to the usual bounded line segment, starts with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative Number.MAX_VALUE.
   * @param fraction0 fraction that is the initial lower fraction of the active interval. (e.g. 0.0 for bounded segment)
   * @param fraction1 fraction that is the initial upper fraction of the active interval.  (e.g. 1.0 for bounded segment)
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: (fraction0: number, fraction1: number) => void): boolean {
    let fraction: number | undefined;
    if (f1 < f0)
      return false;
    for (const plane of this._planes) {
      const hA = - plane.evaluatePoint(pointA);
      const hB = - plane.evaluatePoint(pointB);
      fraction = Geometry.safeDivideFraction(-hA, (hB - hA), 0.0);
      if (fraction === undefined) {
        // LIne parallel to the plane.  If positive, it is all OUT
        if (hA > 0.0)
          return false;
      } else if (hB > hA) {    // STRICTLY moving outward
        if (fraction < f0)
          return false;
        if (fraction < f1)
          f1 = fraction;
      } else if (hA > hB) { // STRICTLY moving inward
        if (fraction > f1)
          return false;
        if (fraction > f0)
          f0 = fraction;
      } else {
        // Strictly equal evaluations
        if (hA > 0.0)
          return false;
      }
    }
    if (f1 >= f0) {
      if (announce)
        announce(f0, f1);
      return true;
    }
    return false;
  }

  private static sClipArcFractionArray = new GrowableFloat64Array();
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = ConvexClipPlaneSet.sClipArcFractionArray;
    breaks.clear();
    for (const clipPlane of this.planes) {
      clipPlane.appendIntersectionRadians(arc, breaks);
    }
    arc.sweep.radiansArraytoPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }
  /** Find the parts of the (unbounded) line segment  (if any) that is within the convex clip volume.
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  public clipUnboundedSegment(pointA: Point3d, pointB: Point3d, announce?: (fraction0: number, fraction1: number) => void): boolean {
    return this.announceClippedSegmentIntervals(-Number.MAX_VALUE, Number.MAX_VALUE, pointA, pointB, announce);
  }

  public transformInPlace(transform: Transform) {
    for (const plane of this._planes) {
      plane.transformInPlace(transform);
    }
  }

  /** Returns 1, 2, or 3 based on whether point array is strongly inside, ambiguous, or strongly outside respectively.
   * * This has a peculiar expected use case as a very fast pre-filter for more precise clipping.
   * * The expected point set is for a polygon.
   * * Hence any clipping will eventually have to consider the lines between the points.
   * * This method looks for the special case of a single clip plane that has all the points outside.
   * * In this case the whole polygon must be outside.
   * * Note that this does not detect a polygon that is outside but "crosses a corner" -- it is mixed with respect to
   *     multiple planes.
   */
  public classifyPointContainment(points: Point3d[], onIsOutside: boolean): ClipPlaneContainment {
    let allInside = true;
    const onTolerance = onIsOutside ? 1.0e-8 : -1.0e-8;
    const interiorTolerance = 1.0e-8;   // Interior tolerance should always be positive

    for (const plane of this._planes) {
      let nOutside = 0;
      for (const point of points) {
        if (plane.evaluatePoint(point) < (plane.interior ? interiorTolerance : onTolerance)) {
          nOutside++;
          allInside = false;
        }
      }

      if (nOutside === points.length)
        return ClipPlaneContainment.StronglyOutside;
    }

    return allInside ? ClipPlaneContainment.StronglyInside : ClipPlaneContainment.Ambiguous;
  }

  /**
   * * Create a convex clip set for a polygon swept with possible tilt angle.
   * * planes are constructed by ClipPlane.createEdgeAndUpVector, using successive points from the array.
   * * If the first and last points match, the polygon area is checked.  If the area is negative, points are used in reverse order.
   * * If first and last points do not match, points are used in order given
   * @param points polygon points. (Closure point optional)
   * @param upVector primary sweep direction, as applied by ClipPlane.createEdgeAndUpVector
   * @param tiltAngle angle to tilt sweep planes away from the sweep direction.
   */
  public static createSweptPolyline(points: Point3d[], upVector: Vector3d, tiltAngle: Angle): ConvexClipPlaneSet | undefined {
    const result = ConvexClipPlaneSet.createEmpty();
    let reverse = false;
    if (points.length > 3 && points[0].isAlmostEqual(points[points.length - 1])) {
      const polygonNormal: Vector3d = PolygonOps.areaNormal(points);
      const normalDot = polygonNormal.dotProduct(upVector);
      if (normalDot > 0.0)
        reverse = true;
    }
    for (let i = 0; (i + 1) < points.length; i++) {
      if (reverse) {
        const toAdd = ClipPlane.createEdgeAndUpVector(points[i + 1], points[i], upVector, tiltAngle);
        if (toAdd) {   // Clipplane creation could result in undefined
          result.addPlaneToConvexSet(toAdd);
        } else {
          return undefined;
        }
      } else {
        const toAdd = ClipPlane.createEdgeAndUpVector(points[i], points[i + 1], upVector, tiltAngle);
        if (toAdd) {   // Clipplane creation could result in undefined
          result.addPlaneToConvexSet(toAdd);
        } else {
          return undefined;
        }
      }
    }
    return result;
  }

  public addPlaneToConvexSet(plane: ClipPlane | undefined) {
    if (plane)
      this._planes.push(plane);
  }

  public clipPointsOnOrInside(points: Point3d[], inOrOn: Point3d[], out: Point3d[]) {
    inOrOn.length = 0;
    out.length = 0;
    for (const xyz of points) {
      if (this.isPointOnOrInside(xyz, 0.0)) {
        inOrOn.push(xyz);
      } else {
        out.push(xyz);
      }
    }
  }

  public polygonClip(input: Point3d[], output: Point3d[], work: Point3d[]) {
    output.length = 0;
    // Copy input array
    for (const i of input)
      output.push(i);

    for (const plane of this._planes) {
      if (output.length === 0)
        break;
      plane.convexPolygonClipInPlace(output, work);
    }
  }
  /**
   * * Define new planes in this ConvexClipPlaneSet so it clips to the inside of a polygon.
   * * always create planes for the swept edges of the polygon
   * * optionally (with nonzero sideSelect) create a cap plane using the polygon normal.
   * @param points Points of a bounding polygon
   * @param sweepDirection direction to sweep.
   * @param sideSelect 0 to have no cap polygon, 1 if the sweep vector side is in, -1 if sweep vector side is out.
   */
  public reloadSweptPolygon(points: Point3d[], sweepDirection: Vector3d, sideSelect: number): number {
    this._planes.length = 0;
    const n = points.length;
    if (n <= 2)
      return 0;

    const planeNormal: Vector3d = PolygonOps.areaNormal(points);
    const isCCW = sweepDirection.dotProduct(planeNormal) > 0.0;

    const delta = isCCW ? 1 : n - 1;
    for (let i = 0; i < n; i++) {
      const i1 = (i + delta) % n;
      const xyz0: Point3d = points[i];
      const xyz1: Point3d = points[i1];
      if (xyz0.isAlmostEqual(xyz1))
        continue;
      const edgeVector: Vector3d = Vector3d.createStartEnd(xyz0, xyz1);
      const inwardNormal: Vector3d = Vector3d.createCrossProduct(sweepDirection.x, sweepDirection.y, sweepDirection.z,
        edgeVector.x, edgeVector.y, edgeVector.z);
      const inwardNormalNormalized = inwardNormal.normalize();
      let distance;
      if (inwardNormalNormalized) { // Should never fail... simply a check due to the format of the normalize function return
        distance = inwardNormalNormalized.dotProduct(xyz0);
        const clipToAdd = ClipPlane.createNormalAndDistance(inwardNormalNormalized, distance, false, false);
        if (clipToAdd) { this._planes.push(clipToAdd); }  // Clipplane creation could result in undefined
      }
    }
    if (sideSelect !== 0.0) {
      let planeNormalNormalized = planeNormal.normalize();
      if (planeNormalNormalized) { // Again.. should never fail
        const a = sweepDirection.dotProduct(planeNormalNormalized) * sideSelect;
        if (a < 0.0)
          planeNormalNormalized = planeNormalNormalized.negate();
        const xyz0: Point3d = points[0];
        const distance = planeNormalNormalized.dotProduct(xyz0);
        const clipToAdd = ClipPlane.createNormalAndDistance(planeNormalNormalized, distance, false, false);
        if (clipToAdd) { this._planes.push(clipToAdd); }  // Clipplane creation could result in undefined
      }
    }
    return isCCW ? 1 : -1;
  }

  /**
   * Returns range if result does not cover a space of infinity, otherwise undefined.
   * Note: If given a range for output, overwrites it, rather than extending it.
   */
  public getRangeOfAlignedPlanes(transform?: Transform, result?: Range3d): Range3d | undefined {
    const idMatrix: RotMatrix = RotMatrix.createIdentity();
    const bigRange: Range3d = Range3d.createXYZXYZ(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);

    const range = bigRange.clone(result);
    for (const clipPlane of this._planes) {
      if (transform)
        clipPlane.transformInPlace(transform);

      // Array of 1-d ranges that will be pieced back together into a Range3d after making adjustments
      const rangePieces: Range1d[] = [
        Range1d.createXX(range.low.x, range.high.x),
        Range1d.createXX(range.low.y, range.high.y),
        Range1d.createXX(range.low.z, range.high.z)];

      for (let i = 0; i < 3; i++) {
        // Set values of minP and maxP based on i (we are compensating for pointer arithmetic in native code)
        let minP;
        let maxP;
        minP = rangePieces[i].low;
        maxP = rangePieces[i].high;

        const direction: Vector3d = idMatrix.getColumn(i);
        if (clipPlane.inwardNormalRef.isParallelTo(direction, true)) {
          if (clipPlane.inwardNormalRef.dotProduct(direction) > 0.0) {
            if (clipPlane.distance > minP)
              rangePieces[i].low = clipPlane.distance;
          } else {
            if (-clipPlane.distance < maxP)
              rangePieces[i].high = - clipPlane.distance;
          }
        }
      }
      // Reassign to Range3d
      range.low.x = rangePieces[0].low;
      range.high.x = rangePieces[0].high;
      range.low.y = rangePieces[1].low;
      range.high.y = rangePieces[1].high;
      range.low.z = rangePieces[2].low;
      range.high.z = rangePieces[2].high;
    }
    if (range.isAlmostEqual(bigRange))
      return undefined;
    else
      return range;
  }

  public setInvisible(invisible: boolean) {
    for (const plane of this._planes) {
      plane.setInvisible(invisible);
    }
  }

  public addZClipPlanes(invisible: boolean, zLow?: number, zHigh?: number) {
    if (zLow !== undefined)
      this._planes.push(ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, 1), zLow, invisible)!);
    if (zHigh !== undefined)
      this._planes.push(ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, -1), -zHigh, invisible)!);
  }

  /*
    #define CheckAreaXY_not
    // EDL Dec 7 2016.
    // superficially bad area split observed when a vertical facet (edge on from above) is split.
    // a1=-2.9864408788819741e-008
    // a2=0
    // this is artificially near zero.
    #ifdef CheckAreaXY
    double Check(double a0, double a1)
    {
    double dx = fabs (a1 - a0);
    bool sameArea = DoubleOps::AlmostEqual (a0, a1);
    BeAssert (sameArea);
    return dx;
    }
    #endif
  */

  // FUNCTIONS SKIPPED DUE TO BSPLINES, VU, OR NON-USAGE IN NATIVE CODE----------------------------------------------------------------

  // Uses bsplines... skipping for now:
  // public convexAppendIntervalsFromBspline();

  // Uses pushing and clearing from/to a cache and added functionality for arrays. . . skipping for now
  // public convexPolygonClipInsideOutside(input: Point3d[], inside: Point3d[], outside: Point3d[], work1: Point3d[], work2: Point3d[],
  // clearOutside: boolean, distanceTolerance: number)
}

/**
 * A collection of ConvexClipPlaneSets.
 * * A point is "in" the clip plane set if it is "in" one or more of  the ConvexClipPlaneSet
 * * Hence the boolean logic is that the ClipPlaneSet is a UNION of its constituents.
 */
export class ClipPlaneSet implements ClipperMethods {
  private _convexSets: ConvexClipPlaneSet[];

  public get convexSets() { return this._convexSets; }

  private constructor() {
    this._convexSets = [];
  }
  public toJSON(): any {
    const val: any = [];
    for (const convex of this._convexSets) {
      val.push(convex.toJSON());
    }
    return val;
  }

  public static fromJSON(json: any, result?: ClipPlaneSet): ClipPlaneSet {
    result = result ? result : new ClipPlaneSet();
    result._convexSets.length = 0;
    if (!Array.isArray(json))
      return result;
    for (const thisJson of json) {
      result._convexSets.push(ConvexClipPlaneSet.fromJSON(thisJson));
    }
    return result;
  }

  public static createEmpty(result?: ClipPlaneSet): ClipPlaneSet {
    if (result) {
      result._convexSets.length = 0;
      return result;
    }
    return new ClipPlaneSet();
  }
  /**
   * @returns Return true if all member convex sets are almostEqual to corresponding members of other.  This includes identical order in array.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: ClipPlaneSet): boolean {
    if (this._convexSets.length !== other._convexSets.length)
      return false;
    for (let i = 0; i < this._convexSets.length; i++)
      if (!this._convexSets[i].isAlmostEqual(other._convexSets[i]))
        return false;
    return true;
  }
  public static createConvexSets(convexSets: ConvexClipPlaneSet[], result?: ClipPlaneSet): ClipPlaneSet {
    result = result ? result : new ClipPlaneSet();
    for (const set of convexSets)
      result._convexSets.push(set);
    return result;
  }

  public clone(result?: ClipPlaneSet): ClipPlaneSet {
    result = result ? result : new ClipPlaneSet();
    result._convexSets.length = 0;
    for (const convexSet of this._convexSets)
      result._convexSets.push(convexSet.clone());
    return result;
  }

  public addConvexSet(toAdd: ConvexClipPlaneSet) {
    this._convexSets.push(toAdd);
  }

  public testRayIntersect(point: Point3d, direction: Vector3d): boolean {
    const tNear = new Float64Array(1);
    for (const planeSet of this._convexSets) {
      if (ConvexClipPlaneSet.testRayIntersections(tNear, point, direction, planeSet))
        return true;
    }
    return false;
  }

  public getRayIntersection(point: Point3d, direction: Vector3d): number | undefined {
    let nearest = -ConvexClipPlaneSet.hugeVal;
    for (const planeSet of this._convexSets) {
      if (planeSet.isPointInside(point)) {
        return 0.0;
      } else {
        const tNear = new Float64Array(1);
        if (ConvexClipPlaneSet.testRayIntersections(tNear, point, direction, planeSet) && tNear[0] > nearest) {
          nearest = tNear[0];
        }
      }
    }
    if (nearest > - ConvexClipPlaneSet.hugeVal)
      return nearest;
    else
      return undefined;
  }

  public isPointInside(point: Point3d): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointInside(point)) {
        return true;
      }
    }
    return false;
  }

  public isPointOnOrInside(point: Point3d, tolerance: number): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointOnOrInside(point, tolerance))
        return true;
    }
    return false;
  }

  public isSphereInside(point: Point3d, radius: number) {
    for (const convexSet of this._convexSets) {
      if (convexSet.isSphereInside(point, radius))
        return true;
    }
    return false;
  }

  /** test if any part of a line segment is within the volume */
  public isAnyPointInOrOnFromSegment(segment: LineSegment3d): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.announceClippedSegmentIntervals(0.0, 1.0, segment.point0Ref, segment.point1Ref))
        return true;
    }
    return false;
  }

  // Intervals must be Segment1d array, as there may be multiple intervals along segment that pass through set regions,
  // and so splitting the intervals into segments aids in better organization
  /** Returns the fractions of the segment that pass through the set region, as 1 dimensional pieces */
  public appendIntervalsFromSegment(segment: LineSegment3d, intervals: Segment1d[]) {
    for (const convexSet of this._convexSets) {
      convexSet.announceClippedSegmentIntervals(0.0, 1.0, segment.point0Ref, segment.point1Ref,
        (fraction0: number, fraction1: number) =>
          intervals.push(Segment1d.create(fraction0, fraction1)));
    }
  }

  public transformInPlace(transform: Transform) {
    for (const convexSet of this._convexSets) {
      convexSet.transformInPlace(transform);
    }
  }

  /** Returns 1, 2, or 3 based on whether point is strongly inside, ambiguous, or strongly outside respectively */
  public classifyPointContainment(points: Point3d[], onIsOutside: boolean): number {
    for (const convexSet of this._convexSets) {
      const thisStatus = convexSet.classifyPointContainment(points, onIsOutside);
      if (thisStatus !== ClipPlaneContainment.StronglyOutside)
        return thisStatus;
    }
    return ClipPlaneContainment.StronglyOutside;
  }
  /**
   * * announce clipSegment() for each convexSet in this ClipPlaneSet.
   * * all clipPlaneSets are inspected
   * * announced intervals are for each individual clipPlaneSet -- adjacent intervals are not consolidated.
   * @param f0 active interval start.
   * @param f1 active interval end
   * @param pointA line segment start
   * @param pointB line segment end
   * @param announce function to announce interval.
   * @returns Return true if any announcements are made.
   */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: (fraction0: number, fraction1: number) => void): boolean {
    let numAnnounce = 0;
    for (const convexSet of this._convexSets) {
      if (convexSet.announceClippedSegmentIntervals(f0, f1, pointA, pointB, announce))
        numAnnounce++;
    }
    return numAnnounce > 0;
  }

  private static sClipArcFractionArray = new GrowableFloat64Array();
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = ClipPlaneSet.sClipArcFractionArray;
    breaks.clear();
    for (const convexSet of this._convexSets) {
      for (const clipPlane of convexSet.planes) {
        clipPlane.appendIntersectionRadians(arc, breaks);
      }
    }
    arc.sweep.radiansArraytoPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }

  /**
   * Returns range if result does not cover a space of infinity, otherwise undefined.
   * Note: If given a range for output, overwrites it, rather than extending it.
   */
  public getRangeOfAlignedPlanes(transform?: Transform, result?: Range3d): Range3d | undefined {
    const range = Range3d.createNull(result);

    for (const convexSet of this._convexSets) {
      const thisRange = Range3d.createNull();

      if (convexSet.getRangeOfAlignedPlanes(transform, thisRange))
        range.extendRange(thisRange);
    }
    if (range.isNull())
      return undefined;
    else
      return range;
  }

  public multiplyPlanesByMatrix(matrix: Matrix4d) {
    for (const convexSet of this._convexSets) {
      convexSet.multiplyPlanesByMatrix(matrix);
    }
  }

  public setInvisible(invisible: boolean) {
    for (const convexSet of this._convexSets) {
      convexSet.setInvisible(invisible);
    }
  }

  public addOutsideZClipSets(invisible: boolean, zLow?: number, zHigh?: number) {
    if (zLow) {
      const convexSet = ConvexClipPlaneSet.createEmpty();
      convexSet.addZClipPlanes(invisible, zLow);
      this._convexSets.push(convexSet);
    }
    if (zHigh) {
      const convexSet = ConvexClipPlaneSet.createEmpty();
      convexSet.addZClipPlanes(invisible, undefined, zHigh);
      this._convexSets.push(convexSet);
    }
  }

  /* FUNCTIONS SKIPPED DUE TO BSPLINES, VU, OR NON-USAGE IN NATIVE CODE----------------------------------------------------------------

  Involves vu: skipping for now...
    public fromSweptPolygon(points: Point3d[], directions: Vector3d[]): ClipPlaneSet;
    public parseConcavePolygonPlanes(...)

  Uses bsplines... skipping for now:
    public appendIntervalsClipPlaneSetFromCurve();

  Uses bsplines... skipping for now:
    public isAnyPointInOrOnFrom();

  Skipped fromSweptPolygon(...), which is overloaded function from first, due to presence of vu
    public fromSweptPolygon(points: Point3d[], directions: Vector3d[], shapes: Point3d[])
  */
}
