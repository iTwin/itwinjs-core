/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { Point3dArray } from "./PointHelpers";
import { Matrix3d } from "./Matrix3d";
import { AxisOrder } from "../Geometry";
import { Angle } from "./Angle";
/*
* context for constructing smooth motion a startFrsutum and endFrutum.
* The externally interesting calls are
*   1) Declare and initialize a context to shift corner0 to corner1, with the (NPC coordinate) point (fractionU, fractionV, fractionW)
*             moving along its connecting segment, all other points rotating smoothly from the start orientation to end orientation:
*
*              SmoothTransformBetweenFrusta context;
*              if (context.InitFractionalFrustumTransform (corner0, corner1, fractionU, fractionV, fractionW)) ....
*           (this only fails for flattened frustum -- should not happen)
*   2) Get any intermediate 8 corners (at fraction) with
*/
export class SmoothTransformBetweenFrusta {
  // raw frusta:
  private _localCornerA: Point3d[];
  private _localCornerB: Point3d[];

  private _localToWorldA: Transform;
  private _localToWorldB: Transform;

  private _rotationAxis: Vector3d;
  private _rotationAngle: Angle;

  /**
   * CAPTURE local corners, pickup and putdown frames, and rotation-around-vector data
   * @param localCornerA
   * @param localCornerB
   * @param localToWordA
   * @param localToWordB
   * @param rotationAxis
   * @param rotationAngle
   */
  private constructor(localToWorldA: Transform, localCornerA: Point3d[], localToWorldB: Transform, localCornerB: Point3d[], rotationAxis: Vector3d, rotationAngle: Angle) {
    this._localCornerA = localCornerA;
    this._localCornerB = localCornerB;
    this._localToWorldA = localToWorldA;
    this._localToWorldB = localToWorldB;
    this._rotationAxis = rotationAxis;
    this._rotationAngle = rotationAngle;
  }
  /**
   * Set up rotation data for smooth transition from 8 point frusta cornerA and cornerB
   * @param cornerA
   * @param cornerB
   */
  public static create(cornerA: Point3d[], cornerB: Point3d[]): SmoothTransformBetweenFrusta | undefined {
    const localToWorldA = Point3dArray.evaluateTrilinearDerivativeTransform(cornerA, 0.5, 0.5, 0.5);
    const localToWorldB = Point3dArray.evaluateTrilinearDerivativeTransform(cornerB, 0.5, 0.5, 0.5);
    const rigidA = Transform.createOriginAndMatrix(localToWorldA.origin, Matrix3d.createRigidFromMatrix3d(localToWorldA.matrix, AxisOrder.ZXY));
    const rigidB = Transform.createOriginAndMatrix(localToWorldB.origin, Matrix3d.createRigidFromMatrix3d(localToWorldB.matrix, AxisOrder.ZXY));
    if (rigidA.matrix.computeCachedInverse(true) && rigidB.matrix.computeCachedInverse(true)) {
      const spinMatrix = rigidB.matrix.multiplyMatrixMatrixInverse(rigidA.matrix)!;
      const spinAxis = spinMatrix.getAxisAndAngleOfRotation();
      const localCornerA = rigidA.multiplyInversePoint3dArray(cornerA)!;
      const localCornerB = rigidB.multiplyInversePoint3dArray(cornerB)!;
      return new SmoothTransformBetweenFrusta(rigidA, localCornerA, rigidB, localCornerB,
        spinAxis.axis, spinAxis.angle);
    }
    return undefined;
  }

  // interpolate local corner coordinates at fractional move from m_localFrustum0 to m_localFrustum1
  public interpolateLocalCorners(fraction: number): Point3d[] {
    const result = [];
    const n = this._localCornerA.length;
    for (let i = 0; i < n; i++) {
      result.push(this._localCornerA[i].interpolate(fraction, this._localCornerB[i]));
    }
    return result;
  }
  /*
  * After initialization, call this for various intermediate fractions.
  * The returned corner points are in world coordinates "between" start and end positions.
  */
  public fractionToWorldCorners(fraction: number): Point3d[] {
    const corners = this.interpolateLocalCorners(fraction);
    const fractionalRotation = Matrix3d.createRotationAroundVector(this._rotationAxis,
      this._rotationAngle.cloneScaled(fraction))!;
    const axes0 = this._localToWorldA.matrix;
    const fractionalAxes = fractionalRotation.multiplyMatrixMatrix(axes0);
    const fractionalOrigin = this._localToWorldA.getOrigin().interpolate(fraction, this._localToWorldB.origin);
    const putdownFrame = Transform.createOriginAndMatrix(fractionalOrigin, fractionalAxes);
    putdownFrame.multiplyPoint3dArray(corners, corners);
    return corners;
  }
}
