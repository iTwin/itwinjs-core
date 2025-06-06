/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { WritableXAndY, XAndY } from "../geometry3d/XYZProps";
import { Point4d } from "../geometry4d/Point4d";
import { BilinearPolynomial } from "./Polynomials";

// cspell:word XYUV

/**
 * static methods for commonly appearing sets of equations in 2 or 3 variables
 * @public
 */
export class SmallSystem {
  /**
   * Intersect two transverse 2D lines.
   * * If the lines are parallel and overlap, the returned intersection is of dubious use.
   * @param a0 start point of line A
   * @param aDir direction vector of line A
   * @param b0 start point of line B
   * @param bDir direction vector of line B
   * @returns intersection fractions, `x` along line A and `y` along line B; or `undefined` if no intersection.
   * @see [[lineSegmentXYUVOverlapUnbounded]], [[lineSegmentXYUVIntersectionUnbounded]]
   */
  public static lineXYUVTransverseIntersection(a0: XAndY, aDir: XAndY, b0: XAndY, bDir: XAndY): WritableXAndY | undefined {
    const cx = b0.x - a0.x;
    const cy = b0.y - a0.y;
    const aCrossB = Geometry.crossProductXYXY(aDir.x, aDir.y, bDir.x, bDir.y);
    const cCrossB = Geometry.crossProductXYXY(cx, cy, bDir.x, bDir.y);
    const cCrossA = Geometry.crossProductXYXY(cx, cy, aDir.x, aDir.y);
    const x = Geometry.conditionalDivideFraction(cCrossB, aCrossB);
    const y = Geometry.conditionalDivideFraction(cCrossA, aCrossB);
    if (x !== undefined && y !== undefined)
      return { x, y };
    return undefined;
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have a simple intersection.
   * Return the fractional (not xy) coordinates in result.x, result.y.
   * @param a0 start point of line A
   * @param a1 end point of line A
   * @param b0 start point of line B
   * @param b1 end point of line B
   * @param result vector to receive fractional coordinates of intersection: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static lineSegment2dXYTransverseIntersectionUnbounded(a0: Point2d, a1: Point2d, b0: Point2d, b1: Point2d, result: Vector2d): boolean {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;
    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;
    return this.lineSegmentXYUVTransverseIntersectionUnbounded(a0.x, a0.y, ux, uy, b0.x, b0.y, vx, vy, result);
  }

  /**
   * Return true if the lines have a simple intersection.
   * * Points (ax0,ay0) to (ax0+ux,ay0+uy) are at fractions 0 and 1 of line A.
   * * Points (bx0,by0) to (bx0+vx,by0+vy) are at fractions 0 and 1 of line B.
   * @param result vector to receive fractional coordinates of intersection: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static lineSegmentXYUVTransverseIntersectionUnbounded(ax0: number, ay0: number, ux: number, uy: number, bx0: number, by0: number, vx: number, vy: number, result: Vector2d): boolean {
    const transverse = this.lineXYUVTransverseIntersection({ x: ax0, y: ay0 }, { x: ux, y: uy } , { x: bx0, y: by0 }, { x: vx, y: vy });
    if (transverse) {
      result.set(transverse.x, transverse.y);
      return true;
    }
    result.set(0, 0);
    return false;
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have a simple intersection using only xy parts.
   * @param a0 start point of line A
   * @param a1 end point of line A
   * @param b0 start point of line B
   * @param b1 end point of line B
   * @param result vector to receive fractional coordinates of intersection: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static lineSegment3dXYTransverseIntersectionUnbounded(a0: Point3d, a1: Point3d, b0: Point3d, b1: Point3d, result: Vector2d): boolean {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;
    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;
    return this.lineSegmentXYUVTransverseIntersectionUnbounded(a0.x, a0.y, ux, uy, b0.x, b0.y, vx, vy, result);
  }

  /**
   * Intersect two overlapping unbounded 2D lines.
   * @param a0 start point of line A
   * @param aDir direction vector of line A; end point of line segment A is `a0 + aDir`
   * @param b0 start point of line B
   * @param bDir direction vector of line B; end point of line segment B is `b0 + bDir`
   * @param tol overlap distance tolerance
   * @returns `undefined` if the lines have a simple (transverse) intersection, or are parallel without overlap.
   * Otherwise, return the fractions at which each segment overlaps the other line:
   * * segment B maps to fractions in the range f0.x < f1.x on line A.
   * * segment A maps to fractions in the range f0.y < f1.y on line B.
   * @see [[lineXYUVTransverseIntersection]], [[lineSegmentXYUVIntersectionUnbounded]]
   */
  public static lineSegmentXYUVOverlapUnbounded(
    a0: XAndY, aDir: XAndY,
    b0: XAndY, bDir: XAndY,
    tol: number = Geometry.smallMetricDistance
  ): { f0: WritableXAndY, f1: WritableXAndY } | undefined {
    const tol2 = tol * tol;
    const projectToSegment = (s: XAndY, e0: XAndY, eDir: XAndY): { f: number, p: XAndY } => {
      const eDotE = Geometry.dotProductXYXY(eDir.x, eDir.y, eDir.x, eDir.y);
      const sDotE = Geometry.dotProductXYXY(s.x - e0.x, s.y - e0.y, eDir.x, eDir.y);
      const f = Geometry.safeDivideFraction(sDotE, eDotE, 0.0);
      return { f, p: { x: e0.x + f * eDir.x, y: e0.y + f * eDir.y } };
    };
    const a0OnB = projectToSegment(a0, b0, bDir);
    if (Geometry.distanceSquaredXYXY(a0.x, a0.y, a0OnB.p.x, a0OnB.p.y) > tol2)
      return undefined;
    const a1x = a0.x + aDir.x;
    const a1y = a0.y + aDir.y;
    const a1OnB = projectToSegment({ x: a1x, y: a1y }, b0, bDir);
    if (Geometry.distanceSquaredXYXY(a1x, a1y, a1OnB.p.x, a1OnB.p.y) > tol2)
      return undefined;
    const b0OnA = projectToSegment(b0, a0, aDir);
    if (Geometry.distanceSquaredXYXY(b0.x, b0.y, b0OnA.p.x, b0OnA.p.y) > tol2)
      return undefined;
    const b1x = b0.x + bDir.x;
    const b1y = b0.y + bDir.y;
    const b1OnA = projectToSegment({ x: b1x, y: b1y }, a0, aDir);
    if (Geometry.distanceSquaredXYXY(b1x, b1y, b1OnA.p.x, b1OnA.p.y) > tol2)
      return undefined;
    if (b0OnA.f > b1OnA.f)
      [b0OnA.f, b1OnA.f] = [b1OnA.f, b0OnA.f];
    if (a0OnB.f > a1OnB.f)
      [a0OnB.f, a1OnB.f] = [a1OnB.f, a0OnB.f];
    return { f0: { x: b0OnA.f, y: a0OnB.f }, f1: { x: b1OnA.f, y: a1OnB.f } };
  }

  /**
   * Intersect two transverse or overlapping unbounded 2D line segments.
   * @param a0 start point of line A
   * @param aDir direction vector of line A; end point of line segment A is `a0 + aDir`
   * @param b0 start point of line B
   * @param bDir direction vector of line B; end point of line segment B is `b0 + bDir`
   * @param tol overlap distance tolerance
   * @returns intersection fractions:
   * * If `f1` is undefined, the intersection occurs at fraction f0.x along line A and f0.y along line B.
   * * If `f1` is defined, the line segments are parallel and overlap:
   * segment B maps to fractions in the range f0.x < f1.x on line A;
   * segment A maps to fractions in the range f0.y < f1.y on line B.
   * * If `undefined`, the lines are parallel without overlap.
   */
  public static lineSegmentXYUVIntersectionUnbounded(
    a0: XAndY, aDir: XAndY,
    b0: XAndY, bDir: XAndY,
    tol: number = Geometry.smallMetricDistance
  ): { f0: WritableXAndY, f1?: WritableXAndY } | undefined {
    // Normal practice is to do the (quick, simple) transverse intersection first, but the transverse intersector's
    // notion of coincidence is based on the determinant ratios, which are hard to relate to physical tolerance.
    // So do the overlap first. This should do a quick exit in non-coincident case.
    const overlap = this.lineSegmentXYUVOverlapUnbounded(a0, aDir, b0, bDir, tol);
    if (overlap)
      return overlap;
    const transverse = this.lineXYUVTransverseIntersection(a0, aDir, b0, bDir);
    if (transverse)
      return { f0: transverse };
    return undefined;
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have a simple intersection using only xy parts of WEIGHTED 4D Points
   * @param hA0 homogeneous start point of line A
   * @param hA1 homogeneous end point of line A
   * @param hB0 homogeneous start point of line B
   * @param hB1 homogeneous end point of line B
   * @param result vector to receive fractional coordinates of intersection: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static lineSegment3dHXYTransverseIntersectionUnbounded(hA0: Point4d, hA1: Point4d, hB0: Point4d, hB1: Point4d, result?: Vector2d): Vector2d | undefined {
    // Considering only x,y,w parts....
    // Point Q along B is (in full homogeneous)  `(1-lambda) B0 + lambda 1`
    // PointQ is colinear with A0,A1 when the determinant det (A0,A1,Q) is zero.  (Each column takes xyw parts)
    const alpha0 = Geometry.tripleProduct(
      hA0.x, hA1.x, hB0.x,
      hA0.y, hA1.y, hB0.y,
      hA0.w, hA1.w, hB0.w);
    const alpha1 = Geometry.tripleProduct(
      hA0.x, hA1.x, hB1.x,
      hA0.y, hA1.y, hB1.y,
      hA0.w, hA1.w, hB1.w);
    const fractionB = Geometry.conditionalDivideFraction(-alpha0, alpha1 - alpha0);
    if (fractionB !== undefined) {
      const beta0 = Geometry.tripleProduct(
        hB0.x, hB1.x, hA0.x,
        hB0.y, hB1.y, hA0.y,
        hB0.w, hB1.w, hA0.w);
      const beta1 = Geometry.tripleProduct(
        hB0.x, hB1.x, hA1.x,
        hB0.y, hB1.y, hA1.y,
        hB0.w, hB1.w, hA1.w);
      const fractionA = Geometry.conditionalDivideFraction(-beta0, beta1 - beta0);
      if (fractionA !== undefined)
        return Vector2d.create(fractionA, fractionB, result);
    }
    return undefined;
  }

  /**
   * Return the line fraction at which the (homogeneous) line is closest to a space point as viewed in xy only.
   * @param hA0 homogeneous start point of the line
   * @param hA1 homogeneous end point of the line
   * @param spacePoint homogeneous point in space
   */
  public static lineSegment3dHXYClosestPointUnbounded(hA0: Point4d, hA1: Point4d, spacePoint: Point4d): number | undefined {
    // Considering only x,y,w parts.
    // weighted difference of (A1 w0 - A0 w1) is (cartesian) tangent vector along the line as viewed.
    // The perpendicular (pure vector) W = (-y,x) flip is the direction of projection.
    // Point Q along A is (in full homogeneous) `(1-lambda) A0 + lambda 1 A1`.
    // PointQ is colinear with spacePoint and and W when the xyw homogeneous determinant | Q W spacePoint | is zero.
    const tx = hA1.x * hA0.w - hA0.x * hA1.w;
    const ty = hA1.y * hA0.w - hA0.y * hA1.w;
    const det0 = Geometry.tripleProduct(
      hA0.x, -ty, spacePoint.x,
      hA0.y, tx, spacePoint.y,
      hA0.w, 0, spacePoint.w,
    );
    const det1 = Geometry.tripleProduct(
      hA1.x, -ty, spacePoint.x,
      hA1.y, tx, spacePoint.y,
      hA1.w, 0, spacePoint.w,
    );
    return Geometry.conditionalDivideFraction(-det0, det1 - det0);
  }

  /**
   * Return the line fraction at which the line is closest to a space point as viewed in xy only.
   * @param pointA0 start point
   * @param pointA1 end point
   * @param spacePoint point in space
   */
  public static lineSegment3dXYClosestPointUnbounded(pointA0: XAndY, pointA1: XAndY, spacePoint: XAndY): number | undefined {
    // Considering only x,y parts....
    const ux = pointA1.x - pointA0.x;
    const uy = pointA1.y - pointA0.y;
    const uu = ux * ux + uy * uy;
    const vx = spacePoint.x - pointA0.x;
    const vy = spacePoint.y - pointA0.y;
    const uv = ux * vx + uy * vy;
    return Geometry.conditionalDivideFraction(uv, uu);
  }

  /**
   * Return the line fraction at which the line is closest to a space point
   * @param pointA0 start point
   * @param pointA1 end point
   * @param spacePoint point in space
   */
  public static lineSegment3dClosestPointUnbounded(pointA0: Point3d, pointA1: Point3d, spacePoint: Point3d): number | undefined {
    const ux = pointA1.x - pointA0.x;
    const uy = pointA1.y - pointA0.y;
    const uz = pointA1.z - pointA0.z;
    const uu = ux * ux + uy * uy + uz * uz;
    const vx = spacePoint.x - pointA0.x;
    const vy = spacePoint.y - pointA0.y;
    const vz = spacePoint.z - pointA0.z;
    const uv = ux * vx + uy * vy + uz * vz;
    return Geometry.conditionalDivideFraction(uv, uu);
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have closest approach (go by each other) in 3d
   * @param a0 start point of line A
   * @param a1 end point of line A
   * @param b0 start point of line B
   * @param b1 end point of line B
   * @param result vector to receive fractional coordinates of closest approach: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static lineSegment3dClosestApproachUnbounded(a0: Point3d, a1: Point3d, b0: Point3d, b1: Point3d,
    result: Vector2d): boolean {
    return this.ray3dXYZUVWClosestApproachUnbounded(
      a0.x, a0.y, a0.z,
      a1.x - a0.x, a1.y - a0.y, a1.z - a0.z,
      b0.x, b0.y, b0.z,
      b1.x - b0.x, b1.y - b0.y, b1.z - b0.z,
      result);
  }
  /**
   * Return true if the given rays have closest approach (go by each other) in 3d
   * @param ax x-coordinate of the origin of the first ray
   * @param ay y-coordinate of the origin of the first ray
   * @param az z-coordinate of the origin of the first ray
   * @param au x-coordinate of the direction vector of the first ray
   * @param av y-coordinate of the direction vector of the first ray
   * @param aw z-coordinate of the direction vector of the first ray
   * @param bx x-coordinate of the origin of the second ray
   * @param by y-coordinate of the origin of the second ray
   * @param bz z-coordinate of the origin of the second ray
   * @param bu x-coordinate of the direction vector of the second ray
   * @param bv y-coordinate of the direction vector of the second ray
   * @param bw z-coordinate of the direction vector of the second ray
   * @param result vector to receive fractional coordinates of intersection: result.x is fraction on line A, result.y is fraction on line B.
   */
  public static ray3dXYZUVWClosestApproachUnbounded(
    ax: number, ay: number, az: number, au: number, av: number, aw: number,
    bx: number, by: number, bz: number, bu: number, bv: number, bw: number,
    result: Vector2d): boolean {

    const cx = bx - ax;
    const cy = by - ay;
    const cz = bz - az;

    const uu = Geometry.hypotenuseSquaredXYZ(au, av, aw);
    const vv = Geometry.hypotenuseSquaredXYZ(bu, bv, bw);
    const uv = Geometry.dotProductXYZXYZ(au, av, aw, bu, bv, bw);
    const cu = Geometry.dotProductXYZXYZ(cx, cy, cz, au, av, aw);
    const cv = Geometry.dotProductXYZXYZ(cx, cy, cz, bu, bv, bw);
    return SmallSystem.linearSystem2d(uu, -uv, uv, -vv, cu, cv, result);
  }
  /**
   * Solve the pair of linear equations
   * * `ux * x + vx * y = cx`
   * * `uy * x + vy * y = cy`
   * @param ux xx coefficient
   * @param vx xy coefficient
   * @param uy yx coefficient
   * @param vy yy coefficient
   * @param cx x right hand side
   * @param cy y right hand side
   * @param result (x,y) solution (MUST be preallocated by caller)
   */
  public static linearSystem2d(
    ux: number, vx: number, // first row of matrix
    uy: number, vy: number, // second row of matrix
    cx: number, cy: number, // right side
    result: Vector2d,
  ): boolean {
    const uv = Geometry.crossProductXYXY(ux, uy, vx, vy);
    const cv = Geometry.crossProductXYXY(cx, cy, vx, vy);
    const cu = Geometry.crossProductXYXY(ux, uy, cx, cy);
    const s = Geometry.conditionalDivideFraction(cv, uv);
    const t = Geometry.conditionalDivideFraction(cu, uv);
    if (s !== undefined && t !== undefined) {
      result.set(s, t);
      return true;
    }
    result.set(0, 0);
    return false;
  }
  /**
   * Solve a linear system:
   * * x equation: `axx * u + axy * v + axz * w = cx`
   * * y equation: `ayx * u + ayy * v + ayz * w = cy`
   * * z equation: `azx * u + azy * v + azz * w = cz`
   * @param axx row 0, column 0 coefficient
   * @param axy row 0, column 1 coefficient
   * @param axz row 0, column 1 coefficient
   * @param ayx row 1, column 0 coefficient
   * @param ayy row 1, column 1 coefficient
   * @param ayz row 1, column 2 coefficient
   * @param azx row 2, column 0 coefficient
   * @param azy row 2, column 1 coefficient
   * @param azz row 2, column 2 coefficient
   * @param cx right hand side row 0 coefficient
   * @param cy right hand side row 1 coefficient
   * @param cz right hand side row 2 coefficient
   * @param result optional result.
   * @returns solution vector (u,v,w) or `undefined` if system is singular.
   */
  public static linearSystem3d(
    axx: number, axy: number, axz: number, // first row of matrix
    ayx: number, ayy: number, ayz: number, // second row of matrix
    azx: number, azy: number, azz: number, // second row of matrix
    cx: number, cy: number, cz: number,    // right side
    result?: Vector3d,
  ): Vector3d | undefined {
    // determinants of various combinations of columns ...
    const detXYZ = Geometry.tripleProduct(axx, ayx, azx, axy, ayy, azy, axz, ayz, azz);
    const detCYZ = Geometry.tripleProduct(cx, cy, cz, axy, ayy, azy, axz, ayz, azz);
    const detXCZ = Geometry.tripleProduct(axx, ayx, azx, cx, cy, cz, axz, ayz, azz);
    const detXYC = Geometry.tripleProduct(axx, ayx, azx, axy, ayy, azy, cx, cy, cz);
    const s = Geometry.conditionalDivideFraction(detCYZ, detXYZ);
    const t = Geometry.conditionalDivideFraction(detXCZ, detXYZ);
    const u = Geometry.conditionalDivideFraction(detXYC, detXYZ);
    if (s !== undefined && t !== undefined && u !== undefined) {
      return Vector3d.create(s, t, u, result);
    }
    return undefined;
  }
  /**
   * Compute the intersection of three planes.
   * @param xyzA point on the first plane
   * @param normalA normal of the first plane
   * @param xyzB point on the second plane
   * @param normalB normal of the second plane
   * @param xyzC point on the third plane
   * @param normalC normal of the third plane
   * @param result optional result
   * @returns intersection point of the three planes (as a Vector3d), or undefined if at least two planes are parallel.
   */
  public static intersect3Planes(
    xyzA: Point3d, normalA: Vector3d,
    xyzB: Point3d, normalB: Vector3d,
    xyzC: Point3d, normalC: Vector3d, result?: Vector3d): Vector3d | undefined {
    return this.linearSystem3d(
      normalA.x, normalA.y, normalA.z,
      normalB.x, normalB.y, normalB.z,
      normalC.x, normalC.y, normalC.z,
      Geometry.dotProductXYZXYZ(xyzA.x, xyzA.y, xyzA.z, normalA.x, normalA.y, normalA.z),
      Geometry.dotProductXYZXYZ(xyzB.x, xyzB.y, xyzB.z, normalB.x, normalB.y, normalB.z),
      Geometry.dotProductXYZXYZ(xyzC.x, xyzC.y, xyzC.z, normalC.x, normalC.y, normalC.z), result);
  }

  /**
   * In rowB, replace `rowB[j] += a * rowB[pivot] * rowA[j] / rowA[pivot]` for `j > pivot`
   * @param rowA row that does not change
   * @param pivotIndex index of pivot (divisor) in rowA.
   * @param rowB row where elimination occurs.
   */
  public static eliminateFromPivot(rowA: Float64Array, pivotIndex: number, rowB: Float64Array, a: number): boolean {
    const n = rowA.length;
    let q = Geometry.conditionalDivideFraction(rowB[pivotIndex], rowA[pivotIndex]);
    if (q === undefined) return false;
    q *= a;
    for (let j = pivotIndex + 1; j < n; j++)
      rowB[j] += q * rowA[j];
    return true;
  }
  /**
   * Solve a pair of bilinear equations
   * * First equation: `a0 + b0 * u + c0 * v + d0 * u * v = 0`
   * * Second equation: `a1 + b1 * u + c1 * v + d1 * u * v = 0`
   */
  public static solveBilinearPair(
    a0: number, b0: number, c0: number, d0: number,
    a1: number, b1: number, c1: number, d1: number,
  ): Point2d[] | undefined {
    return BilinearPolynomial.solveBilinearPair(a0, b0, c0, d0, a1, b1, c1, d1);
  }
}
