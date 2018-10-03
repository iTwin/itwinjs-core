/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { GrowableFloat64Array } from "../geometry3d/GrowableArray";
import { AnalyticRoots } from "../numerics/Polynomials";
import { Arc3d } from "../curve/Arc3d";
import { Clipper, ClipUtilities } from "./ClipUtils";
import { AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";

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
