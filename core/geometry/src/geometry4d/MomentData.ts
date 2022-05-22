/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

// import { Point2d } from "./Geometry2d";
/* eslint-disable @typescript-eslint/naming-convention */

import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d, Vector3d, XYZ } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { Matrix4d } from "./Matrix4d";
import { Point4d } from "./Point4d";

/**
 * A MomentData structure exists in several levels:
 * * First level: as a carrier of sums of inertial products that determine moments.
 *   * origin = local origin used as moments are summed.
 *   * sums = array of summed moments.
 *     * The [i,j] entry of the sums is a summed or integrated moment for product of axis i and j.
 *       * axes 0,1,2 are x,y,z
 *         * e.g. entry [0,1] is summed product xy
 *       * axis 3 is "w", which is 1 in sums.
 *         * e.g. entry 03 is summed x
 *    * In this level,
 *        * the `absoluteQuantity` member is undefined.
 *        * the `localToWorldMap` and `radiiOfGyration` are created by have undefined contents.
 *  * Second level: after a call to inertiaProductsToPrincipalAxes, the `localToWorldMap`, `absoluteQuantity` and `radiiOfGyration` are filled in.
 * @public
 */
export class MomentData {
  /** Origin used for sums. */
  public origin: Point3d;
  /** flag to request deferred origin setup. */
  public needOrigin: boolean;
  /** Moment sums.
   * * Set to zero at initialization and if requested later.
   * * Accumulated during data entry phase.
   */
  public sums: Matrix4d;
  /** the mapping between principal and world system.
   * * This set up with its inverse already constructed.
   */
  public localToWorldMap: Transform;
  /** Return the lower-right (3,3) entry in the sums.
   * * This is the quantity (i.e. length, area, or volume) summed
   */
  public get quantitySum(): number { return this.sums.atIJ(3, 3); }
  /** Return a scale factor to make these sums match the target orientation sign.
   * * 1.0 if `this.quantitySum` has the same sign as `targetSign`.
   * * -1.0 if `this.quantitySum` has the opposite sign from `targetSign`
   */
  public signFactor(targetSign: number): number {
    return targetSign * this.quantitySum > 0 ? 1.0 : -1.0;
  }

  /**
   *  If `this.needOrigin` flag is set, copy `origin` to `this.origin` and clear the flag.
   *
   */
  public setOriginIfNeeded(origin: Point3d) {
    if (this.needOrigin) {
      this.origin.setFromPoint3d(origin);
      this.needOrigin = false;
    }
  }
  /**
   *  If `this.needOrigin` flag is set, copy `origin` to `this.origin` and clear the flag.
   *
   */
  public setOriginFromGrowableXYZArrayIfNeeded(points: GrowableXYZArray) {
    if (this.needOrigin && points.length > 0) {
      points.getPoint3dAtCheckedPointIndex(0, this.origin);
      this.needOrigin = false;
    }
  }

  /**
   *  If `this.needOrigin` flag is set, copy `origin` to `this.origin` and clear the flag.
   *
   */
  public setOriginXYZIfNeeded(x: number, y: number, z: number) {
    if (this.needOrigin) {
      this.origin.set(x, y, z);
      this.needOrigin = false;
    }
  }

  /** radii of gyration (square roots of principal second moments)
   */
  public radiusOfGyration: Vector3d;
  /** principal quantity (e.g. length, area, or volume).  This is undefined in raw moments, and becomes defined by
   *
   */
  public absoluteQuantity?: number;

