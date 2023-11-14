/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AngleProps, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";
import { Point3d } from "./Point3dVector3d";
import { Transform } from "./Transform";

// cspell:word Tait

/**
 * Angle properties of a `YawPitchRoll` orientation
 * @public
 */
export interface YawPitchRollProps {
  /** yaw field */
  yaw?: AngleProps;
  /** pitch field */
  pitch?: AngleProps;
  /** roll field */
  roll?: AngleProps;
}

/**
 * Three angles that determine the orientation of an object in space, sometimes referred to as [Tait–Bryan angles]
 * (https://en.wikipedia.org/wiki/Euler_angles).
 * * The matrix construction can be replicated by this logic:
 * * xyz coordinates have
 *   * x forward
 *   * y to left
 *   * z up
 * * Note that this is a right handed coordinate system.
 * * yaw is a rotation of x towards y, i.e. around positive z (counterclockwise):
 *     * `yawMatrix = Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(yawDegrees));`
 * * pitch is a rotation that raises x towards z, i.e. rotation around **negative y** (**clockwise**):
 *     * `pitchMatrix = Matrix3d.createRotationAroundAxisIndex(1, Angle.createDegrees(-pitchDegrees));`
 * * roll is rotation of y towards z, i.e. rotation around positive x (counterclockwise):
 *     * `rollMatrix = Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(rollDegrees));`
 * * The YPR matrix is the product
 *     * `result = yawMatrix.multiplyMatrixMatrix(pitchMatrix.multiplyMatrixMatrix(rollMatrix));`
 * * Note that this is for "column based" matrix with vectors multiplying on the right of the matrix.
 * Hence a vector is first rotated by roll, then the pitch, finally yaw. So multiplication order in
 * the sense of AxisOrder is `RPY` (i.e., XYZ), in contrast to the familiar name `YPR`.
 * @public
 */
