/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { AxisOrder, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";

/* cspell:word cxcz, cxsz, cxcy, cxsy, sxcz, sxsz, sxcy, sxsy, cycz, cysz, sycz, sysz */

/**
 * Represents a non-trivial rotation using three simple axis rotation angles and an order in which to apply them.
 * * This class accommodates application-specific interpretation of "multiplying 3 rotation matrices" with regard to
 *   * Whether a "vector" is a "row" or a "column"
 *   * The order in which the X,Y,Z rotations are applied.
 * * This class bakes in angle rotation directions via create functions (i.e., createRadians, createDegrees, and
 * createAngles) so you can define each of the 3 rotations to be clockwise or counterclockwise. The default
 * rotation is counterclockwise.
 * * Within the imodel geometry library, the preferred rotation order is encapsulated in `YawPitchRollAngles`.
 * @alpha
 */
export class OrderedRotationAngles {
  /** rotation around x */
  private _x: Angle;
  /** rotation around y */
  private _y: Angle;
  /** rotation around z */
  private _z: Angle;
  /** rotation order. For example XYZ means to rotate around x axis first, then y axis, and finally Z axis */
  private _order: AxisOrder;
  /** treat vectors as matrix columns */
  private static _sTreatVectorsAsColumns: boolean = false;
  /** constructor */
  private constructor(x: Angle, y: Angle, z: Angle, axisOrder: AxisOrder) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = axisOrder;
  }
  /** (Property accessor) Return the `AxisOrder` controlling matrix multiplication order. */
  public get order(): AxisOrder {
    return this._order;
  }
  /** (Property accessor) Return the strongly typed angle of rotation around x. */
  public get xAngle(): Angle {
    return this._x.clone();
  }
  /** (Property accessor) Return the strongly typed angle of rotation around y. */
  public get yAngle(): Angle {
    return this._y.clone();
  }
  /** (Property accessor) Return the strongly typed angle of rotation around z. */
  public get zAngle(): Angle {
    return this._z.clone();
  }
  /** (Property accessor) Return the angle of rotation around x, in degrees */
  public get xDegrees(): number {
    return this._x.degrees;
  }
  /** (Property accessor) Return the angle of rotation around y, in degrees */
  public get xRadians(): number {
    return this._x.radians;
  }
  /** (Property accessor) Return the angle of rotation around z, in degrees */
  public get yDegrees(): number {
    return this._y.degrees;
  }
  /** (Property accessor) Return the angle of rotation around x, in radians */
  public get yRadians(): number {
    return this._y.radians;
  }
  /** (Property accessor) Return the angle of rotation around y, in radians */
  public get zDegrees(): number {
    return this._z.degrees;
  }
  /** (Property accessor) Return the angle of rotation around z, in radians */
  public get zRadians(): number {
    return this._z.radians;
  }
  /** The flag controlling whether vectors are treated as rows or as columns */
  public static get treatVectorsAsColumns(): boolean {
    return OrderedRotationAngles._sTreatVectorsAsColumns;
  }
  public static set treatVectorsAsColumns(value: boolean) {
    OrderedRotationAngles._sTreatVectorsAsColumns = value;
  }
  /**
   * Create an OrderedRotationAngles from three angles (in radians), an ordering in which to apply them when
   * rotating, and a flag triple controlling whether direction of x,y,z is clockwise or counterclockwise.
   * @param xRadians rotation around x
   * @param yRadians rotation around y
   * @param zRadians rotation around z
   * @param order left to right order of axis names identifies the order that rotations are applied.
   * For example XYZ means to rotate around x axis first, then y axis, and finally Z axis.
   * * Note that rotation order is reverse of rotation matrix multiplication so for XYZ the rotation
   * matrix multiplication would be zRot*yRot*xRot
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/CubeRotationAroundStandardAxes
   * @param xyzRotationIsClockwise the flags controlling whether direction of x,y,z is clockwise or counterclockwise.
   * rotation direction of x,y,z: true ---> clockwise - false ---> counterclockwise.
   * * if xyzRotationIsClockwise is undefined it's set to [false, false, false].
   * @param result caller-allocated OrderedRotationAngles
   */
  public static createRadians(xRadians: number, yRadians: number, zRadians: number, order: AxisOrder,
    xyzRotationIsClockwise?: [boolean, boolean, boolean], result?: OrderedRotationAngles): OrderedRotationAngles {
    if (!xyzRotationIsClockwise) {
      xyzRotationIsClockwise = [false, false, false];
    }
    const xRadian = xyzRotationIsClockwise[0] ? -xRadians : xRadians;
    const yRadian = xyzRotationIsClockwise[1] ? -yRadians : yRadians;
    const zRadian = xyzRotationIsClockwise[2] ? -zRadians : zRadians;
    if (result) {
      result._x.setRadians(xRadian);
      result._y.setRadians(yRadian);
      result._z.setRadians(zRadian);
      result._order = order;
      return result;
    }
    return new OrderedRotationAngles(
      Angle.createRadians(xRadian),
      Angle.createRadians(yRadian),
      Angle.createRadians(zRadian),
      order,
    );
  }
  /**
   * Create an OrderedRotationAngles from three angles (in degrees) and an ordering in which to apply
   * them when rotating.
   * @param xDegrees rotation around x
   * @param yDegrees rotation around y
   * @param zDegrees rotation around z
   * @param order left to right order of axis names identifies the order that rotations are applied.
   * For example XYZ means to rotate around x axis first, then y axis, and finally Z axis.
   * * Note that rotation order is reverse of rotation matrix multiplication so for XYZ the rotation
   * matrix multiplication would be zRot*yRot*xRot
   * @param xyzRotationIsClockwise the flags controlling whether direction of x,y,z is clockwise or counterclockwise.
   * rotation direction of x,y,z: true ---> clockwise - false ---> counterclockwise.
   * * if xyzRotationIsClockwise is undefined it's set to [false, false, false].
   * @param result caller-allocated OrderedRotationAngles
   */
  public static createDegrees(xDegrees: number, yDegrees: number, zDegrees: number, order: AxisOrder,
    xyzRotationIsClockwise?: [boolean, boolean, boolean], result?: OrderedRotationAngles): OrderedRotationAngles {
    return OrderedRotationAngles.createRadians(
      Angle.degreesToRadians(xDegrees),
      Angle.degreesToRadians(yDegrees),
      Angle.degreesToRadians(zDegrees),
      order,
      xyzRotationIsClockwise,
      result,
    );
  }
  /**
   * Create an OrderedRotationAngles from three angles, an ordering in which to apply them when rotating,
   * and a flag triple controlling whether direction of x,y,z is clockwise or counterclockwise.
   * @param xRotation rotation around x
   * @param yRotation rotation around y
   * @param zRotation rotation around z
   * @param order left to right order of axis names identifies the order that rotations are applied
   * For example XYZ means to rotate around x axis first, then y axis, and finally Z axis.
   * * Note that rotation order is reverse of rotation matrix multiplication so for XYZ the rotation
   * matrix multiplication would be zRot*yRot*xRot
   * @param xyzRotationIsClockwise the flags controlling whether direction of x,y,z is clockwise or counterclockwise.
   * rotation direction of x,y,z: true ---> clockwise - false ---> counterclockwise.
   * * if xyzRotationIsClockwise is undefined it's set to [false, false, false].
   * @param result caller-allocated OrderedRotationAngles
   */
  public static createAngles(xRotation: Angle, yRotation: Angle, zRotation: Angle, order: AxisOrder,
    xyzRotationIsClockwise?: [boolean, boolean, boolean], result?: OrderedRotationAngles): OrderedRotationAngles {
    return OrderedRotationAngles.createRadians(
      xRotation.radians,
      yRotation.radians,
      zRotation.radians,
      order,
      xyzRotationIsClockwise,
      result,
    );
  }
  /**
   * Create an OrderedRotationAngles from a 3x3 rotational matrix, given the ordering of axis rotations
   * that the matrix derives from.
   * * This function creates an OrderedRotationAngles with default angle rotation directions, i.e.,
   * it assumes all x, y, and z rotations are counterclockwise.
   * * In the failure case the method's return value is `undefined`.
   * * In the failure case, if the optional result was supplied, that result will nonetheless be filled with
   * a set of angles.
   */
  public static createFromMatrix3d(matrix: Matrix3d, order: AxisOrder, result?: OrderedRotationAngles):
    OrderedRotationAngles | undefined {
    // treat vector as columns
    let m11 = matrix.coffs[0], m12 = matrix.coffs[1], m13 = matrix.coffs[2];
    let m21 = matrix.coffs[3], m22 = matrix.coffs[4], m23 = matrix.coffs[5];
    let m31 = matrix.coffs[6], m32 = matrix.coffs[7], m33 = matrix.coffs[8];
    // treat vector as rows
    if (!OrderedRotationAngles.treatVectorsAsColumns) {
      m11 = matrix.coffs[0], m12 = matrix.coffs[3], m13 = matrix.coffs[6];
      m21 = matrix.coffs[1], m22 = matrix.coffs[4], m23 = matrix.coffs[7];
      m31 = matrix.coffs[2], m32 = matrix.coffs[5], m33 = matrix.coffs[8];
    }

    let xRad: number;
    let yRad: number;
    let zRad: number;

    switch (order) {
      case AxisOrder.XYZ: {
        yRad = Math.asin(Math.max(-1, Math.min(1, -m31))); // limit asin domain to [-1,1]

        if (Math.abs(m31) < 0.99999) {
          xRad = Math.atan2(m32, m33);
          zRad = Math.atan2(m21, m11);
        } else {
          /**
           * If Math.abs(m31) = 1 then yRad = +-90 degrees and therefore, we have a gimbal lock.
           * This means xRad and zRad can be anything as long as their sum xRad + zRad is constant.
           * so we can pick zRad = 0 and calculate xRad (or pick xRad = 0 and calculate zRad).
           * Therefore, rotation matrix becomes
           *        Matrix3d.createRowValues(
           *             0, +-sx, +-cx,
           *             0, cx, -sx,
           *             -+1, 0, 0
           *        );
           * Math details can be found
           * https://en.wikipedia.org/wiki/Gimbal_lock#Loss_of_a_degree_of_freedom_with_Euler_angles
           */
          xRad = Math.atan2(-m23, m22);
          zRad = 0;
        }
        break;
      } case AxisOrder.YXZ: {
        xRad = Math.asin(Math.max(-1, Math.min(1, m32))); // limit asin domain to [-1,1]

        if (Math.abs(m32) < 0.99999) {
          yRad = Math.atan2(-m31, m33);
          zRad = Math.atan2(-m12, m22);
        } else {
          yRad = Math.atan2(m13, m11);
          zRad = 0;
        }
        break;
      } case AxisOrder.ZXY: {
        xRad = Math.asin(Math.max(-1, Math.min(1, -m23))); // limit asin domain to [-1,1]

        if (Math.abs(m23) < 0.99999) {
          yRad = Math.atan2(m13, m33);
          zRad = Math.atan2(m21, m22);
        } else {
          yRad = 0;
          zRad = Math.atan2(-m12, m11);
        }
        break;
      } case AxisOrder.ZYX: {
        yRad = Math.asin(Math.max(-1, Math.min(1, m13))); // limit asin domain to [-1,1]

        if (Math.abs(m13) < 0.99999) {
          xRad = Math.atan2(-m23, m33);
          zRad = Math.atan2(-m12, m11);
        } else {
          xRad = 0;
          zRad = Math.atan2(m21, m22);
        }
        break;
      } case AxisOrder.YZX: {
        zRad = Math.asin(Math.max(-1, Math.min(1, -m12))); // limit asin domain to [-1,1]

        if (Math.abs(m12) < 0.99999) {
          xRad = Math.atan2(m32, m22);
          yRad = Math.atan2(m13, m11);
        } else {
          xRad = 0;
          yRad = Math.atan2(-m31, m33);
        }
        break;
      } case AxisOrder.XZY: {
        zRad = Math.asin(Math.max(-1, Math.min(1, m21))); // limit asin domain to [-1,1]

        if (Math.abs(m21) < 0.99999) {
          xRad = Math.atan2(-m23, m22);
          yRad = Math.atan2(-m31, m11);
        } else {
          xRad = Math.atan2(m32, m33);
          yRad = 0;
        }
        break;
      } default: {
        xRad = yRad = zRad = 0;
      }
    }
    const xyzRotationIsClockwise: [boolean, boolean, boolean] = [false, false, false];
    const angles = OrderedRotationAngles.createRadians(xRad, yRad, zRad, order, xyzRotationIsClockwise, result);
    // sanity check
    const matrix1 = angles.toMatrix3d();
    /**
     * Below tolerance loosened to allow sanity check to pass for
     *
     * OrderedRotationAngles.createFromMatrix3d(
     *       OrderedRotationAngles.createDegrees(0, 89.999, 0.001, AxisOrder.XYZ).toMatrix3d(),
     *       AxisOrder.XYZ
     * );
     *
     * with treatVectorsAsColumns = true.
     */
    return (matrix.maxDiff(matrix1) < 10 * Geometry.smallFraction) ? angles : undefined;
  }
  /**
   * Create a 3x3 rotational matrix from this OrderedRotationAngles.
   ** math details can be found at docs/learning/geometry/Angle.md
   **/
  public toMatrix3d(result?: Matrix3d): Matrix3d {
    const rot = (result !== undefined) ? result : new Matrix3d();
    const axisOrder = this.order;
    const x = this.xAngle, y = this.yAngle, z = this.zAngle;

    const cx = x.cos(), sx = x.sin();
    const cy = y.cos(), sy = y.sin();
    const cz = z.cos(), sz = z.sin();

    const cxcz = cx * cz, cxsz = cx * sz, cxcy = cx * cy, cxsy = cx * sy;
    const sxcz = sx * cz, sxsz = sx * sz, sxcy = sx * cy, sxsy = sx * sy;
    const cycz = cy * cz, cysz = cy * sz, sycz = sy * cz, sysz = sy * sz;

    // the rotation matrix we build below is created using column-based base rotation matrixes
    if (axisOrder === AxisOrder.XYZ) {
      rot.setRowValues(
        cy * cz, sxcz * sy - cxsz, cxcz * sy + sxsz,
        cy * sz, cxcz + sxsz * sy, cxsz * sy - sxcz,
        -sy, sx * cy, cx * cy,
      );
    } else if (axisOrder === AxisOrder.YXZ) {
      rot.setRowValues(
        cycz - sysz * sx, -cx * sz, cysz * sx + sycz,
        sycz * sx + cysz, cx * cz, sysz - cycz * sx,
        -cx * sy, sx, cx * cy,
      );
    } else if (axisOrder === AxisOrder.ZXY) {
      rot.setRowValues(
        cycz + sysz * sx, sycz * sx - cysz, cx * sy,
        cx * sz, cx * cz, -sx,
        cysz * sx - sycz, cycz * sx + sysz, cx * cy,
      );
    } else if (axisOrder === AxisOrder.ZYX) {
      rot.setRowValues(
        cy * cz, -cy * sz, sy,
        sxcz * sy + cxsz, cxcz - sxsz * sy, -sx * cy,
        sxsz - cxcz * sy, sxcz + cxsz * sy, cx * cy,
      );
    } else if (axisOrder === AxisOrder.YZX) {
      rot.setRowValues(
        cy * cz, -sz, sy * cz,
        sxsy + cxcy * sz, cx * cz, cxsy * sz - sxcy,
        sxcy * sz - cxsy, sx * cz, cxcy + sxsy * sz,
      );
    } else if (axisOrder === AxisOrder.XZY) {
      rot.setRowValues(
        cy * cz, sxsy - cxcy * sz, cxsy + sxcy * sz,
        sz, cx * cz, -sx * cz,
        -sy * cz, sxcy + cxsy * sz, cxcy - sxsy * sz,
      );
    } else {
      rot.setIdentity();
    }
    // if we need row-based rotation matrix, we transpose the rotation matrix
    if (!OrderedRotationAngles.treatVectorsAsColumns)
      rot.transposeInPlace();

    return rot;
  }
}