  private constructor() {
    this.origin = Point3d.createZero();
    this.sums = Matrix4d.createZero();
    this.localToWorldMap = Transform.createIdentity();
    this.radiusOfGyration = Vector3d.create();
    this.needOrigin = false;
    this.absoluteQuantity = 0.1;   // so optimizer sees its type
    this.absoluteQuantity = undefined;
  }
  /** Create moments with optional origin.
   * * origin and needOrigin are quirky.
   *   * (undefined, true) sets up to use first incoming point as origin.
   *   * (origin) sets up to use that durable origin, set needsOrigin flag false
   *   * (origin, true) the "true" is meaningless
   *   * (undefined, false) makes 000 the durable origin
  */
  public static create(origin?: Point3d | undefined, needOrigin: boolean = false): MomentData {
    const data = new MomentData();
    data.needOrigin = needOrigin;
    if (origin) {
      data.origin.setFromPoint3d(origin);
      data.needOrigin = false;
    }
    return data;
  }
  /**
   * Return the formal tensor of integrated values `[yy+zz,xy,xz][yx,xx+zz,yz][zx,xy,xx+yy]`
   * @param products matrix of (integrated) `[xx,xy,xz][yx,yy,yz][zx,xy,zz]`
   */
  public static momentTensorFromInertiaProducts(products: Matrix3d): Matrix3d {
    const rr = products.sumDiagonal();
    const result = Matrix3d.createScale(rr, rr, rr);
    result.addScaledInPlace(products, -1.0);
    return result;
  }
  /** Sort the columns of the matrix for increasing moments. */
  public static sortColumnsForIncreasingMoments(axes: Matrix3d, moments: Vector3d) {
    const points = [
      axes.indexedColumnWithWeight(0, moments.x),
      axes.indexedColumnWithWeight(1, moments.y),
      axes.indexedColumnWithWeight(2, moments.z),
    ].sort((dataA: Point4d, dataB: Point4d): number => {
      if (dataA.w < dataB.w) return -1;
      if (dataA.w > dataB.w) return 1;
      return 0;
    });
    axes.setColumnsPoint4dXYZ(points[0], points[1], points[2]);
    if (axes.determinant() < 0)
      axes.scaleColumnsInPlace(-1.0, -1.0, -1.0);
    // prefer x and z positive -- y falls wherever . ..
    if (axes.at(0, 0) < 0.0)
      axes.scaleColumnsInPlace(-1.0, -1.0, 1.0);
    if (axes.at(2, 2) < 0.0)
      axes.scaleColumnsInPlace(1.0, -1.0, -1.0);
    moments.set(points[0].w, points[1].w, points[2].w);
  }

