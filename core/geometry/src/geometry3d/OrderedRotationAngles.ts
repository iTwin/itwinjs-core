/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { AxisOrder } from "../Geometry";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";

/** OrderedRotationAngles represents a non-trivial rotation using three simple axis rotation angles, and an order in which to apply them. */
export class OrderedRotationAngles {
  private _x: Angle;
  private _y: Angle;
  private _z: Angle;
  private _order: AxisOrder;
  private static _sTreatVectorsAsColumns: boolean = false;

  private constructor(x: Angle, y: Angle, z: Angle, axisOrder: AxisOrder) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = axisOrder;
  }

  // Getters and setters
  public get order(): AxisOrder { return this._order; }
  public get xAngle(): Angle { return this._x.clone(); }
  public get yAngle(): Angle { return this._y.clone(); }
  public get zAngle(): Angle { return this._z.clone(); }
  public get xDegrees(): number { return this._x.degrees; }
  public get xRadians(): number { return this._x.radians; }
  public get yDegrees(): number { return this._y.degrees; }
  public get yRadians(): number { return this._y.radians; }
  public get zDegrees(): number { return this._z.degrees; }
  public get zRadians(): number { return this._z.radians; }
  public static get treatVectorsAsColumns(): boolean { return OrderedRotationAngles._sTreatVectorsAsColumns; }
  public static set treatVectorsAsColumns(value: boolean) { OrderedRotationAngles._sTreatVectorsAsColumns = value; }

  /** Create an OrderedRotationAngles from three angles and an ordering in which to apply them when rotating.
   * @param xRotation rotation around x
   * @param yRotation rotation around y
   * @param zRotation rotation around z
   * @param axisOrder right to left order of axis names identifies the order that rotations are applied to xyz data.
   */
  public static createAngles(xRotation: Angle, yRotation: Angle, zRotation: Angle, order: AxisOrder, result?: OrderedRotationAngles): OrderedRotationAngles {
    if (result) {
      result._x.setFrom(xRotation);
      result._y.setFrom(yRotation);
      result._z.setFrom(zRotation);
      result._order = order;
      return result;
    }
    return new OrderedRotationAngles(xRotation.clone(), yRotation.clone(), zRotation.clone(), order);
  }

  /** Create an OrderedRotationAngles from three angles (in radians) and an ordering in which to apply them when rotating. */
  public static createRadians(xRadians: number, yRadians: number, zRadians: number, order: AxisOrder, result?: OrderedRotationAngles): OrderedRotationAngles {
    if (result) {
      result._x.setRadians(xRadians);
      result._y.setRadians(yRadians);
      result._z.setRadians(zRadians);
      result._order = order;
      return result;
    }
    return new OrderedRotationAngles(Angle.createRadians(xRadians), Angle.createRadians(yRadians), Angle.createRadians(zRadians), order);
  }

  /** Create an OrderedRotationAngles from three angles (in degrees) and an ordering in which to apply them when rotating. */
  public static createDegrees(xDegrees: number, yDegrees: number, zDegrees: number, order: AxisOrder, result?: OrderedRotationAngles): OrderedRotationAngles {
    if (result) {
      result._x.setDegrees(xDegrees);
      result._y.setDegrees(yDegrees);
      result._z.setDegrees(zDegrees);
      result._order = order;
      return result;
    }
    return new OrderedRotationAngles(Angle.createDegrees(xDegrees), Angle.createDegrees(yDegrees), Angle.createDegrees(zDegrees), order);
  }

  /** Create an OrderedRotationAngles from a 3x3 rotational matrix, given the ordering of axis rotations that the matrix derives from. */
  public static createFromMatrix3d(matrix: Matrix3d, order: AxisOrder, result?: OrderedRotationAngles): OrderedRotationAngles {

    let m11 = matrix.coffs[0], m12 = matrix.coffs[3], m13 = matrix.coffs[6];
    let m21 = matrix.coffs[1], m22 = matrix.coffs[4], m23 = matrix.coffs[7];
    let m31 = matrix.coffs[2], m32 = matrix.coffs[5], m33 = matrix.coffs[8];

    if (OrderedRotationAngles.treatVectorsAsColumns) {
      // the formulas are from row order .. flip the mIJ
      m11 = matrix.coffs[0], m12 = matrix.coffs[1], m13 = matrix.coffs[2];
      m21 = matrix.coffs[3], m22 = matrix.coffs[4], m23 = matrix.coffs[5];
      m31 = matrix.coffs[6], m32 = matrix.coffs[7], m33 = matrix.coffs[8];

    }

    let xRad: number;
    let yRad: number;
    let zRad: number;

    switch (order) {
      case AxisOrder.XYZ: {
        yRad = Math.asin(Math.max(-1, Math.min(1, m13)));

        if (Math.abs(m13) < 0.99999) {
          xRad = Math.atan2(- m23, m33);
          zRad = Math.atan2(- m12, m11);
        } else {
          xRad = Math.atan2(m32, m22);
          zRad = 0;
        }
        break;
      } case AxisOrder.YXZ: {
        xRad = Math.asin(-Math.max(-1, Math.min(1, m23)));

        if (Math.abs(m23) < 0.99999) {
          yRad = Math.atan2(m13, m33);
          zRad = Math.atan2(m21, m22);
        } else {
          yRad = Math.atan2(-m31, m11);
          zRad = 0;
        }
        break;
      } case AxisOrder.ZXY: {
        xRad = Math.asin(Math.max(-1, Math.min(1, m32)));

        if (Math.abs(m32) < 0.99999) {
          yRad = Math.atan2(-m31, m33);
          zRad = Math.atan2(-m12, m22);
        } else {
          yRad = 0;
          zRad = Math.atan2(m21, m11);
        }
        break;
      } case AxisOrder.ZYX: {
        yRad = -Math.asin(Math.max(-1, Math.min(1, m31)));

        if (Math.abs(m31) < 0.99999) {
          xRad = Math.atan2(m32, m33);
          zRad = Math.atan2(m21, m11);
        } else {
          xRad = 0;
          zRad = Math.atan2(-m12, m22);
        }
        break;
      } case AxisOrder.YZX: {
        zRad = Math.asin(Math.max(-1, Math.min(1, m21)));

        if (Math.abs(m21) < 0.99999) {
          xRad = Math.atan2(-m23, m22);
          yRad = Math.atan2(-m31, m11);
        } else {
          xRad = 0;
          yRad = Math.atan2(m13, m33);
        }
        break;
      } case AxisOrder.XZY: {
        zRad = -Math.asin(Math.max(-1, Math.min(1, m12)));

        if (Math.abs(m12) < 0.99999) {
          xRad = Math.atan2(m32, m22);
          yRad = Math.atan2(m13, m11);
        } else {
          xRad = Math.atan2(-m23, m33);
          yRad = 0;
        }
        break;
      } default: {
        xRad = yRad = zRad = 0;
      }
    }
    if (OrderedRotationAngles.treatVectorsAsColumns)
      return OrderedRotationAngles.createRadians(-xRad, -yRad, -zRad, order, result);

    return OrderedRotationAngles.createRadians(xRad, yRad, zRad, order, result);
  }

  /** Create a 3x3 rotational matrix from this OrderedRotationAngles. */
  public toMatrix3d(result?: Matrix3d): Matrix3d {
    const rot = result !== undefined ? result : new Matrix3d();
    const axisOrder = this.order;
    const x = this.xAngle, y = this.yAngle, z = this.zAngle;
    const a = x.cos(); let b = x.sin();
    const c = y.cos(); let d = y.sin();
    const e = z.cos(); let f = z.sin();
    if (OrderedRotationAngles.treatVectorsAsColumns) {
      b = -b;
      d = -d;
      f = -f;
    }

    if (axisOrder === AxisOrder.XYZ) {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      rot.setRowValues(
        c * e, af + be * d, bf - ae * d,
        -c * f, ae - bf * d, be + af * d,
        d, -b * c, a * c,
      );
    } else if (axisOrder === AxisOrder.YXZ) {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      rot.setRowValues(
        ce + df * b, a * f, cf * b - de,
        de * b - cf, a * e, df + ce * b,
        a * d, -b, a * c,
      );
    } else if (axisOrder === AxisOrder.ZXY) {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      rot.setRowValues(
        ce - df * b, cf + de * b, -a * d,
        -a * f, a * e, b,
        de + cf * b, df - ce * b, a * c,
      );
    } else if (axisOrder === AxisOrder.ZYX) {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      rot.setRowValues(
        c * e, c * f, -d,
        be * d - af, bf * d + ae, b * c,
        ae * d + bf, af * d - be, a * c,
      );
    } else if (axisOrder === AxisOrder.YZX) {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      rot.setRowValues(
        c * e, f, -d * e,
        bd - ac * f, a * e, ad * f + bc,
        bc * f + ad, -b * e, ac - bd * f,
      );
    } else if (axisOrder === AxisOrder.XZY) {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      rot.setRowValues(
        c * e, ac * f + bd, bc * f - ad,
        -f, a * e, b * e,
        d * e, ad * f - bc, bd * f + ac,
      );
    }
    if (OrderedRotationAngles.treatVectorsAsColumns)
      rot.transposeInPlace();

    return rot;
  }
}
