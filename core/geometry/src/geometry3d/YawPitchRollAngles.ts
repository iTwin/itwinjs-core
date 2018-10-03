/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { AngleProps, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { Transform } from "./Transform";
import { Matrix3d } from "./Matrix3d";
import { Point3d } from "./Point3dVector3d";
/** The properties that define [[YawPitchRollAngles]]. */
export interface YawPitchRollProps {
  yaw?: AngleProps;
  pitch?: AngleProps;
  roll?: AngleProps;
}

/** Three angles that determine the orientation of an object in space. Sometimes referred to as [Tait–Bryan angles](https://en.wikipedia.org/wiki/Euler_angles). */
export class YawPitchRollAngles {
  public yaw: Angle;
  public pitch: Angle;
  public roll: Angle;
  constructor(yaw: Angle = Angle.zero(), pitch: Angle = Angle.zero(), roll: Angle = Angle.zero()) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
  }
  /** Freeze this YawPitchRollAngles */
  public freeze() { Object.freeze(this.yaw); Object.freeze(this.pitch); Object.freeze(this.roll); }
  /** constructor for YawPitchRollAngles with angles in degrees. */
  public static createDegrees(yawDegrees: number, pitchDegrees: number, rollDegrees: number): YawPitchRollAngles {
    return new YawPitchRollAngles(Angle.createDegrees(yawDegrees), Angle.createDegrees(pitchDegrees), Angle.createDegrees(rollDegrees));
  }
  /** constructor for YawPitchRollAngles with angles in radians. */
  public static createRadians(yawRadians: number, pitchRadians: number, rollRadians: number): YawPitchRollAngles {
    return new YawPitchRollAngles(Angle.createRadians(yawRadians), Angle.createRadians(pitchRadians), Angle.createRadians(rollRadians));
  }
  public static fromJSON(json?: YawPitchRollProps): YawPitchRollAngles {
    json = json ? json : {};
    return new YawPitchRollAngles(Angle.fromJSON(json.yaw), Angle.fromJSON(json.pitch), Angle.fromJSON(json.roll));
  }
  public setFromJSON(json?: YawPitchRollProps): void {
    json = json ? json : {};
    this.yaw = Angle.fromJSON(json.yaw);
    this.pitch = Angle.fromJSON(json.pitch);
    this.roll = Angle.fromJSON(json.roll);
  }
  /** Convert to a JSON object of form { pitch: 20 , roll: 29.999999999999996 , yaw: 10 }. Any values that are exactly zero (with tolerance `Geometry.smallAngleRadians`) are omitted. */
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
   * * Compare angles between `this` and `other`.
   * * Comparisons are via `isAlmostEqualAllowPeriodShift`.
   * @param other YawPitchRollAngles source
   */
  public isAlmostEqual(other: YawPitchRollAngles) {
    return this.yaw.isAlmostEqualAllowPeriodShift(other.yaw)
      && this.pitch.isAlmostEqualAllowPeriodShift(other.pitch)
      && this.roll.isAlmostEqualAllowPeriodShift(other.roll);
  }
  /**
   * Make a copy of this YawPitchRollAngles.
   */
  public clone() { return new YawPitchRollAngles(this.yaw.clone(), this.pitch.clone(), this.roll.clone()); }
  /**
   * Expand the angles into a (rigid rotation) matrix.
   *
   * * The returned matrix is "rigid" -- unit length rows and columns, and its transpose is its inverse.
   * * The "rigid" matrix is always a right handed coordinate system.
   * @param result optional pre-allocated `Matrix3d`
   */
  public toMatrix3d(result?: Matrix3d) {
    const c0 = Math.cos(this.yaw.radians);
    const s0 = Math.sin(this.yaw.radians);
    const c1 = Math.cos(this.pitch.radians);
    const s1 = Math.sin(this.pitch.radians);
    const c2 = Math.cos(this.roll.radians);
    const s2 = Math.sin(this.roll.radians);
    return Matrix3d.createRowValues(c0 * c1, -(s0 * c2 + c0 * s1 * s2), (s0 * s2 - c0 * s1 * c2), s0 * c1, (c0 * c2 - s0 * s1 * s2), -(c0 * s2 + s0 * s1 * c2), s1, c1 * s2, c1 * c2, result);
  }
  /** @returns Return the largest angle in radians */
  public maxAbsRadians(): number {
    return Geometry.maxAbsXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }
  /** Return the sum of the angles in squared radians */
  public sumSquaredRadians(): number {
    return Geometry.hypotenuseSquaredXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }
  /** @returns true if the rotation is 0 */
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
  /** Return the largest difference of angles (in radians) between this and other */
  public maxDiffRadians(other: YawPitchRollAngles): number {
    return Math.max(this.yaw.radians - other.yaw.radians, this.pitch.radians - other.pitch.radians, this.roll.radians - other.roll.radians);
  }
  /** Return the largest angle in degrees. */
  public maxAbsDegrees(): number { return Geometry.maxAbsXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees); }
  /** Return the sum of squared angles in degrees. */
  public sumSquaredDegrees(): number { return Geometry.hypotenuseSquaredXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees); }
  /** Return an object from a Transform as an origin and YawPitchRollAngles. */
  public static tryFromTransform(transform: Transform): {
    origin: Point3d;
    angles: YawPitchRollAngles | undefined;
  } {
    // bundle up the transform's origin with the angle data extracted from the transform
    return {
      angles: YawPitchRollAngles.createFromMatrix3d(transform.matrix),
      origin: Point3d.createFrom(transform.origin),
    };
  }
  /** Attempts to create a YawPitchRollAngles object from an Matrix3d
   * * This conversion fails if the matrix is not rigid (unit rows and columns, transpose is inverse)
   * * In the failure case the method's return value is `undefined`.
   * * In the failure case, if the optional result was supplied, that result will nonetheless be filled with a set of angles.
   */
  public static createFromMatrix3d(matrix: Matrix3d, result?: YawPitchRollAngles): YawPitchRollAngles | undefined {
    const s1 = matrix.at(2, 0);
    const c1 = Math.sqrt(matrix.at(2, 1) * matrix.at(2, 1) + matrix.at(2, 2) * matrix.at(2, 2));
    const pitchA = Angle.createAtan2(s1, c1); // with positive cosine
    const pitchB = Angle.createAtan2(s1, -c1); // with negative cosine
    const angles = result ? result : new YawPitchRollAngles(); // default undefined . . .
    if (c1 < Geometry.smallAngleRadians) { // This is a radians test !!!
      angles.yaw = Angle.createAtan2(-matrix.at(0, 1), matrix.at(1, 1));
      angles.pitch = pitchA;
      angles.roll = Angle.createRadians(0.0);
    } else {
      const yawA = Angle.createAtan2(matrix.at(1, 0), matrix.at(0, 0));
      const rollA = Angle.createAtan2(matrix.at(2, 1), matrix.at(2, 2));
      const yawB = Angle.createAtan2(-matrix.at(1, 0), -matrix.at(0, 0));
      const rollB = Angle.createAtan2(-matrix.at(2, 1), -matrix.at(2, 2));
      const yprA = new YawPitchRollAngles(yawA, pitchA, rollA);
      const yprB = new YawPitchRollAngles(yawB, pitchB, rollB);
      const absFactor = 0.95;
      const radiansA = yprA.maxAbsRadians();
      const radiansB = yprB.maxAbsRadians();
      if (radiansA < absFactor * radiansB) {
        angles.setFrom(yprA);
      } else if (radiansB < absFactor * radiansA) {
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
    const matrix1 = angles.toMatrix3d();
    return matrix.maxDiff(matrix1) < Geometry.smallAngleRadians ? angles : undefined;
  }
}