  /**
   * Return the principal moment data for an array of points.
   * @param points array of points
   */
  public static pointsToPrincipalAxes(points: Point3d[]): MomentData | undefined {
    const moments = new MomentData();
    if (points.length === 0)
      return moments;
    moments.clearSums(points[0]);
    moments.accumulatePointMomentsFromOrigin(points);
    return this.inertiaProductsToPrincipalAxes(moments.origin, moments.sums);
  }
  /**
   * Compute principal axes from inertial products
   * * The radii of gyration are sorted smallest to largest
   * * Hence x axis is long direction
   * * Hence planar data generates large moment as Z
   * @param origin The origin used for the inertia products.
   * @param inertiaProducts The inertia products -- sums or integrals of [xx,xy,xz,xw; yx,yy, yz,yw; zx,zy,zz,zw; wx,wy,wz,w]
   */
  public static inertiaProductsToPrincipalAxes(origin: XYZ, inertiaProducts: Matrix4d): MomentData | undefined {
    const moments = new MomentData();
    moments.sums.setFrom(inertiaProducts);
    moments.origin.setFrom(origin);
    if (!moments.shiftOriginAndSumsToCentroidOfSums())
      return undefined;
    const products = moments.sums.matrixPart();
    const w = moments.sums.weight();
    if (w < 0.0)
      products.scaleColumnsInPlace(-1, -1, -1);
    const tensor = MomentData.momentTensorFromInertiaProducts(products);
    const moment2 = Vector3d.create();
    const axisVectors = Matrix3d.createZero();
    tensor.fastSymmetricEigenvalues(axisVectors, moment2);
    if (moment2.x < 0.0)
      return undefined;
    MomentData.sortColumnsForIncreasingMoments(axisVectors, moment2);
    if (w < 0.0)
      axisVectors.scaleColumnsInPlace(1, -1, -1);
    moments.localToWorldMap = Transform.createOriginAndMatrix(moments.origin, axisVectors);
    moments.radiusOfGyration.set(
      Math.sqrt(Math.abs(moment2.x)), Math.sqrt(Math.abs(moment2.y)), Math.sqrt(Math.abs(moment2.z)));
    moments.radiusOfGyration.scaleInPlace(1.0 / Math.sqrt(Math.abs(w)));
    moments.absoluteQuantity = Math.abs(w);
    return moments;
  }
  /**
   * Test for match among selected members as they exist after `inertiaProductsToPrincipalAxes`
   * * The members considered are
   *   * origin of local to world map (i.e. centroid)
   *   * radius of gyration
   *   * axes of localToWorldMap.
   * * Axis direction tests allow these quirks:
   *   * opposite orientation is considered matched.
   * * Full xyz symmetry: If x,y,z radii are matched, axes are not tested.
   * * Symmetry in xy plane: If x and y radii are matched, the x and y axes area allowed to spin freely.  Only Z direction is tested.
   * * If either or both are undefined, returns false.
   * @param dataA first set of moments
   * @param dataB second set of moments
   */
  public static areEquivalentPrincipalAxes(dataA: MomentData | undefined, dataB: MomentData | undefined): boolean {
    if (dataA && dataB
      && Geometry.isSameCoordinate(dataA.quantitySum, dataB.quantitySum)) {  // um.. need different tolerance for area, volume?)
      if (dataA.localToWorldMap.getOrigin().isAlmostEqual(dataB.localToWorldMap.getOrigin())
        && dataA.radiusOfGyration.isAlmostEqual(dataB.radiusOfGyration)) {
        if (Geometry.isSameCoordinate(dataA.radiusOfGyration.x, dataA.radiusOfGyration.y)) {
          // We have at least xy symmetry ....
          if (Geometry.isSameCoordinate(dataA.radiusOfGyration.x, dataA.radiusOfGyration.z))
            return true;
          // just xy.
          // allow opposite z directions.
          // If the z's are aligned, x an dy can spin freely.
          const zA = dataA.localToWorldMap.matrix.columnZ();
          const zB = dataB.localToWorldMap.matrix.columnZ();
          if (zA.isParallelTo(zB, true))
            return true;
          return false;
        }
        // no symmetry.  Test all three axes.
        const vectorA = Vector3d.create();
        const vectorB = Vector3d.create();
        for (let i = 0; i < 3; i++) {
          dataA.localToWorldMap.matrix.getColumn(i, vectorA);
          dataB.localToWorldMap.matrix.getColumn(i, vectorB);
          if (!vectorA.isParallelTo(vectorB, true))
            return false;
        }
        return true;
      }
    }
    return false;
  }
  /** Clear the MomentData sums to zero, and establish a new origin. */
  public clearSums(origin?: Point3d) {
    this.sums.setZero();
    if (origin)
      this.origin.setFrom(origin);
    else
      this.origin.setZero();
  }
  /** Accumulate products-of-components for given points. */
  public accumulatePointMomentsFromOrigin(points: Point3d[]) {
    for (const p of points) {
      this.sums.addMomentsInPlace(
        p.x - this.origin.x,
        p.y - this.origin.y,
        p.z - this.origin.z,
        1.0);
    }
  }
  /** revise the accumulated sums to be "around the centroid" */
  public shiftOriginAndSumsToCentroidOfSums(): boolean {
    const xyz = this.sums.columnW().realPoint();
    if (xyz) {
      this.shiftOriginAndSumsByXYZ(xyz.x, xyz.y, xyz.z);
      return true;
    }
    return false;
  }

  /** revise the accumulated sums
   * * add ax,ay,ax to the origin coordinates.
   * * apply the negative translation to the sums.
  */
  public shiftOriginAndSumsByXYZ(ax: number, ay: number, az: number) {
    this.origin.addXYZInPlace(ax, ay, az);
    this.sums.multiplyTranslationSandwichInPlace(-ax, -ay, -az);
  }
  /** revise the accumulated sums so they are based at a specified origin. */
  public shiftOriginAndSumsToNewOrigin(newOrigin: XYAndZ) {
    this.shiftOriginAndSumsByXYZ(newOrigin.x - this.origin.x, newOrigin.y - this.origin.y, newOrigin.z - this.origin.z);
  }
  private static _vectorA?: Point4d;
  private static _vectorB?: Point4d;
  private static _vectorC?: Point4d;

