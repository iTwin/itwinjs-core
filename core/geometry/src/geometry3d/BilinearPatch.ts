/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { CurveAndSurfaceLocationDetail, UVSurfaceLocationDetail } from "../bspline/SurfaceLocationDetail";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { Geometry } from "../Geometry";
import { SmallSystem } from "../numerics/SmallSystem";
import { UVSurface } from "./GeometryHandler";
import { Plane3dByOriginAndVectors } from "./Plane3dByOriginAndVectors";
import { Point3d } from "./Point3dVector3d";
import { Range3d } from "./Range";
import { Ray3d } from "./Ray3d";
import { Transform } from "./Transform";

// cspell:word uparrow, rightarrow

/**
 * A bilinear patch is a surface defined by its 4 corner points.
 * * The corner points do not have to be coplanar, but if they are, the quadrilateral should be convex to avoid a self-intersecting surface.
 * ```
 * equation
 * \begin{matrix}
 * v\text{-direction}\\
 * \uparrow\\
 * \text{point01} &\cdots &\text{A1} &\cdots &\text{point11}\\
 * \vdots &&\vdots &&\vdots\\
 * \text{B0} &\cdots &\text{X} &\cdots &\text{B1}\\
 * \vdots &&\vdots &&\vdots\\
 * \text{point00} &\cdots &\text{A0} &\cdots &\text{point10} &\rightarrow~u\text{-direction}
 * \end{matrix}
 * ```
 * * To evaluate the point at (u,v), the following are equivalent:
 *   * interpolate first with u then with v:
 *      * A0 = interpolate between point00 and point10 at fraction u
 *      * A1 = interpolate between point01 and point11 at fraction u
 *      * X = interpolate between A0 and A1 at fraction v
 *   * interpolate first with v then with u:
 *      * B0 = interpolate between point00 and point01 at fraction v
 *      * B1 = interpolate between point10 and point11 at fraction v
 *      * X = interpolate between B0 and B1 at fraction u
 *   * sum all at once:
 *      * X = (1-u)(1-v)point00 + (1-u)(v)point01 + (u)(1-v)point10 + (u)(v)point11
 * @public
 */