export class YawPitchRollAngles {
  /** The yaw angle: counterclockwise rotation angle around z  */
  public yaw: Angle;
  /** The pitch angle: **clockwise** rotation angle around y */
  public pitch: Angle;
  /** The roll angle: counterclockwise rotation angle around x */
  public roll: Angle;
  /**
   * Constructor
   * @param yaw counterclockwise rotation angle around z
   * @param pitch **clockwise** rotation angle around y
   * @param roll counterclockwise rotation angle around x
   */
  constructor(yaw: Angle = Angle.zero(), pitch: Angle = Angle.zero(), roll: Angle = Angle.zero()) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
  }
  /** Freeze this YawPitchRollAngles */
  public freeze(): Readonly<this> {
    this.yaw.freeze();
    this.pitch.freeze();
    this.roll.freeze();
    return Object.freeze(this);
  }
  /**
   * Constructor for YawPitchRollAngles with angles in degrees.
   * @param yawDegrees counterclockwise rotation angle (in degrees) around z
   * @param pitchDegrees **clockwise** rotation angle (in degrees) around y
   * @param rollDegrees counterclockwise rotation angle (in degrees) around x
   */
  public static createDegrees(yawDegrees: number, pitchDegrees: number, rollDegrees: number): YawPitchRollAngles {
    return new YawPitchRollAngles(
      Angle.createDegrees(yawDegrees),
      Angle.createDegrees(pitchDegrees),
      Angle.createDegrees(rollDegrees),
    );
  }
  /**
   * Constructor for YawPitchRollAngles with angles in radians.
   * @param yawRadians counterclockwise rotation angle (in radians) around z
   * @param pitchRadians **clockwise** rotation angle (in radians) around y
   * @param rollRadians counterclockwise rotation angle (in radians) around x
   */
  public static createRadians(yawRadians: number, pitchRadians: number, rollRadians: number): YawPitchRollAngles {
    return new YawPitchRollAngles(
      Angle.createRadians(yawRadians),
      Angle.createRadians(pitchRadians),
      Angle.createRadians(rollRadians),
    );
  }
  /** Construct a `YawPitchRoll` object from an object with 3 named angles */
  public static fromJSON(json?: YawPitchRollProps): YawPitchRollAngles {
    json = json ? json : {};
    return new YawPitchRollAngles(
      Angle.fromJSON(json.yaw),
      Angle.fromJSON(json.pitch),
      Angle.fromJSON(json.roll),
    );
  }
  /** Populate yaw, pitch and roll fields using `Angle.fromJSON` */
  public setFromJSON(json?: YawPitchRollProps): void {
    json = json ? json : {};
    this.yaw = Angle.fromJSON(json.yaw);
    this.pitch = Angle.fromJSON(json.pitch);
    this.roll = Angle.fromJSON(json.roll);
  }
  /**
   * Convert to a JSON object of form { pitch: 20 , roll: 30 , yaw: 10 }. Angles are in degrees.
   * Any values that are exactly zero (with tolerance `Geometry.smallAngleRadians`) are omitted.
   */
  public toJSON(): YawPitchRollProps {
    const val: YawPitchRollProps = {};
    if (!this.pitch.isAlmostZero)
      val.pitch = this.pitch.toJSON();
    if (!this.roll.isAlmostZero)
      val.roll = this.roll.toJSON();
    if (!this.yaw.isAlmostZero)
      val.yaw = this.yaw.toJSON();
    return val;
  }
  /**
   * Install all rotations from `other` into `this`.
   * @param other YawPitchRollAngles source
   */
  public setFrom(other: YawPitchRollAngles) {
    this.yaw.setFrom(other.yaw);
    this.pitch.setFrom(other.pitch);
    this.roll.setFrom(other.roll);
  }
  /**
   * Compare angles between `this` and `other`.
   * * Comparisons are via `isAlmostEqualAllowPeriodShift`.
   * @param other YawPitchRollAngles source
   */
  public isAlmostEqual(other: YawPitchRollAngles) {
    return this.yaw.isAlmostEqualAllowPeriodShift(other.yaw)
      && this.pitch.isAlmostEqualAllowPeriodShift(other.pitch)
      && this.roll.isAlmostEqualAllowPeriodShift(other.roll);
  }
  /** Make a copy of this YawPitchRollAngles */
  public clone() {
    return new YawPitchRollAngles(
      this.yaw.clone(),
      this.pitch.clone(),
      this.roll.clone(),
    );
  }
  /**
   * Expand the angles into a (rigid rotation) matrix.
   * * The returned matrix is "rigid" (i.e., it has unit length rows and columns, and its transpose is its inverse).
   * * The rigid matrix is always a right handed coordinate system.
   * @param result optional pre-allocated `Matrix3d`
   */
  public toMatrix3d(result?: Matrix3d) {
    const cz = Math.cos(this.yaw.radians);
    const sz = Math.sin(this.yaw.radians);
    const cy = Math.cos(this.pitch.radians);
    const sy = Math.sin(this.pitch.radians);
    const cx = Math.cos(this.roll.radians);
    const sx = Math.sin(this.roll.radians);
    /**
    * The axis order is XYZ (i.e., RPY) so the rotation matrix is calculated via rZ*rY*rX where
    * rX, rY, and rZ are base rotation matrixes:
    *
    *     const rX = Matrix3d.createRowValues(
    *        1, 0, 0,
    *        0, Math.cos(x), -Math.sin(x),
    *        0, Math.sin(x), Math.cos(x),
    *      );
    *      const rY = Matrix3d.createRowValues(
    *        Math.cos(y), 0, Math.sin(y),
    *        0, 1, 0,
    *        -Math.sin(y), 0, Math.cos(y),
    *      );
    *      const rZ = Matrix3d.createRowValues(
    *        Math.cos(z), -Math.sin(z), 0,
    *        Math.sin(z), Math.cos(z), 0,
    *        0, 0, 1,
    *      );
    *
    * Then we replace sin(y) with -sin(y) because y rotation (i.e., pitch) is clockwise (alternatively, you
    * can use transpose of rY in the matrix multiplication to get the same result)
    */
    return Matrix3d.createRowValues(
      cz * cy, -(sz * cx + cz * sy * sx), (sz * sx - cz * sy * cx),
      sz * cy, (cz * cx - sz * sy * sx), -(cz * sx + sz * sy * cx),
      sy, cy * sx, cy * cx,
      result,
    );
  }
  /**
   * Returns true if this rotation does nothing.
   * * If allowPeriodShift is false, any nonzero angle is considered a non-identity
   * * If allowPeriodShift is true, all angles are individually allowed to be any multiple of 360 degrees.
   */
  public isIdentity(allowPeriodShift: boolean = true): boolean {
    if (allowPeriodShift)
      return Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.yaw.radians)
        && Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.pitch.radians)
        && Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.roll.radians);
    else
      return Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.yaw.radians)
        && Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.pitch.radians)
        && Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.roll.radians);
  }
  /** Return the largest angle in radians */
  public maxAbsRadians(): number {
    return Geometry.maxAbsXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }
  /** Return the sum of the angles in squared radians */
  public sumSquaredRadians(): number {
    return Geometry.hypotenuseSquaredXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }
  /** Return the largest difference of angles (in radians) between this and other */
  public maxDiffRadians(other: YawPitchRollAngles): number {
    return Math.max(
      this.yaw.radians - other.yaw.radians,
      this.pitch.radians - other.pitch.radians,
      this.roll.radians - other.roll.radians,
    );
  }
  /** Return the largest angle in degrees. */
  public maxAbsDegrees(): number {
    return Geometry.maxAbsXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees);
  }
  /** Return the sum of squared angles in degrees. */
  public sumSquaredDegrees(): number {
    return Geometry.hypotenuseSquaredXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees);
  }
  /** Return the largest difference of angles (in degrees) between this and other */
  public maxDiffDegrees(other: YawPitchRollAngles): number {
    return Math.max(
      this.yaw.degrees - other.yaw.degrees,
      this.pitch.degrees - other.pitch.degrees,
      this.roll.degrees - other.roll.degrees,
    );
  }
  /** Return an object from a Transform as an origin and YawPitchRollAngles. */
  public static tryFromTransform(transform: Transform): {
    origin: Point3d;
    angles: YawPitchRollAngles | undefined;
  } {
    return {
      origin: Point3d.createFrom(transform.origin),
      angles: YawPitchRollAngles.createFromMatrix3d(transform.matrix),
    };
  }
  /**
   * Attempts to create a YawPitchRollAngles object from a Matrix3d
   * * This conversion fails if the matrix is not rigid (unit rows and columns, and transpose is inverse)
   * * In the failure case the method's return value is `undefined`.
   * * In the failure case, if the optional result was supplied, that result will nonetheless be filled with
   * a set of angles.
   */
  public static createFromMatrix3d(matrix: Matrix3d, result?: YawPitchRollAngles): YawPitchRollAngles | undefined {
    /**
     * The rotation matrix form is
     *
     * Matrix3d.createRowValues(
     *      cz * cy, -(sz * cx + cz * sy * sx), (sz * sx - cz * sy * cx),
     *      sz * cy, (cz * cx - sz * sy * sx), -(cz * sx + sz * sy * cx),
     *      sy, cy * sx, cy * cx
     * );
     *
     * where cx = cos(x), sx = sin(x), cy = cos(y), sy = sin(y), cz = cos(z), and sz = sin(z)
     */
    const sy = matrix.at(2, 0); // sin(y)
    const cy = Math.sqrt(matrix.at(2, 1) * matrix.at(2, 1) + matrix.at(2, 2) * matrix.at(2, 2)); // |cos(y)|
    const pitchA = Angle.createAtan2(sy, cy); // with positive cosine
    const pitchB = Angle.createAtan2(sy, -cy); // with negative cosine
    const angles = result ? result : new YawPitchRollAngles();
    /**
     * If cos(y) = 0 then y = +-90 degrees so we have a gimbal lock.
     * This means x and z can be anything as long as their sum x + z is constant.
     * so we can pick z = 0 and calculate x (or pick x = 0 and calculate z).
     * Math details can be found
     * https://en.wikipedia.org/wiki/Gimbal_lock#Loss_of_a_degree_of_freedom_with_Euler_angles
     *
     * The rotation matrix for y = +-90 degrees and x = 0 becomes
     *
     * Matrix3d.createRowValues(
     *      0, -sz, -+cz,
     *      0, cz, -+sz,
     *      +-1, 0, 0
     * );
     *
     * so z = atan(sz/cz) = atan(-matrix.at(0, 1), matrix.at(1, 1))
     */
    if (cy < Geometry.smallAngleRadians) {
      angles.yaw = Angle.createAtan2(-matrix.at(0, 1), matrix.at(1, 1));
      angles.pitch = pitchA; // this is an arbitrary choice. can pick pitchB instead.
      angles.roll = Angle.createRadians(0.0);
    } else {
      /**
       * positive cosine
       * z = atan(sz/cz) = atan(matrix.at(1, 0), matrix.at(0, 0))
       * x = atan(sx/cx) = atan(matrix.at(2, 1), matrix.at(2, 2))
       */
      const yawA = Angle.createAtan2(matrix.at(1, 0), matrix.at(0, 0));
      const rollA = Angle.createAtan2(matrix.at(2, 1), matrix.at(2, 2));
      // similar with negative cosine
      const yawB = Angle.createAtan2(-matrix.at(1, 0), -matrix.at(0, 0));
      const rollB = Angle.createAtan2(-matrix.at(2, 1), -matrix.at(2, 2));
      // create YPR
      const yprA = new YawPitchRollAngles(yawA, pitchA, rollA);
      const yprB = new YawPitchRollAngles(yawB, pitchB, rollB);
      // decide to pick yprA or yprB with smallest magnitude angles
      const absFactor = 0.95;
      const maxRadiansA = yprA.maxAbsRadians();
      const maxRadiansB = yprB.maxAbsRadians();
      if (maxRadiansA < absFactor * maxRadiansB) {
        angles.setFrom(yprA);
      } else if (maxRadiansB < absFactor * maxRadiansA) {
        angles.setFrom(yprB);
      } else {
        const sumA = yprA.sumSquaredRadians();
        const sumB = yprB.sumSquaredRadians();
        if (sumA <= sumB) {
          angles.setFrom(yprA);
        } else {
          angles.setFrom(yprB);
        }
      }
    }
    // sanity check
    const matrix1 = angles.toMatrix3d();
    return matrix.maxDiff(matrix1) < Geometry.smallAngleRadians ? angles : undefined;
  }
}
