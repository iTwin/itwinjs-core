/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { AxisOrder, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Point3dArray } from "./PointHelpers";
import { Transform } from "./Transform";

/**
 * context for constructing smooth motion a startFrustum and endFrustum.
 * The externally interesting calls are
 * * Create a context to shift corner0 to corner1, with the(NPC coordinate) point(fractionU, fractionV, fractionW) moving along its connecting segment, all other points rotating smoothly from the start orientation to end orientation:
 * `const context = SmoothTransformBetweenFrusta (cornerA, cornerB)`
 *  * Get any intermediate 8 corners(at fraction) with `context.fractionToWorldCorners(fraction)`
 * * Frustum corners are ordered by "x varies fastest, then y, then z", hence (xyz) order on nondimensional space is
 *   * (left lower rear) (000)
 *   * (right lower rear) (100)
 *   * (left upper rear) (010)
 *   * (right upper rear) (100)
 *   * (left lower front) (001)
 *   * (right lower front) (101)
 *   * (left upper front) (011)
 *   * (right upper front) (101)
 * * which uses names
 *    * (left,right) for horizontal (x)
 *    * (bottom, top) for vertical (y)
 *    * (rear, front) for back and front planes (z)
 * @public
 */
export class SmoothTransformBetweenFrusta {
  // raw frusta:
  private _localCornerA: Point3d[];
  private _localCornerB: Point3d[];

  private _localToWorldA: Transform;
  private _localToWorldB: Transform;
  /** (property accessor) rigid frame at start of motion */
  public get localToWorldA(): Transform { return this._localToWorldA; }
  /** (property accessor) rigid frame at end of motion */
  public get localToWorldB(): Transform { return this._localToWorldB; }
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
  public static create(cornerA: Point3d[], cornerB: Point3d[], preferSimpleRotation: boolean = true): SmoothTransformBetweenFrusta | undefined {
    const localToWorldA = Point3dArray.evaluateTrilinearDerivativeTransform(cornerA, 0.5, 0.5, 0.5);
    const localToWorldB = Point3dArray.evaluateTrilinearDerivativeTransform(cornerB, 0.5, 0.5, 0.5);
    const rigidA = Transform.createOriginAndMatrix(localToWorldA.origin, Matrix3d.createRigidFromMatrix3d(localToWorldA.matrix, AxisOrder.ZXY));
    const rigidB = Transform.createOriginAndMatrix(localToWorldB.origin, Matrix3d.createRigidFromMatrix3d(localToWorldB.matrix, AxisOrder.ZXY));
    if (rigidA.matrix.computeCachedInverse(true) && rigidB.matrix.computeCachedInverse(true)) {
      const spinMatrix = rigidB.matrix.multiplyMatrixMatrixInverse(rigidA.matrix)!;
      const spinAxis = spinMatrix.getAxisAndAngleOfRotation();
      const localCornerA = rigidA.multiplyInversePoint3dArray(cornerA)!;
      const localCornerB = rigidB.multiplyInversePoint3dArray(cornerB)!;
      /** Is this a pure rotation -- i.e. no clip volume resizing for camera or clip changes */
      if (preferSimpleRotation && Point3dArray.isAlmostEqual(localCornerA, localCornerB) && !spinAxis.angle.isAlmostZero) {
        // world vectors
        const worldOriginShift = Vector3d.createStartEnd(localToWorldA.origin, localToWorldB.origin);
        const chordMidPoint = localToWorldA.getOrigin().interpolate(0.5, localToWorldB.getOrigin());
        const bisector = spinAxis.axis.unitCrossProduct(worldOriginShift);
        if (bisector) {
          const halfChordLength = 0.5 * worldOriginShift.magnitude();
          const alpha = Geometry.conditionalDivideFraction(halfChordLength, Math.tan(spinAxis.angle.radians * 0.5));
          if (alpha !== undefined) {
            const spinCenter = chordMidPoint.plusScaled(bisector, alpha);
            const rigidA1 = Transform.createOriginAndMatrix(spinCenter, rigidA.matrix);
            const rigidB1 = Transform.createOriginAndMatrix(spinCenter, rigidB.matrix);
            const localCornerA1 = rigidA1.multiplyInversePoint3dArray(cornerA)!;
            const localCornerB1 = rigidB1.multiplyInversePoint3dArray(cornerB)!;
            return new SmoothTransformBetweenFrusta(rigidA1, localCornerA1, rigidB1, localCornerB1,
              spinAxis.axis, spinAxis.angle);
          }
        }
      }
      return new SmoothTransformBetweenFrusta(rigidA, localCornerA, rigidB, localCornerB,
        spinAxis.axis, spinAxis.angle);
    }
    return undefined;
  }

  /** interpolate local corner coordinates at fractional move from m_localFrustum0 to m_localFrustum1 */
  public interpolateLocalCorners(fraction: number, result?: Point3d[]): Point3d[] {
    result = result || [];
    result.length = 0;
    const n = this._localCornerA.length;
    for (let i = 0; i < n; i++) {
      result.push(this._localCornerA[i].interpolate(fraction, this._localCornerB[i]));
    }
    return result;
  }
  /**
   * After initialization, call this for various intermediate fractions.
   * The returned corner points are in world coordinates "between" start and end positions.
   */
  public fractionToWorldCorners(fraction: number, result?: Point3d[]): Point3d[] {
    const corners = this.interpolateLocalCorners(fraction, result);
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
