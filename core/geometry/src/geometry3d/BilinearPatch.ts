/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d } from "./Point3dVector3d";
import { Range3d } from "./Range";
import { Transform } from "./Transform";

import { UVSurface } from "./GeometryHandler";
import { Plane3dByOriginAndVectors } from "./Plane3dByOriginAndVectors";
import { Geometry } from "../Geometry";
/**
 * * A Bilinear patch is defined by its 4 corner points.
 * * the corner points do not have to be coplanar
 *
 * *    v direction (up)
 *      |
 *      |
 *      |
 *  point01---A1-----------point11
 *      |     |             |
 *      B0----X------------B1
 *      |     |             |
 *  point00--A0-----------point10 -----------> u direction
 *
 * * To evaluate aa point at (u,v), the following are equivalent:
 *   * interpolate with u to get both A0 and A1, viz
 *      * A0 = interpolate between point00 and point10 at fraction u
 *      * A1 = interpolate between point01 and point11 at fraction u
 *      * X = interpolate between A0 and A1 at fraction v
 *   * interpolate first with v to get B0 and B1, viz
 *      * B0 = interpolate between point00 and point01 at fraction v
 *      * B1 = interpolate between point10 and point11 at fraction v
 *      * X = interpolate between B0 and B1 at fraction u
 *   * sum all at once as
 *      * X = (1-u)* (1-v) *point00 + (1-u)*v * point01 + u * (1-v) *point10 + u* v * point11
 *
 */
export class BilinearPatch implements UVSurface {
  public point00: Point3d;
  public point10: Point3d;
  public point01: Point3d;
  public point11: Point3d;
  /**
   * Capture (not clone) corner points, in u direction at v=0, then in same direction at v=1
   * @param point00 Point at uv=0,0
   * @param point10 Point at uv=1,0
   * @param point10 Point at uv=0,1
   * @param point11 Point at uv=11
   */
  public constructor(point00: Point3d, point10: Point3d, point01: Point3d, point11: Point3d) {
    this.point00 = point00;
    this.point10 = point10;
    this.point01 = point01;
    this.point11 = point11;
  }
  /** clone (not capture) corners to create a new BilinearPatch
   * @param point00 Point at uv=0,0
   * @param point10 Point at uv=1,0
   * @param point10 Point at uv=0,1
   * @param point11 Point at uv=11
   */
  public static create(point00: Point3d, point10: Point3d, point01: Point3d, point11: Point3d) {
    return new BilinearPatch(point00.clone(), point10.clone(), point01.clone(), point11.clone());
  }

  /** create a patch with from xyz values of the 4 corners
   */
  public static createXYZ(x00: number, y00: number, z00: number,
    x10: number, y10: number, z10: number,
    x01: number, y01: number, z01: number,
    x11: number, y11: number, z11: number) {
    return new BilinearPatch(Point3d.create(x00, y00, z00),
      Point3d.create(x10, y10, z10),
      Point3d.create(x01, y01, z01),
      Point3d.create(x11, y11, z11));
  }

  /** return a clone with same coordinates */
  public clone(): BilinearPatch {
    return new BilinearPatch(
      this.point00.clone(),
      this.point10.clone(),
      this.point01.clone(),
      this.point11.clone());
  }
  /** test equality of the 4 points */
  public isAlmostEqual(other: BilinearPatch): boolean {
    return this.point00.isAlmostEqual(other.point00)
      && this.point10.isAlmostEqual(other.point10)
      && this.point01.isAlmostEqual(other.point01)
      && this.point11.isAlmostEqual(other.point11);
  }
  /** Apply the transform to each point */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyPoint3d(this.point00, this.point00);
    transform.multiplyPoint3d(this.point10, this.point10);
    transform.multiplyPoint3d(this.point01, this.point01);
    transform.multiplyPoint3d(this.point11, this.point11);
    return true;
  }
  /**
   * return a cloned and transformed patch.
   * @param transform
   */
  public cloneTransformed(transform: Transform): BilinearPatch | undefined {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Extend a range by the range of the(optionally transformed) patch
   */
  public extendRange(range: Range3d, transform?: Transform) {
    if (transform) {
      range.extendTransformedPoint(transform, this.point00);
      range.extendTransformedPoint(transform, this.point10);
      range.extendTransformedPoint(transform, this.point01);
      range.extendTransformedPoint(transform, this.point11);
    } else {
      range.extendPoint(this.point00);
      range.extendPoint(this.point10);
      range.extendPoint(this.point01);
      range.extendPoint(this.point11);
    }
  }
  /** Evaluate as a uv surface
   * @param u fractional position in minor (phi)
   * @param v fractional position on major (theta) arc
   */
  public uvFractionToPoint(u: number, v: number, result?: Point3d): Point3d {
    const f00 = (1.0 - u) * (1.0 - v);
    const f10 = u * (1.0 - v);
    const f01 = (1.0 - u) * v;
    const f11 = u * v;
    return Point3d.create(
      f00 * this.point00.x + f10 * this.point10.x + f01 * this.point01.x + f11 * this.point11.x,
      f00 * this.point00.y + f10 * this.point10.y + f01 * this.point01.y + f11 * this.point11.y,
      f00 * this.point00.z + f10 * this.point10.z + f01 * this.point01.z + f11 * this.point11.z,
      result);
  }
  /** Evaluate as a uv surface, returning point and two derivative vectors.
   * @param u fractional position
   * @param v fractional position
   */
  public uvFractionToPointAndTangents(u: number, v: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const u0 = 1.0 - u;
    const v0 = 1.0 - v;
    const f00 = u0 * v0;
    const f10 = u * v0;
    const f01 = u0 * v;
    const f11 = u * v;
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      f00 * this.point00.x + f10 * this.point10.x + f01 * this.point01.x + f11 * this.point11.x,
      f00 * this.point00.y + f10 * this.point10.y + f01 * this.point01.y + f11 * this.point11.y,
      f00 * this.point00.z + f10 * this.point10.z + f01 * this.point01.z + f11 * this.point11.z,
      // u derivative ..
      v0 * (this.point10.x - this.point00.x) + v * (this.point11.x - this.point01.x),
      v0 * (this.point10.y - this.point00.y) + v * (this.point11.y - this.point01.y),
      v0 * (this.point10.z - this.point00.z) + v * (this.point11.z - this.point01.z),
      // v derivative ..
      u0 * (this.point01.x - this.point00.x) + u * (this.point11.x - this.point10.x),
      u0 * (this.point01.y - this.point00.y) + u * (this.point11.y - this.point10.y),
      u0 * (this.point01.z - this.point00.z) + u * (this.point11.z - this.point10.z),
      result);
  }
  /**
   * @returns the larger of the u-direction edge lengths at v=0 and v=1
   */
  public maxUEdgeLength(): number {
    return Geometry.maxXY(this.point00.distance(this.point10), this.point01.distance(this.point11));
  }
  /**
   * @returns the larger of the v-direction edge lengths at u=0 and u=1
   */
  public maxVEdgeLength(): number {
    return Geometry.maxXY(this.point00.distance(this.point01), this.point10.distance(this.point11));
  }
}