  /** compute moments of a triangle from the origin to the given line.
   * Accumulate them to this.sums.
   * * If `pointA` is undefined, use `this.origin` as pointA.
   * * If `this.needOrigin` is set, pointB is used
  */
  public accumulateTriangleMomentsXY(pointA: XAndY | undefined, pointB: XAndY, pointC: XAndY) {
    this.setOriginXYZIfNeeded(pointB.x, pointB.y, 0.0);
    const x0 = this.origin.x;
    const y0 = this.origin.y;
    const vectorA = MomentData._vectorA =
      pointA !== undefined ? Point4d.create(pointA.x - x0, pointA.y - y0, 0.0, 1.0, MomentData._vectorA)
        : Point4d.create(this.origin.x, this.origin.y, 0.0, 1.0, MomentData._vectorA);
    const vectorB = MomentData._vectorB = Point4d.create(pointB.x - x0, pointB.y - y0, 0.0, 1.0, MomentData._vectorB);
    const vectorC = MomentData._vectorC = Point4d.create(pointC.x - x0, pointC.y - y0, 0.0, 1.0, MomentData._vectorC);

    // accumulate Return product integrals I(0<=u<=1) I (0<=v<= u)  (w*W + u *U + v * V)(w*W + u *U + v * V)^  du dv
    //  where w = 1-u-v
    //  W = column vector (point00.x, point00.y, point00.z, 1.0) etc.
    const detJ = Geometry.crossProductXYXY(vectorB.x - vectorA.x, vectorB.y - vectorA.y, vectorC.x - vectorA.x, vectorC.y - vectorA.y);
    if (detJ !== 0.0) {
      const r1_12 = detJ / 12.0;
      const r1_24 = detJ / 24.0;

      this.sums.addScaledOuterProductInPlace(vectorA, vectorA, r1_12);
      this.sums.addScaledOuterProductInPlace(vectorA, vectorB, r1_24);
      this.sums.addScaledOuterProductInPlace(vectorA, vectorC, r1_24);

      this.sums.addScaledOuterProductInPlace(vectorB, vectorA, r1_24);
      this.sums.addScaledOuterProductInPlace(vectorB, vectorB, r1_12);
      this.sums.addScaledOuterProductInPlace(vectorB, vectorC, r1_24);

      this.sums.addScaledOuterProductInPlace(vectorC, vectorA, r1_24);
      this.sums.addScaledOuterProductInPlace(vectorC, vectorB, r1_24);
      this.sums.addScaledOuterProductInPlace(vectorC, vectorC, r1_12);
    }
  }
  /** add scaled outer product of (4d, unit weight) point to this.sums */
  public accumulateScaledOuterProduct(point: XYAndZ, scaleFactor: number) {
    this.setOriginXYZIfNeeded(point.x, point.y, 0.0);
    const vectorA = MomentData._vectorA = Point4d.create(point.x - this.origin.x, point.y - this.origin.y, point.z - this.origin.z, 1.0, MomentData._vectorA);
    this.sums.addScaledOuterProductInPlace(vectorA, vectorA, scaleFactor);
  }
  /** Accumulate wire moment integral from pointA to pointB */
  public accumulateLineMomentsXYZ(pointA: Point3d, pointB: Point3d) {
    this.setOriginXYZIfNeeded(pointA.x, pointA.y, pointA.z);
    const x0 = this.origin.x;
    const y0 = this.origin.y;
    const z0 = this.origin.z;
    const vectorA = MomentData._vectorA = Point4d.create(pointA.x - x0, pointA.y - y0, pointA.z - z0, 1.0, MomentData._vectorA);
    const vectorB = MomentData._vectorB = Point4d.create(pointB.x - x0, pointB.y - y0, pointB.z - z0, 1.0, MomentData._vectorB);
    const detJ = pointA.distance(pointB);
    const r1_3 = detJ / 3.0;
    const r1_6 = detJ / 6.0;
    this.sums.addScaledOuterProductInPlace(vectorA, vectorA, r1_3);
    this.sums.addScaledOuterProductInPlace(vectorA, vectorB, r1_6);
    this.sums.addScaledOuterProductInPlace(vectorB, vectorA, r1_6);
    this.sums.addScaledOuterProductInPlace(vectorB, vectorB, r1_3);

  }

