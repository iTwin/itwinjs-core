/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Numerics */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/

import { XYZ, Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Matrix4d } from "./Matrix4d";
import { Point4d } from "./Point4d";

export class MomentData {
  public origin: Point3d;
  public sums: Matrix4d;
  /** the maapping between principal and world system.
   * * This set up with its inverse already constructed.
   */
  public localToWorldMap: Transform;

  /** radii of gyration (square roots of principal second moments)
   */
  public radiusOfGyration: Vector3d;
  private constructor() {
    this.origin = Point3d.createZero();
    this.sums = Matrix4d.createZero();
    this.localToWorldMap = Transform.createIdentity();
    this.radiusOfGyration = Vector3d.create();
  }
  public static momentTensorFromInertiaProducts(products: Matrix3d): Matrix3d {
    const rr = products.sumDiagonal();
    const result = Matrix3d.createScale(rr, rr, rr);
    result.addScaledInPlace(products, -1.0);
    return result;
  }

  public static sortColumnsForIncreasingMoments(axes: Matrix3d, moments: Vector3d) {
    const points = [
      axes.indexedColumnWithWeight(0, moments.x),
      axes.indexedColumnWithWeight(1, moments.y),
      axes.indexedColumnWithWeight(2, moments.z)].sort(
      (dataA: Point4d, dataB: Point4d): number => {
        if (dataA.w < dataB.w) return -1;
        if (dataA.w > dataB.w) return 1;
        return 0;
      });
    axes.setColumnsPoint4dXYZ(points[0], points[1], points[2]);
    moments.set(points[0].w, points[1].w, points[2].w);
  }
  public static pointsToPrincipalAxes(points: Point3d[]): MomentData {
    const moments = new MomentData();
    if (points.length === 0)
      return moments;
    moments.clearSums(points[0]);
    moments.accumulatePointMomentsFromOrigin(points);
    if (moments.shiftSumsToCentroid()) {
      const products = moments.sums.matrixPart();
      const tensor = MomentData.momentTensorFromInertiaProducts(products);
      const moment2 = Vector3d.create();
      const axisVectors = Matrix3d.createZero();
      tensor.fastSymmetricEigenvalues(axisVectors, moment2);
      MomentData.sortColumnsForIncreasingMoments(axisVectors, moment2);
      moments.localToWorldMap = Transform.createOriginAndMatrix (moments.origin, axisVectors);
      moments.radiusOfGyration.set(
        Math.sqrt(moment2.x), Math.sqrt(moment2.y), Math.sqrt(moment2.z));
      moments.radiusOfGyration.scaleInPlace(1.0 / Math.sqrt(moments.sums.weight()));
    }
    return moments;
  }
/**
 * Compute principal axes from inertial products
 * @param origin The origin used for the inertia products.
 * @param inertiaProducts The inertia products -- sums or integrals of [xx,xy,xz,xw; yx,yy, yz,yw; zx,zy,zz,zw; wx,wy,wz,w]
 */
  public static inertiaProductsToPrincipalAxes(origin: XYZ, inertiaProducts: Matrix4d): MomentData | undefined {
    const moments = new MomentData();
    moments.sums.setFrom(inertiaProducts);
    moments.origin.setFrom (origin);
    if (!moments.shiftSumsToCentroid())
      return undefined;
    const products = moments.sums.matrixPart();
    const tensor = MomentData.momentTensorFromInertiaProducts(products);
    const moment2 = Vector3d.create();
    const axisVectors = Matrix3d.createZero();
    tensor.fastSymmetricEigenvalues(axisVectors, moment2);
    MomentData.sortColumnsForIncreasingMoments(axisVectors, moment2);
    moments.localToWorldMap = Transform.createOriginAndMatrix (moments.origin, axisVectors);
    moments.radiusOfGyration.set(
      Math.sqrt(moment2.x), Math.sqrt(moment2.y), Math.sqrt(moment2.z));
    moments.radiusOfGyration.scaleInPlace(1.0 / Math.sqrt(moments.sums.weight()));
    return moments;
  }
  public clearSums(origin?: Point3d) {
    this.sums.setZero();
    if (origin)
      this.origin.setFrom(origin);
    else
      this.origin.setZero();
  }
  public accumulatePointMomentsFromOrigin(points: Point3d[]) {
    for (const p of points) {
      this.sums.addMomentsInPlace(
        p.x - this.origin.x,
        p.y - this.origin.y,
        p.z - this.origin.z,
        1.0);
    }
  }
  public shiftSumsToCentroid(): boolean {
    const xyz = this.sums.columnW().realPoint();
    if (xyz) {
      this.origin.addInPlace(xyz);
      const translation = Matrix4d.createTranslationXYZ(-xyz.x, -xyz.y, -xyz.z);
      const TA = translation.multiplyMatrixMatrix(this.sums);
      TA.multiplyMatrixMatrixTranspose(translation, this.sums);
      return true;
    }
    return false;
  }
}
