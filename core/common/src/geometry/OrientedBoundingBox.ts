/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import {
  Matrix3d, Point3d, Vector3d, Transform, XYAndZ,
} from "@itwin/core-geometry";
import { BoundingSphere } from "./BoundingSphere";

const scratchOffset = new Point3d();
const scratchU = new Vector3d();
const scratchV = new Vector3d();
const scratchW = new Vector3d();
const scratchValidAxis2 = new Vector3d();
const scratchValidAxis3 = new Vector3d();
const scratchPPrime = new Point3d();
const unitX = Vector3d.unitX();
const unitY = Vector3d.unitY();
const unitZ = Vector3d.unitZ();

export class OrientedBoundingBox {
  public center: Point3d;
  public halfAxes: Matrix3d;

  public constructor(center: Point3d, halfAxes: Matrix3d) {
    this.center = center;
    this.halfAxes = halfAxes;
  }

  public clone(result?: OrientedBoundingBox): OrientedBoundingBox {
    const center = this.center.clone(result?.center);
    const halfAxes = this.halfAxes.clone(result?.halfAxes);
    return result ?? new OrientedBoundingBox(center, halfAxes);
  }

  public transformBy(transform: Transform, result?: OrientedBoundingBox): OrientedBoundingBox {
    result = this.clone(result);
    transform.multiplyPoint3d(result.center, result.center);
    transform.matrix.multiplyMatrixMatrix(result.halfAxes, result.halfAxes);
    return result;
  }

  public transformInPlace(transform: Transform): OrientedBoundingBox {
    return this.transformBy(transform, this);
  }

  public isAlmostEqual(other: OrientedBoundingBox): boolean {
    return this.center.isAlmostEqual(other.center) && this.halfAxes.isAlmostEqual(other.halfAxes);
  }

  public computeBoundingSphere(result?: BoundingSphere): BoundingSphere {
    if (result)
      this.center.clone(result.center);
    else
      result = new BoundingSphere(this.center.clone());

    result = result ?? new BoundingSphere();
    const u = this.halfAxes.getColumn(0, scratchU);
    const v = this.halfAxes.getColumn(1, scratchV);
    const w = this.halfAxes.getColumn(2, scratchW);
    u.plus(v, u);
    u.plus(w, u);

    result.radius = u.magnitude();
    return result;
  }

  public distanceSquaredToPoint(point: XYAndZ): number {
    const offset = Point3d.create(point.x - this.center.x, point.y - this.center.y, point.z - this.center.z);
    const halfAxes = this.halfAxes;
    let u = halfAxes.getColumn(0, scratchU);
    let v = halfAxes.getColumn(1, scratchV);
    let w = halfAxes.getColumn(2, scratchW);
    const uHalf = u.magnitude();
    const vHalf = v.magnitude();
    const wHalf = w.magnitude();

    let numberOfDegenerateAxes = 0;
    if (uHalf > 0)
      u.scaleInPlace(1 / uHalf);
    else
      ++numberOfDegenerateAxes;

    const vValid = vHalf > 0;
    if (vValid)
      v.scaleInPlace(1 / vHalf);
    else
      ++numberOfDegenerateAxes;

    const wValid = wHalf > 0;
    if (wValid)
      w.scaleInPlace(1 / wHalf);
    else
      ++numberOfDegenerateAxes;

    let validAxis1;
    let validAxis2;
    let validAxis3;
    switch (numberOfDegenerateAxes) {
      case 1: {
        let degenerateAxis = u;
        validAxis1 = v;
        validAxis2 = w;
        if (!vValid) {
          degenerateAxis = v;
          validAxis1 = u;
        } else if (!wValid) {
          degenerateAxis = w;
          validAxis2 = u;
        }

        validAxis3 = validAxis1.crossProduct(validAxis2, scratchValidAxis3);
        if (degenerateAxis === u)
          u = validAxis3;
        else if (degenerateAxis === v)
          v = validAxis3;
        else if (degenerateAxis === w)
          w = validAxis3;

        break;
      }
      case 2: {
        validAxis1 = u;
        if (vValid)
          validAxis1 = v;
        else if (wValid)
          validAxis1 = w;

        let crossVector = unitY;
        if (!crossVector.isAlmostEqual(validAxis1, 0.001))
          crossVector = unitX;

        validAxis2 = validAxis1.crossProduct(crossVector, scratchValidAxis2);
        validAxis2.normalizeInPlace();
        validAxis3 = validAxis1.crossProduct(validAxis2, scratchValidAxis3);
        validAxis3.normalizeInPlace();

        if (validAxis1 === u) {
          v = validAxis2;
          w = validAxis3;
        } else if (validAxis1 === v) {
          w = validAxis2;
          u = validAxis3;
        } else if (validAxis1 === w) {
          u = validAxis2;
          v = validAxis3;
        }

        break;
      }
      case 3: {
        u = unitX;
        v = unitY;
        w = unitZ;
        break;
      }
    }

    const pPrime = scratchPPrime;
    pPrime.x = Vector3d.dotProductAsXYAndZ(offset, u);
    pPrime.y = Vector3d.dotProductAsXYAndZ(offset, v);
    pPrime.z = Vector3d.dotProductAsXYAndZ(offset, w);

    let distanceSquared = 0.0;
    let d;

    if (pPrime.x < -uHalf) {
      d = pPrime.x + uHalf;
      distanceSquared += d * d;
    } else if (pPrime.x > uHalf) {
      d = pPrime.x - uHalf;
      distanceSquared += d * d;
    }

    if (pPrime.y < -vHalf) {
      d = pPrime.y + vHalf;
      distanceSquared += d * d;
    } else if (pPrime.y > vHalf) {
      d = pPrime.y - vHalf;
      distanceSquared += d * d;
    }

    if (pPrime.z < -wHalf) {
      d = pPrime.z + wHalf;
      distanceSquared += d * d;
    } else if (pPrime.z > wHalf) {
      d = pPrime.z - wHalf;
      distanceSquared += d * d;
    }

    return distanceSquared;
  }

  public distanceToPoint(point: XYAndZ): number {
    return Math.sqrt(this.distanceSquaredToPoint(point));
  }

  public closestPointOnSurface(point: XYAndZ): Point3d | undefined {
    let outside = false;
    const closestPoint = this.center.clone();
    const dir = new Vector3d(point.x, point.y, point.z);
    dir.minus(this.center, dir);

    for (let columnIndex = 0; columnIndex < 3; columnIndex++) {
      const column = this.halfAxes.getColumn(columnIndex).normalizeWithLength();
      const axis = column.v;
      if (!axis)
        continue;

      const halfLength = column.mag;
      let distance = dir.dotProduct(axis);
      if (Math.abs(distance) >= halfLength) {
        outside = true;
        distance = distance > 0 ? halfLength : -halfLength;
      }

      axis.scaleInPlace(distance);
      closestPoint.plus(axis, closestPoint);
    }

    return outside ? closestPoint : undefined;
  }
}