  private _point0 = Point3d.create();
  private _point1 = Point3d.create();
  /** compute moments of triangles from a base point to the given linestring.
   * Accumulate them to this.sums.
   * * If `pointA` is undefined, use `this.origin` as pointA.
   * * If `this.needOrigin` is set, the first point of the array is captured as local origin for subsequent sums.
   *
   */
  public accumulateTriangleToLineStringMomentsXY(sweepBase: XAndY | undefined, points: GrowableXYZArray) {
    const n = points.length;
    if (n > 1) {
      points.getPoint3dAtUncheckedPointIndex(0, this._point0);
      for (let i = 1; i < n; i++) {
        points.getPoint3dAtUncheckedPointIndex(i, this._point1);
        this.accumulateTriangleMomentsXY(sweepBase, this._point0, this._point1);
        this._point0.setFromPoint3d(this._point1);
      }
    }
  }
  // cspell:word ABAT
  /**
   * * Assemble XX, YY, XY products into a full matrix form [xx,xy,0,0; xy,yy,0,0;0,0,0,0;0,0,0,1].
   * * Sandwich this between transforms with columns [vectorU, vectorV, 0000, origin].  (Column weights 0001) (only xy parts of vectors)
   * * scale by detJ for the xy-only determinant of the vectors.
   * @param productXX
   * @param productXY
   * @param productYY
   * @param area Area in caller's system
   * @param origin Caller's origin
   * @param vectorU Caller's U axis (not necessarily unit)
   * @param vectorV Caller's V axis (not necessarily unit)
   */
  public accumulateXYProductsInCentroidalFrame(productXX: number, productXY: number, productYY: number, area: number,
    origin: XAndY, vectorU: XAndY, vectorV: XAndY) {
    const centroidalProducts = Matrix4d.createRowValues(
      productXX, productXY, 0, 0,
      productXY, productYY, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, area);
    const detJ = Geometry.crossProductXYXY(vectorU.x, vectorV.x, vectorU.y, vectorV.y);
    const placement = Matrix4d.createRowValues(
      vectorU.x, vectorV.x, 0, origin.x - this.origin.x,
      vectorU.y, vectorV.y, 0, origin.y - this.origin.y,
      0, 0, 0, 0,
      0, 0, 0, 1);
    const AB = placement.multiplyMatrixMatrix(centroidalProducts);
    const ABAT = AB.multiplyMatrixMatrixTranspose(placement);
    this.sums.addScaledInPlace(ABAT, detJ);
  }
  /**
   * Accumulate sums from other moments.
   * * scale by given scaleFactor (e.g. sign to correct orientation)
   * * pull the origin from `other` if `this` needs an origin.
   * *
   */
  public accumulateProducts(other: MomentData, scale: number) {
    this.setOriginIfNeeded(other.origin);
    this.sums.addTranslationSandwichInPlace(other.sums, this.origin.x - other.origin.x, this.origin.y - other.origin.y, this.origin.z - other.origin.z, scale);
  }

  /**
 * Accumulate sums from Matrix4d and origin.
 * * scale by given scaleFactor (e.g. sign to correct orientation)
 * * trap the origin if `this` needs an origin.
 * *
 */
  public accumulateProductsFromOrigin(origin: Point3d, products: Matrix4d, scale: number) {
    this.setOriginIfNeeded(origin);
    this.sums.addTranslationSandwichInPlace(products, this.origin.x - origin.x, this.origin.y - origin.y, this.origin.z - origin.z, scale);
  }
  /**
   * Convert to a json data object with:
   */
  public toJSON(): any {
    return {
      origin: this.origin,
      sums: this.sums.toJSON(),
      radiusOfGyration: this.radiusOfGyration.toJSON(),
      localToWorld: this.localToWorldMap.toJSON(),
    };
  }
}