export class BilinearPatch implements UVSurface {
  /** corner at parametric coordinate (0,0) */
  public point00: Point3d;
  /** corner at parametric coordinate (1,0) */
  public point10: Point3d;
  /** corner at parametric coordinate (0,1) */
  public point01: Point3d;
  /** corner at parametric coordinate (1,1) */
  public point11: Point3d;
  /**
   * Capture (not clone) corners to create a new BilinearPatch.
   * @param point00 Point at uv=0,0
   * @param point10 Point at uv=1,0
   * @param point10 Point at uv=0,1
   * @param point11 Point at uv=1,1
   */
  public constructor(point00: Point3d, point10: Point3d, point01: Point3d, point11: Point3d) {
    this.point00 = point00;
    this.point10 = point10;
    this.point01 = point01;
    this.point11 = point11;
  }
  /**
   * Clone (not capture) corners to create a new BilinearPatch.
   * @param point00 Point at uv=0,0
   * @param point10 Point at uv=1,0
   * @param point10 Point at uv=0,1
   * @param point11 Point at uv=1,1
   */
  public static create(point00: Point3d, point10: Point3d, point01: Point3d, point11: Point3d) {
    return new BilinearPatch(point00.clone(), point10.clone(), point01.clone(), point11.clone());
  }
  /** Create a patch from xyz values of the 4 corners. */
  public static createXYZ(
    x00: number, y00: number, z00: number,
    x10: number, y10: number, z10: number,
    x01: number, y01: number, z01: number,
    x11: number, y11: number, z11: number,
  ) {
    return new BilinearPatch(
      Point3d.create(x00, y00, z00),
      Point3d.create(x10, y10, z10),
      Point3d.create(x01, y01, z01),
      Point3d.create(x11, y11, z11),
    );
  }
  /** Return a cloned patch. */
  public clone(): BilinearPatch {
    return new BilinearPatch(
      this.point00.clone(),
      this.point10.clone(),
      this.point01.clone(),
      this.point11.clone(),
    );
  }
  /** Test equality of the 4 points. */
  public isAlmostEqual(other: BilinearPatch): boolean {
    return this.point00.isAlmostEqual(other.point00)
      && this.point10.isAlmostEqual(other.point10)
      && this.point01.isAlmostEqual(other.point01)
      && this.point11.isAlmostEqual(other.point11);
  }
  /** Apply the transform to each point. */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyPoint3d(this.point00, this.point00);
    transform.multiplyPoint3d(this.point10, this.point10);
    transform.multiplyPoint3d(this.point01, this.point01);
    transform.multiplyPoint3d(this.point11, this.point11);
    return true;
  }
  /** Return a cloned and transformed patch. */
  public cloneTransformed(transform: Transform): BilinearPatch | undefined {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Extend a range by the range of the (optionally transformed) patch. */
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
  /**
   * Convert fractional u and v coordinates to surface point
   * @param u fractional coordinate in u direction
   * @param v fractional coordinate in v direction
   * @param result optional pre-allocated point
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
      result,
    );
  }
  /** Evaluate as a uv surface, returning point and two derivative vectors.
   * @param u fractional coordinate in u direction
   * @param v fractional coordinate in v direction
   * @param result optional pre-allocated carrier for point and vectors
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
      result,
    );
  }
  /** If data[iB][pivotColumn] is larger in absolute value than data[iA][pivotColumn], then swap rows iA and iB. */
  private static conditionalPivot(pivotColumn: number, data: Float64Array[], iA: number, iB: number) {
    if (Math.abs(data[iB][pivotColumn]) > Math.abs(data[iA][pivotColumn])) {
      const q = data[iA];
      data[iA] = data[iB];
      data[iB] = q;
    }
  }
  /**
   * Compute the points of intersection with a ray.
   * @param ray ray in space
   * @returns 1 or 2 points if there are intersections, undefined if no intersections
   */
  public intersectRay(ray: Ray3d): CurveAndSurfaceLocationDetail[] | undefined {
    const vectorU = this.point10.minus(this.point00);
    const vectorV = this.point01.minus(this.point00);
    const vectorW = this.point11.minus(this.point10);
    vectorW.subtractInPlace(vectorV);
    // We seek t, u, v such that:
    //    `ray.origin + t*ray.direction = point00 + u*vectorU + v*vectorV + u*v*vectorW`
    // For typical direction as x, the scalar equation with coefficient order for arrays is:
    //    `0 = -t*ray.direction.x + (point00.x - ray.origin.x) + u*vectorU.x + v*vectorV.x + u*v*vectorW.x`
    // and this particular equation is invoked to compute t when u and v are known.
    const coffs = [
      new Float64Array([-ray.direction.x, this.point00.x - ray.origin.x, vectorU.x, vectorV.x, vectorW.x]),
      new Float64Array([-ray.direction.y, this.point00.y - ray.origin.y, vectorU.y, vectorV.y, vectorW.y]),
      new Float64Array([-ray.direction.z, this.point00.z - ray.origin.z, vectorU.z, vectorV.z, vectorW.z]),
    ];
    // swap rows so that the equation with largest ray.direction coefficient is first.
    BilinearPatch.conditionalPivot(0, coffs, 0, 1);
    BilinearPatch.conditionalPivot(0, coffs, 0, 2);
    SmallSystem.eliminateFromPivot(coffs[0], 0, coffs[1], -1.0);
    SmallSystem.eliminateFromPivot(coffs[0], 0, coffs[2], -1.0);
    const uvArray = SmallSystem.solveBilinearPair(
      coffs[1][1], coffs[1][2], coffs[1][3], coffs[1][4],
      coffs[2][1], coffs[2][2], coffs[2][3], coffs[2][4],
    );
    if (uvArray) {
      const result: CurveAndSurfaceLocationDetail[] = [];
      for (const uv of uvArray) {
        const t = -(coffs[0][1] + coffs[0][2] * uv.x + (coffs[0][3] + coffs[0][4] * uv.x) * uv.y) / coffs[0][0];
        const point = ray.fractionToPoint(t);
        result.push(new CurveAndSurfaceLocationDetail(
          CurveLocationDetail.createRayFractionPoint(ray, t, point),
          UVSurfaceLocationDetail.createSurfaceUVPoint(this, uv, point)),
        );
      }
      return result;
    }
    return undefined;
  }
  /** Returns the larger of the u-direction edge lengths at v=0 and v=1. */
  public maxUEdgeLength(): number {
    return Geometry.maxXY(this.point00.distance(this.point10), this.point01.distance(this.point11));
  }
  /** Returns the larger of the v-direction edge lengths at u=0 and u=1. */
  public maxVEdgeLength(): number {
    return Geometry.maxXY(this.point00.distance(this.point01), this.point10.distance(this.point11));
  }
}
