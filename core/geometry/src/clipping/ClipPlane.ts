/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Geometry, AxisOrder } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { AnalyticRoots } from "../numerics/Polynomials";
import { Arc3d } from "../curve/Arc3d";
import { Clipper, ClipUtilities } from "./ClipUtils";
import { AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";

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
 * @public
 */
export class ClipPlane implements Clipper {
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
  private safeSetXYZDistance(nx: number, ny: number, nz: number, d: number) {
    this._inwardNormal.set(nx, ny, nz);
    this._distanceFromOrigin = d;
  }
  /**
   * Return true if all members are almostEqual to corresponding members of other.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: ClipPlane): boolean {
    return Geometry.isSameCoordinate(this._distanceFromOrigin, other._distanceFromOrigin)
      && this._inwardNormal.isAlmostEqual(other._inwardNormal)
      && this._interior === other._interior
      && this._invisible === other._invisible;
  }
  /** return a cloned plane */
  public clone(): ClipPlane {
    const result = new ClipPlane(this._inwardNormal.clone(), this._distanceFromOrigin, this._invisible, this._interior);
    return result;
  }
  /** return Return a cloned plane with coordinate data negated. */
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

  /**
   * Return the stored distanceFromOrigin property.
   */
  public get distance() { return this._distanceFromOrigin; }
  /**
   * Return the stored inward normal property.
   */
  public get inwardNormalRef(): Vector3d { return this._inwardNormal; }
  /**
   * Return the "interior" property bit
   */
  public get interior() { return this._interior; }
  /**
   * Return the "invisible" property bit.
   */
  public get invisible() { return this._invisible; }

  /**
   * Create a plane defined by two points, an up vector, and a tilt angle relative to the up vector.
   * @param point0 start point of the edge
   * @param point1 end point of the edge
   * @param upVector vector perpendicular to the plane
   * @param tiltAngle angle to tilt the plane around the edge in the direction of the up vector.
   * @param result optional preallocated plane
   */
  public static createEdgeAndUpVector(point0: Point3d, point1: Point3d, upVector: Vector3d, tiltAngle: Angle, result?: ClipPlane): ClipPlane | undefined {
    const edgeVector = Vector3d.createFrom(point1.minus(point0));
    let normal = (upVector.crossProduct(edgeVector)).normalize();

    if (normal) {
      if (!tiltAngle.isAlmostZero) {
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
  /**
   * Create a plane perpendicular to the edge between the xy parts of point0 and point1
   */
  public static createEdgeXY(point0: Point3d, point1: Point3d, result?: ClipPlane): ClipPlane | undefined {
    const normal = Vector3d.create(point0.y - point1.y, point1.x - point0.x);
    if (normal.normalizeInPlace())
      return ClipPlane.createNormalAndPoint(normal, point0, false, false, result);
    return undefined;
  }
  /**
   * Return the Plane3d form of the plane.
   * * The plane origin is the point `distance * inwardNormal`
   * * The plane normal is the inward normal of the ClipPlane.
   */
  public getPlane3d(): Plane3dByOriginAndUnitNormal {
    const d = this._distanceFromOrigin;
    // Normal should be normalized, will not return undefined
    return Plane3dByOriginAndUnitNormal.create(Point3d.create(this._inwardNormal.x * d, this._inwardNormal.y * d, this._inwardNormal.z * d), this._inwardNormal)!;
  }

  /**
   * Return the Point4d d form of the plane.
   * * The homogeneous xyz are the inward normal xyz.
   * * The homogeneous weight is the negated ClipPlane distance.
   */
  public getPlane4d(): Point4d {
    return Point4d.create(this._inwardNormal.x, this._inwardNormal.y, this._inwardNormal.z, - this._distanceFromOrigin);
  }
  /**
   * Set the plane from DPoint4d style plane.
   * * The saved plane has its direction normalized.
   * * This preserves the plane itself as a zero set but make plane evaluations act as true distances (even if the plane coefficients are scaled otherwise)
   * @param plane
   */
  public setPlane4d(plane: Point4d) {
    const a = Math.sqrt(plane.x * plane.x + plane.y * plane.y + plane.z * plane.z);
    const r = a === 0.0 ? 1.0 : 1.0 / a;
    this._inwardNormal.x = r * plane.x;
    this._inwardNormal.y = r * plane.y;
    this._inwardNormal.z = r * plane.z;
    this._distanceFromOrigin = -r * plane.w;
  }

  /**
   * Evaluate the distance from the plane to a point in space, i.e. (dot product with inward normal) minus distance
   * @param point space point to test
   */
  public evaluatePoint(point: Point3d): number {
    return point.x * this._inwardNormal.x + point.y * this._inwardNormal.y + point.z * this._inwardNormal.z - this._distanceFromOrigin;
  }

  /** Return the dot product of the plane normal with the vector (NOT using the plane's distanceFromOrigin).
   */
  public dotProductVector(vector: Vector3d): number {
    return vector.x * this._inwardNormal.x + vector.y * this._inwardNormal.y + vector.z * this._inwardNormal.z;
  }
  /** Return the dot product of the plane normal with the point (treating the point xyz as a vector, and NOT using the plane's distanceFromOrigin).
   */
  public dotProductPlaneNormalPoint(point: Point3d): number {
    return point.x * this._inwardNormal.x + point.y * this._inwardNormal.y + point.z * this._inwardNormal.z;
  }
  /**
   * Return true if spacePoint is inside or on the plane, with tolerance applied to "on".
   * @param spacePoint point to test.
   * @param tolerance tolerance for considering "near plane" to be "on plane"
   */
  public isPointOnOrInside(spacePoint: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    let value = this.evaluatePoint(spacePoint);
    if (tolerance) { value += tolerance; }
    return value >= 0.0;
  }

  /**
   * Return true if spacePoint is strictly inside the halfspace, with tolerance applied to "on".
   * @param spacePoint point to test.
   * @param tolerance tolerance for considering "near plane" to be "on plane"
   */
  public isPointInside(point: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    let value = this.evaluatePoint(point);
    if (tolerance) { value -= tolerance; }
    return value > 0.0;
  }

  /**
   * Return true if spacePoint is strictly on the plane, within tolerance
   * @param spacePoint point to test.
   * @param tolerance tolerance for considering "near plane" to be "on plane"
   */
  public isPointOn(point: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    return Math.abs(this.evaluatePoint(point)) <= tolerance;
  }
  /**
   * Compute intersections of an (UNBOUNDED) arc with the plane.  Append them (as radians) to a growing array.
   * @param arc arc to test.  The angle limits of the arc are NOT considered.
   * @param intersectionRadians array to receive results
   */
  public appendIntersectionRadians(arc: Arc3d, intersectionRadians: GrowableFloat64Array) {
    const arcVectors = arc.toVectors();
    const alpha = this.evaluatePoint(arc.center);
    const beta = this.dotProductVector(arcVectors.vector0);
    const gamma = this.dotProductVector(arcVectors.vector90);
    AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, undefined, undefined, intersectionRadians);
  }

  private static _clipArcFractionArray = new GrowableFloat64Array();
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = ClipPlane._clipArcFractionArray;
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
    const matrix: Matrix3d = transform.matrix;
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

  public convexPolygonClipInPlace(xyz: Point3d[], work: Point3d[], tolerance: number = Geometry.smallMetricDistance) {
    work.length = 0;
    let numNegative = 0;
    ClipPlane.fractionTol = 1.0e-8;
    const b = -tolerance;
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
        if (a1 >= b)
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
  /**
   * Clip a polygon to the inside or outside of the plane.
   * * Results with 2 or fewer points are ignored.
   * * Other than ensuring capacity in the arrays, there are no object allocations during execution of this function.
   * @param xyz input points.
   * @param work work buffer
   * @param tolerance tolerance for "on plane" decision.
   */
  public clipConvexPolygonInPlace(xyz: GrowableXYZArray, work: GrowableXYZArray, inside: boolean = true, tolerance: number = Geometry.smallMetricDistance) {
    work.clear();
    const n = xyz.length;
    let numNegative = 0;
    ClipPlane.fractionTol = 1.0e-8;
    const b = -tolerance;
    const s = inside ? 1.0 : -1.0;
    const nx = s * this._inwardNormal.x;
    const ny = s * this._inwardNormal.y;
    const nz = s * this._inwardNormal.z;
    const d = s * this._distanceFromOrigin;
    if (xyz.length > 1) {
      let a1;
      let index0 = xyz.length - 1;
      let a0 = xyz.evaluateUncheckedIndexDotProductXYZ(index0, nx, ny, nz) - d;
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (let index1 = 0; index1 < n; a0 = a1, index0 = index1++) {
        a1 = xyz.evaluateUncheckedIndexDotProductXYZ(index1, nx, ny, nz) - d;
        if (a1 < 0)
          numNegative++;
        if (a0 * a1 < 0.0) {
          // simple crossing . . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - ClipPlane.fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
          } else {
            work.pushInterpolatedFromGrowableXYZArray(xyz, index0, f, index1);
          }
        }
        if (a1 >= b)
          work.pushFromGrowableXYZArray(xyz, index1);
        index0 = index1;
        a0 = a1;
      }
    }

    if (work.length <= 2) {
      xyz.clear();
    } else if (numNegative > 0) {
      xyz.clear();
      xyz.pushFromGrowableXYZArray(work);
    }
    work.clear();
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
  /**
   * Split a (convex) polygon into 2 parts.
   * @param xyz original polygon
   * @param xyzIn array to receive inside part
   * @param xyzOut array to receive outside part
   * @param altitudeRange min and max altitudes encountered.
   */
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
  /**
   * Multiply the ClipPlanes's DPoint4d by matrix.
   * @param matrix matrix to apply.
   * @param invert if true, use in verse of the matrix.
   * @param transpose if true, use the transpose of the matrix (or inverse, per invert parameter)
   * * Note that if matrixA is applied to all of space, the matrix to send to this method to get a corresponding effect on the plane is the inverse transpose of matrixA
   * * Callers that will apply the same matrix to many planes should pre-invert the matrix for efficiency.
   * * Both params default to true to get the full effect of transforming space.
   * @param matrix matrix to apply
   * @return false if unable to invert
   */
  public multiplyPlaneByMatrix4d(matrix: Matrix4d, invert: boolean = true, transpose: boolean = true): boolean {
    const plane: Point4d = this.getPlane4d();
    if (invert) {
      const inverse = matrix.createInverse();
      if (inverse)
        return this.multiplyPlaneByMatrix4d(inverse, false, transpose);
      return false;
    }
    if (transpose)
      matrix.multiplyTransposePoint4d(plane, plane);
    else
      matrix.multiplyPoint4d(plane, plane);
    this.setPlane4d(plane);
    return true;
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
  /*
   * Return a coordinate frame with
   * * origin at closest point to global origin
   * * z axis points in
   * * x and y are "in plane"
  */
  public getFrame(): Transform {
    const d = this._distanceFromOrigin;
    const origin = Point3d.create(this._inwardNormal.x * d, this._inwardNormal.y * d, this._inwardNormal.z * d);
    const matrix = Matrix3d.createRigidHeadsUp(this._inwardNormal, AxisOrder.ZXY);
    return Transform.createOriginAndMatrix(origin, matrix);

  }
  /**
   * Return the intersection of the plane with a range cube.
   * @param range
   * @param xyzOut intersection polygon.  This is convex.
   */
  public intersectRange(range: Range3d, addClosurePoint: boolean = false): GrowableXYZArray | undefined {
    if (range.isNull)
      return undefined;
    const corners = range.corners();
    const frameOnPlane = this.getFrame();
    frameOnPlane.multiplyInversePoint3dArrayInPlace(corners);
    const localRange = Range3d.createArray(corners);
    if (localRange.low.z * localRange.high.z > 0.0)
      return undefined;
    // oversized polygon on local z= 0
    const xyzOut = new GrowableXYZArray();
    xyzOut.pushXYZ(localRange.low.x, localRange.low.y, 0);
    xyzOut.pushXYZ(localRange.high.x, localRange.low.y, 0);
    xyzOut.pushXYZ(localRange.high.x, localRange.high.y, 0);
    xyzOut.pushXYZ(localRange.low.x, localRange.high.y, 0);
    xyzOut.multiplyTransformInPlace(frameOnPlane);
    ClipPlane.intersectRangeConvexPolygonInPlace(range, xyzOut);
    if (xyzOut.length === 0)
      return undefined;
    if (addClosurePoint)
      xyzOut.pushWrap(1);
    return xyzOut;
  }
  /**
   * Return the intersection of the plane with a range cube.
   * @param range
   * @param xyzOut intersection polygon.  This is convex.
   */
  public static intersectRangeConvexPolygonInPlace(range: Range3d, xyz: GrowableXYZArray) {
    if (range.isNull)
      return undefined;
    const work = new GrowableXYZArray();
    // clip the polygon to each plane of the cubic ...
    const clipper = ClipPlane.createNormalAndPointXYZXYZ(-1, 0, 0, range.high.x, range.high.y, range.high.z)!;
    clipper.clipConvexPolygonInPlace(xyz, work);
    if (xyz.length === 0)
      return undefined;
    clipper.safeSetXYZDistance(0, -1, 0, -range.high.y);
    clipper.clipConvexPolygonInPlace(xyz, work);

    if (xyz.length === 0)
      return undefined;
    clipper.safeSetXYZDistance(0, 0, -1, -range.high.z);
    clipper.clipConvexPolygonInPlace(xyz, work);

    if (xyz.length === 0)
      return undefined;
    clipper.safeSetXYZDistance(1, 0, 0, range.low.x);
    clipper.clipConvexPolygonInPlace(xyz, work);

    if (xyz.length === 0)
      return undefined;
    clipper.safeSetXYZDistance(0, 1, 0, range.low.y);
    clipper.clipConvexPolygonInPlace(xyz, work);

    if (xyz.length === 0)
      return undefined;
    clipper.safeSetXYZDistance(0, 0, 1, range.low.z);
    clipper.clipConvexPolygonInPlace(xyz, work);
    if (xyz.length === 0)
      return undefined;

    return xyz;
  }
}
