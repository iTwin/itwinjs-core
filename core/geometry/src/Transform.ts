/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Geometry, Angle, AxisOrder, AxisIndex, BeJSONFunctions, StandardViewIndex } from "./Geometry";
import { Point4d } from "./numerics/Geometry4d";
import { Range3d } from "./Range";
import { Point2d, Point3d, Vector3d, XYAndZ } from "./PointVector";
import { XAndY, XYZ, RotMatrixProps, TransformProps } from "./PointVector";
/* tslint:disable:jsdoc-format*/
/** A RotMatrix is tagged indicating one of the following states:
 * * unknown: it is not know if the matrix is invertible.
 * * inverseStored: the matrix has its inverse stored
 * * singular: the matrix is known to be singular.
 */
export enum InverseMatrixState {
  unknown,
  inverseStored,
  singular,
}
function loadMatrix(dest: Float64Array,
  a00: number, a01: number, a02: number,
  a10: number, a11: number, a12: number,
  a20: number, a21: number, a22: number) {
  dest[0] = a00; dest[1] = a01; dest[2] = a02;
  dest[3] = a10; dest[4] = a11; dest[5] = a12;
  dest[6] = a20; dest[7] = a21; dest[8] = a22;
}

/**
 * * multiply 3x3 matrix `a*b`, store in c.
 * * All params assumed length 9, allocated by caller.
 * * c may alias either input.
 */
function multiplyMatrixMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
  if (!result) result = new Float64Array(9);
  loadMatrix(result,
    (a[0] * b[0] + a[1] * b[3] + a[2] * b[6]),
    (a[0] * b[1] + a[1] * b[4] + a[2] * b[7]),
    (a[0] * b[2] + a[1] * b[5] + a[2] * b[8]),
    (a[3] * b[0] + a[4] * b[3] + a[5] * b[6]),
    (a[3] * b[1] + a[4] * b[4] + a[5] * b[7]),
    (a[3] * b[2] + a[4] * b[5] + a[5] * b[8]),
    (a[6] * b[0] + a[7] * b[3] + a[8] * b[6]),
    (a[6] * b[1] + a[7] * b[4] + a[8] * b[7]),
    (a[6] * b[2] + a[7] * b[5] + a[8] * b[8]));
  return result;
}

/**
 * * multiply 3x3 matrix `a*bTranspose`, store in c.
 * * All params assumed length 9, allocated by caller.
 * * c may alias either input.
 */
function multiplyMatrixMatrixTranspose(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
  if (!result) result = new Float64Array(9);
  loadMatrix(result,
    (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
    (a[0] * b[3] + a[1] * b[4] + a[2] * b[5]),
    (a[0] * b[6] + a[1] * b[7] + a[2] * b[8]),
    (a[3] * b[0] + a[4] * b[1] + a[5] * b[2]),
    (a[3] * b[3] + a[4] * b[4] + a[5] * b[5]),
    (a[3] * b[6] + a[4] * b[7] + a[5] * b[8]),
    (a[6] * b[0] + a[7] * b[1] + a[8] * b[2]),
    (a[6] * b[3] + a[7] * b[4] + a[8] * b[5]),
    (a[6] * b[6] + a[7] * b[7] + a[8] * b[8]));
  return result;
}

/** transpose 3x3 coefficients in place */
function transpose3x3InPlace(a: Float64Array) {
  let q = a[1]; a[1] = a[3]; a[3] = q;
  q = a[2]; a[2] = a[6]; a[6] = q;
  q = a[5]; a[5] = a[7]; a[7] = q;
}
/** transpose 3x3 coefficients in place */
function copy3x3Transposed(a: Float64Array, dest?: Float64Array): Float64Array {
  if (dest === a) {
    transpose3x3InPlace(a);
  } else {
    if (!dest)
      dest = new Float64Array(9);
    dest[0] = a[0]; dest[1] = a[3]; dest[2] = a[6];
    dest[3] = a[1]; dest[4] = a[4]; dest[5] = a[7];
    dest[6] = a[2]; dest[7] = a[5]; dest[8] = a[8];
  }
  return dest;
}

/**
 * * multiply 3x3 matrix `a*bTranspose`, store in c.
 * * All params assumed length 9, allocated by caller.
 * * c may alias either input.
 */
function multiplyMatrixTransposeMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
  if (!result) result = new Float64Array(9);
  loadMatrix(result,
    (a[0] * b[0] + a[3] * b[3] + a[6] * b[6]),
    (a[0] * b[1] + a[3] * b[4] + a[6] * b[7]),
    (a[0] * b[2] + a[3] * b[5] + a[6] * b[8]),
    (a[1] * b[0] + a[4] * b[3] + a[7] * b[6]),
    (a[1] * b[1] + a[4] * b[4] + a[7] * b[7]),
    (a[1] * b[2] + a[4] * b[5] + a[7] * b[8]),
    (a[2] * b[0] + a[5] * b[3] + a[8] * b[6]),
    (a[2] * b[1] + a[5] * b[4] + a[8] * b[7]),
    (a[2] * b[2] + a[5] * b[5] + a[8] * b[8]));
  return result;
}

/** A RotMatrix (short for RotationMatrix) is a 3x3 matrix.
 * * The name from common use to hold a rigid body rotation,, but its 3x3 contents can
 * also hold scaling and skewing.
 * * The 9 entries are stored in row-major order in the coffs array.
 * * If the matrix inverse is known it is stored in the inverseCoffs array.
 * * The inverse status (unknown, inverseStored, singular) status is indicated by the inverseState property.
 * * constructions method that are able to determine the inverse store it immediately and
 *     note that in the inverseState.
 * * constructions (e.g. createRowValues) for which the inverse is not immediately known mark the
 *     inverseState as unknown.
 * * Later queries for the inverse trigger full computation if needed at that time.
 * * Most matrix queries are present with both "column" and "row" variants.
 * * Usage elsewhere in the library is typically "column" based.  For example, in a Transform
 *     that carries a coordinate frame the matrix columns are the unit vectors for the axes.
 */
export class RotMatrix implements BeJSONFunctions {
  public static useCachedInverse = true;  // cached inverse can be suppressed for testing.
  public static numUseCache = 0;
  public static numComputeCache = 0;
  public coffs: Float64Array;
  public inverseCoffs: Float64Array | undefined;
  public inverseState: InverseMatrixState;
  public static _identity: RotMatrix;

  /** The identity RotMatrix. Value is frozen and cannot be modified. */
  public static get identity(): RotMatrix {
    if (undefined === this._identity) {
      this._identity = RotMatrix.createIdentity();
      this._identity.freeze();
    }

    return this._identity;
  }

  /** Freeze this RotMatrix. */
  public freeze() { this.computeCachedInverse(true); Object.freeze(this); }
  /**
   *
   * @param coffs optional coefficient array.  This is captured.
   */
  public constructor(coffs?: Float64Array) {
    this.coffs = coffs ? coffs : new Float64Array(9);
    this.inverseCoffs = undefined;
    this.inverseState = InverseMatrixState.unknown;
  }
  /** Return a json object containing the 9 numeric entries as a single array in row major order,
   * `[ [1, 2, 3],[ 4, 5, 6], [7, 8, 9] ]`
   * */
  public toJSON(): RotMatrixProps {
    return [[this.coffs[0], this.coffs[1], this.coffs[2]],
    [this.coffs[3], this.coffs[4], this.coffs[5]],
    [this.coffs[6], this.coffs[7], this.coffs[8]]];
  }

  public setFromJSON(json?: RotMatrixProps): void {
    this.inverseCoffs = undefined;
    if (!json) {
      this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
      return;
    }
    if (!Array.isArray(json)) {
      if (json instanceof RotMatrix)
        this.setFrom(json);
      return;
    }

    if (Geometry.isArrayOfNumberArray(json, 3, 3)) {
      const data = json as number[][];
      this.setRowValues(
        data[0][0], data[0][1], data[0][2],
        data[1][0], data[1][1], data[1][2],
        data[2][0], data[2][1], data[2][2]);
      return;
    }

    if (json.length === 9) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], data[2],
        data[3], data[4], data[5],
        data[6], data[7], data[8]);
    } else if (json.length === 4) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], 0,
        data[2], data[3], 0,
        0, 0, 1);
    }
  }
  /** @returns Return a new RotMatrix constructed from contents of the json value. */
  public static fromJSON(json?: RotMatrixProps): RotMatrix { const result = RotMatrix.createIdentity(); result.setFromJSON(json); return result; }
  /** Test if this RotMatrix and other are within tolerance in all numeric entries.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqual(other: RotMatrix, tol?: number): boolean {
    if (tol)
      return Geometry.isDistanceWithinTol(this.maxDiff(other), tol);
    return Geometry.isSmallMetricDistance(this.maxDiff(other));
  }
  /** Test for exact (bitwise) equality with other. */
  public isExactEqual(other: RotMatrix): boolean { return this.maxDiff(other) === 0.0; }
  /** test if all entries in the z row and column are exact 001, i.e. the matrix only acts in 2d */
  public isXY(): boolean {
    return this.coffs[2] === 0.0
      && this.coffs[5] === 0.0
      && this.coffs[6] === 0.0
      && this.coffs[7] === 0.0
      && this.coffs[8] === 1.0;
  }
  // !! does not clear supplied result !!
  private static _create(result?: RotMatrix): RotMatrix { return result ? result : new RotMatrix(); }

  /** @returns a RotMatrix populated by numeric values given in row-major order.
  *  set all entries in the matrix from call parameters appearing in row - major order.
  * @param axx Row x, column x(0, 0) entry
  * @param axy Row x, column y(0, 1) entry
  * @param axz Row x, column z(0, 2) entry
  * @param ayx Row y, column x(1, 0) entry
  * @param ayy Row y, column y(1, 1) entry
  * @param ayz Row y, column z(1, 2) entry
  * @param azx Row z, column x(2, 0) entry
  * @param azy Row z, column y(2, 2) entry
  * @param azz row z, column z(2, 3) entry
  */
  public static createRowValues(
    axx: number, axy: number, axz: number,
    ayx: number, ayy: number, ayz: number,
    azx: number, azy: number, azz: number,
    result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    result.inverseState = InverseMatrixState.unknown;
    result.coffs[0] = axx; result.coffs[1] = axy; result.coffs[2] = axz;
    result.coffs[3] = ayx; result.coffs[4] = ayy; result.coffs[5] = ayz;
    result.coffs[6] = azx; result.coffs[7] = azy; result.coffs[8] = azz;
    return result;
  }

  /**
   * Create a RotMatrix with caller-supplied coefficients and optional inverse coefficients.
   * * The inputs are captured into the new RotMatrix.
   * * The caller is responsible for validity of the inverse coefficients.
   * @param coffs (required) array of 9 coefficients.
   * @param inverseCoffs (optional) array of 9 coefficients.
   * @returns a RotMatrix populated by a coffs array.
   */
  public static createCapture(coffs: Float64Array, inverseCoffs?: Float64Array): RotMatrix {
    const result = new RotMatrix(coffs);
    if (inverseCoffs) {
      result.inverseCoffs = inverseCoffs;
      result.inverseState = InverseMatrixState.inverseStored;
    } else {
      result.inverseState = InverseMatrixState.unknown;
    }
    return result;
  }

  // install all matrix entries.
  public static createColumnsInAxisOrder(axisOrder: AxisOrder, columnA: Vector3d, columnB: Vector3d, columnC: Vector3d | undefined, result?: RotMatrix) {
    if (!result) result = new RotMatrix();
    if (axisOrder === AxisOrder.XYZ) {
      result.setColumns(columnA, columnB, columnC);
    } else if (axisOrder === AxisOrder.YZX) {
      result.setColumns(columnB, columnC, columnA);
    } else if (axisOrder === AxisOrder.ZXY) {
      result.setColumns(columnC, columnA, columnB);
    } else if (axisOrder === AxisOrder.XZY) {
      result.setColumns(columnA, columnC, columnB);
    } else if (axisOrder === AxisOrder.YXZ) {
      result.setColumns(columnB, columnA, columnC);
    } else if (axisOrder === AxisOrder.ZYX) {
      result.setColumns(columnC, columnB, columnA);
    } else {  // should not happen -- go to default
      result.setColumns(columnA, columnB, columnC);
    }
    return result;
  }

  /**
   *  set all entries in the matrix from call parameters appearing in row-major order.
   * @param axx Row x, column x (0,0) entry
   * @param axy Row x, column y (0,1) entry
   * @param axz Row x, column z (0,2) entry
   * @param ayx Row y, column x (1,0) entry
   * @param ayy Row y, column y (1,1) entry
   * @param ayz Row y, column z (1,2) entry
   * @param azx Row z, column x (2,0) entry
   * @param azy Row z, column y (2,2) entry
   * @param azz row z, column z (2,3) entry
   */
  public setRowValues(
    axx: number, axy: number, axz: number,
    ayx: number, ayy: number, ayz: number,
    azx: number, azy: number, azz: number): void {
    this.coffs[0] = axx; this.coffs[1] = axy; this.coffs[2] = axz;
    this.coffs[3] = ayx; this.coffs[4] = ayy; this.coffs[5] = ayz;
    this.coffs[6] = azx; this.coffs[7] = azy; this.coffs[8] = azz;
    this.inverseState = InverseMatrixState.unknown;
  }
  public setIdentity() { this.setRowValues(1, 0, 0, 0, 1, 0, 0, 0, 1); this.setupInverseTranspose(); }
  public setZero() { this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0); this.inverseState = InverseMatrixState.singular; }

  public setFrom(other: RotMatrix) {
    for (let i = 0; i < 9; i++)
      this.coffs[i] = other.coffs[i];
    this.inverseState = InverseMatrixState.unknown; // we don't trust the other .. . .
  }

  public clone(result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    result.setFrom(this);
    return result;
  }

  public static createZero(): RotMatrix {
    const retVal = new RotMatrix();
    retVal.inverseState = InverseMatrixState.singular;
    return retVal;
  }
  public static createIdentity(result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    result.setIdentity();
    return result;
  }

  /** Create a matrix with uniform scale factors */
  public static createUniformScale(scaleFactor: number): RotMatrix {
    return RotMatrix.createScale(scaleFactor, scaleFactor, scaleFactor);
  }
  /**
   *
   * *  use createHeadsUpPerpendicular to generate a vectorV perpendicular to vectorA
   * *  construct a frame using createRigidFromColumns (vectorA, vectorB, axisOrder)
   */
  public static createRigidHeadsUp(vectorA: Vector3d, axisOrder: AxisOrder = AxisOrder.ZXY, result?: RotMatrix): RotMatrix {
    const vectorB = RotMatrix.createRigidHeadsUpFavorXYPlane(vectorA);
    const matrix = RotMatrix.createRigidFromColumns(vectorA, vectorB, axisOrder, result);
    if (matrix) {
      matrix.setupInverseTranspose();
      return matrix;
    }
    return RotMatrix.createIdentity(result);
  }
  /**
   *
   * * return a vector that is perpendicular to the input direction.
   * * Among the infinite number of perpendiculars possible, this method
   * favors having one in the xy plane.
   * * Hence, when vectorA is NOT close to the Z axis, the returned vector is Z cross vectorA.
   * * But vectorA is close to the Z axis, the returned vector is unitY cross vectorA.
   */
  public static createRigidHeadsUpFavorXYPlane(vector: Vector3d, result?: Vector3d): Vector3d {
    const a = vector.magnitude();
    const b = a / 64.0;   // A constant from the dawn of time in the CAD industry.
    if (Math.abs(vector.x) < b && Math.abs(vector.y) < b) {
      return Vector3d.createCrossProduct(vector.x, vector.y, vector.z, 0, -1, 0, result);
    }
    return Vector3d.createCrossProduct(0, 0, 1, vector.x, vector.y, vector.z, result);
  }

  /**
 *
 * * return a vector that is perpendicular to the input direction.
 * * Among the infinite number of perpendiculars possible, this method
 * favors having one near the Z.
 * That is achieved by crossing "this" vector with the result of createHeadsUpPerpendicularFavorXYPlane.
 */
  public static createHeadsUpPerpendicularNearZ(vector: Vector3d, result?: Vector3d): Vector3d {
    result = RotMatrix.createRigidHeadsUpFavorXYPlane(vector, result);
    return vector.crossProduct(result);
  }

  /** Create a matrix with distinct x,y,z diagonal (scale) entries */
  public static createScale(scaleFactorX: number, scaleFactorY: number, scaleFactorZ: number, result?: RotMatrix): RotMatrix {
    if (result)
      result.setZero();
    else
      result = new RotMatrix();

    result.coffs[0] = scaleFactorX;
    result.coffs[4] = scaleFactorY;
    result.coffs[8] = scaleFactorZ;
    if (scaleFactorX === 0 || scaleFactorY === 0 || scaleFactorZ === 0) {
      result.inverseState = InverseMatrixState.singular;
    } else {
      result.inverseState = InverseMatrixState.inverseStored;
      result.inverseCoffs = Float64Array.from([1 / scaleFactorX, 0, 0,
        0, 1 / scaleFactorY, 0,
        0, 0, 1 / scaleFactorZ]);
    }
    return result;
  }

  /** @returns return a rotation of specified angle around an axis */
  public static createRotationAroundVector(axis: Vector3d, angle: Angle, result?: RotMatrix): RotMatrix | undefined {
    const c = angle.cos();
    const s = angle.sin();
    const v = 1.0 - c;
    const unit = axis.normalize();
    if (unit) {
      const retVal = RotMatrix.createRowValues(
        unit.x * unit.x * v + c,
        unit.x * unit.y * v - s * unit.z,
        unit.x * unit.z * v + s * unit.y,
        unit.y * unit.x * v + s * unit.z,
        unit.y * unit.y * v + c,
        unit.y * unit.z * v - s * unit.x,
        unit.z * unit.x * v - s * unit.y,
        unit.z * unit.y * v + s * unit.x,
        unit.z * unit.z * v + c, result);
      retVal.setupInverseTranspose();
      return retVal;
    }
    return undefined;
  }

  /** @returns return a rotation of specified angle around an axis
   * @param axisIndex index of axis (AxisIndex.X, AxisIndex.Y, AxisIndex.Z) kept fixed by the rotation.
   * @param angle angle of rotation
   * @param result optional result matrix.
  */
  public static createRotationAroundAxisIndex(axisIndex: AxisIndex, angle: Angle, result?: RotMatrix): RotMatrix {
    const c = angle.cos();
    const s = angle.sin();
    let myResult;
    if (axisIndex === AxisIndex.X) {
      myResult = RotMatrix.createRowValues(
        1, 0, 0,
        0, c, -s,
        0, s, c,
        result);
    } else if (axisIndex === AxisIndex.Y) {
      myResult = RotMatrix.createRowValues(
        c, 0, s,
        0, 1, 0,
        -s, 0, c,
        result);
    } else {
      myResult = RotMatrix.createRowValues(
        c, -s, 0,
        s, c, 0,
        0, 0, 1,
        result);
    }
    myResult.setupInverseTranspose();
    return myResult;
  }

  /** Create a matrix with
   * * ColumnX points in the rightVector direction
   * * ColumnY points in in the upVectorDirection
   * * ColumnZ is a unit cross product.
   * Optinoally rotate the standard cube by 45 to bring its left or right vertical edge to center
   * * leftNoneRight = [-1,0,1] respectively for left edge, no rotation, or right edge
   * * bottomNoneTop = [-1,0,1] respectively for isometric rotation to view the bottom, no isometric rotation, and isometric rotation to view the top
   * This is expected to be used with various principal unit vectors that are perpendicular to each other.
   *  * STANDARD TOP VIEW: (Vector3d.UnitX (), Vector3d.UnitY (), 0, 0)
   *  * STANDARD FRONT VIEW: (Vector3d.UnitX (), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD BACK VIEW: (Vector3d.UnitX (-1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD RIGHT VIEW: (Vector3d.UnitY (1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD LEFT VIEW: (Vector3d.UnitY (-1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD BOTTOM VIEW: (Vector3d.UnitX (1), Vector3d.UnitY (-1), 0, 0)
   * @param leftNoneRight Normally one of {-1,0,1}, where (-1) indicates the left vertical is rotated to center and (1) for right.  Other numbers are used as multiplier for this 45 degree rotation
   * @returns undefined if columNX, columnY are coplanar.
  */
  public static createViewedAxes(rightVector: Vector3d, upVector: Vector3d, leftNoneRight: number = 0, topNoneBottom: number = 0): RotMatrix | undefined {
    const columnZ = rightVector.crossProduct(upVector);
    if (columnZ.normalizeInPlace()) {
      const geometry = RotMatrix.createColumns(rightVector, upVector, columnZ);
      if (leftNoneRight !== 0.0) {
        let c = Math.sqrt(0.5);
        let s = leftNoneRight < 0.0 ? -c : c;
        if (Math.abs(leftNoneRight) !== 1.0) {
          const radians = Angle.degreesToRadians(45.0 * leftNoneRight);
          c = Math.cos(radians);
          s = Math.sin(radians);
        }
        geometry.applyGivensColumnOp(2, 0, c, s);   // rotate around Y
      }
      if (topNoneBottom !== 0.0) {
        const theta = topNoneBottom * Math.atan(Math.sqrt(0.5));
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        geometry.applyGivensColumnOp(1, 2, c, -s); // rotate around X
      }
      return geometry;
    }
    return undefined;
  }
  /**
   * Create a rotation matrix for one of the 8 standard views.
   * * With `invert === false` the return is such that `matrix.multiply(worldVector)` returns the vector as seen in the xy (projected) coordinates of the view.
   * * With invert === true the matrix is transposed so that `matrix.mutiply(viewVector` maps the "in view" vector to a world vector.
   *
   * @param index standard veiw index `StandardViewIndex.Top, Bottom, LEft, Right, Front, Back, Iso, LeftIso`
   * @param invert if false (default), the returned RotMatrix "projects" world vectors into XY view vectors.  If true, it is inverted to map view vectors to world.
   * @param result optional result.
   */
  public static createStandardWorldToView(index: StandardViewIndex, invert: boolean = false, result?: RotMatrix): RotMatrix {
    switch (index) {
      case StandardViewIndex.Top:
        result = RotMatrix.createIdentity(result);
        break;
      case StandardViewIndex.Bottom:
        result = RotMatrix.createRowValues(
          1, 0, 0,
          0, -1, 0,
          0, 0, -1);
        break;
      case StandardViewIndex.Left:
        result = RotMatrix.createRowValues(
          0, -1, 0,
          0, 0, 1,
          -1, 0, 0);
        break;
      case StandardViewIndex.Right:
        result = RotMatrix.createRowValues(
          0, 1, 0,
          0, 0, 1,
          1, 0, 0);
        break;
      case StandardViewIndex.Front: // 0-based 4
        result = RotMatrix.createRowValues(
          1, 0, 0,
          0, 0, 1,
          0, -1, 0);
        break;
      case StandardViewIndex.Back: // 0-based 5
        result = RotMatrix.createRowValues(
          -1, 0, 0,
          0, 0, 1,
          0, 1, 0);
        break;
      case StandardViewIndex.Iso:
        result = RotMatrix.createRowValues(
          0.707106781186548, -0.70710678118654757, 0.00000000000000000,
          0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          -0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      case StandardViewIndex.RightIso:
        result = RotMatrix.createRowValues(
          0.707106781186548, 0.70710678118654757, 0.00000000000000000,
          -0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      default:
        result = RotMatrix.createIdentity(result);
    }
    if (invert)
      result.transposeInPlace();
    return result;
  }
  /*
  // this implementation has problems distinguishing failure (normalize) from small angle.
  public getAxisAndAngleOfRotation(): { axis: Vector3d, angle: Angle, error: boolean } {

    const result = { axis: Vector3d.unitZ(), angle: Angle.createRadians(0), error: true };
    if (this.isIdentity()) {
      result.error = false;
      return result;
    }
    if (!this.isRigid())
      return result;
    const QminusI = this.clone();
    QminusI.coffs[0] -= 1.0;
    QminusI.coffs[4] -= 1.0;
    QminusI.coffs[8] -= 1.0;
    // Each column of (Q - I) is the motion of the corresponding axis vector
    // during the rotation.
    // Only one of the three axes can really be close to the rotation axis.
    const delta0 = QminusI.columnX();
    const delta1 = QminusI.columnY();
    const delta2 = QminusI.columnZ();
    const cross01 = delta0.crossProduct(delta1);
    const cross12 = delta1.crossProduct(delta2);
    const cross20 = delta2.crossProduct(delta0);

    const aa01 = cross01.magnitudeSquared();
    const aa12 = cross12.magnitudeSquared();
    const aa20 = cross20.magnitudeSquared();

    const cross = cross01.clone(); // This will end up as the biggest cross product
    const v0 = delta0.clone();  // This will end up as one of the two largest delta vectors
    let aaMax = aa01;
    if (aa12 > aaMax) {
      cross.setFrom(cross12);
      aaMax = aa12;
      v0.setFrom(delta1);
    }
    if (aa20 > aaMax) {
      cross.setFrom(cross20);
      aaMax = aa20;
      v0.setFrom(delta2);
    }

    if (aaMax === 0.0) {
      // The vectors did not move.  Just accept the zero rotation, with error flag set.
      return result;
    }

    v0.normalizeInPlace();
    // V0 is a unit vector perpendicular to the rotation axis.
    // Rotate it.   Its image V1 is also a unit vector, and the angle from V0 to V1 is the quat angle.
    // CrossProduct is axis vector times sine of angle.
    // Dot Product is cosine of angle.
    // V2 is zero in 180 degree case, so we use the Cross from the search as the axis
    //   as direction, being careful to keep sine positive.
    const v1 = this.multiplyVector(v0);
    const v2 = v0.crossProduct(v1);
    const sine = v2.magnitude();
    if (v2.dotProduct(cross) < 0.0)
      cross.scaleInPlace(-1.0);
    const cosine = v0.dotProduct(v1);
    result.angle.setRadians(Math.atan2(sine, cosine));
    result.axis.setFrom(cross);
    result.error = !result.axis.tryNormalizeInPlace();
    return result;
  }
*/
  /**
   * Compute the (unit vector) axis and angle of rotation.
   * @returns Returns with result.ok === true when the conversion succeeded.
   */
  public getAxisAndAngleOfRotation(): { axis: Vector3d, angle: Angle, ok: boolean } {
    const trace = this.coffs[0] + this.coffs[4] + this.coffs[8];
    // trace = (xx + yy * zz) * (1-c) + 3 * c = 1 + 2c ==> c = (trace-1) / 2
    const skewXY = this.coffs[3] - this.coffs[1];  // == 2sz
    const skewYZ = this.coffs[7] - this.coffs[5]; // == 2sx
    const skewZX = this.coffs[2] - this.coffs[6]; // == 2sy
    const c = (trace - 1.0) / 2.0;
    const s = Geometry.hypotenuseXYZ(skewXY, skewYZ, skewZX) / 2.0;
    const e = c * c + s * s - 1.0;
    if (Math.abs(e) > Geometry.smallAngleRadians) {
      // the sine and cosine are not a unit circle point.   bad matrix . ..
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
    }
    if (Math.abs(s) < Geometry.smallAngleRadians) {
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: true };
    }
    const a = 1.0 / (2.0 * s);
    const result = { axis: Vector3d.create(skewYZ * a, skewZX * a, skewXY * a), angle: Angle.createAtan2(s, c), ok: true };
    return result;
  }
  /**
   * @returns return a matrix that rotates from vectorA to vectorB.
   */
  public static createRotationVectorToVector(vectorA: Vector3d, vectorB: Vector3d, result?: RotMatrix): RotMatrix | undefined {
    return this.createPartialRotationVectorToVector(vectorA, 1.0, vectorB, result);
  }
  /**
   * Return a matrix that rotates a fraction of the angular sweep from vectorA to vectorB.
   * @param vectorA initial vector position
   * @param fraction fractional rotation.  1.0 is "all the way"
   * @param vectorB final vector position
   * @param result optional result matrix.
  */
  public static createPartialRotationVectorToVector(vectorA: Vector3d, fraction: number, vectorB: Vector3d, result?: RotMatrix): RotMatrix | undefined {

    let upVector = vectorA.unitCrossProduct(vectorB);
    if (upVector) {  // the usual case --
      return RotMatrix.createRotationAroundVector(upVector,
        Angle.createRadians(fraction * vectorA.planarAngleTo(vectorB, upVector).radians));
    }
    // fail if either vector is zero ...
    if (Geometry.isSmallMetricDistance(vectorA.magnitude())
      || Geometry.isSmallMetricDistance(vectorB.magnitude()))
      return undefined;
    // nonzero but aligned vectors ...
    if (vectorA.dotProduct(vectorB) > 0.0)
      return RotMatrix.createIdentity(result);
    // nonzero opposing vectors ..
    upVector = RotMatrix.createHeadsUpPerpendicularNearZ(vectorA, upVector);
    return RotMatrix.createRotationAroundVector(upVector, Angle.createRadians(fraction * Math.PI));
  }

  /** Create a 90 degree rotation around a principal axis */
  public static create90DegreeRotationAroundAxis(axisIndex: number): RotMatrix {
    axisIndex = Geometry.cyclic3dAxis(axisIndex);
    if (axisIndex === 0) {
      const retVal = RotMatrix.createRowValues(
        1, 0, 0,
        0, 0, -1,
        0, 1, 0);
      retVal.setupInverseTranspose();
      return retVal;
    } else if (axisIndex === 1) {
      const retVal = RotMatrix.createRowValues(
        0, 0, 1,
        0, 1, 0,
        -1, 0, 0);
      retVal.setupInverseTranspose();
      return retVal;
    } else {
      const retVal = RotMatrix.createRowValues(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1);
      retVal.setupInverseTranspose();
      return retVal;
    }
  }

  /** @returns Return (a copy of) the X column */
  public columnX(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[0], this.coffs[3], this.coffs[6], result); }
  /** @returns Return (a copy of)the Y column */
  public columnY(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[1], this.coffs[4], this.coffs[7], result); }
  /** @returns Return (a copy of)the Z column */
  public columnZ(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[2], this.coffs[5], this.coffs[8], result); }

  /** @returns Return the X column magnitude squared */
  public columnXMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[0], this.coffs[3], this.coffs[6]); }
  /** @returns Return the Y column magnitude squared */
  public columnYMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[1], this.coffs[4], this.coffs[7]); }
  /** @returns Return the Z column magnitude squared */
  public columnZMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[2], this.coffs[5], this.coffs[8]); }

  /** @returns Return the X column magnitude */
  public columnXMagnitude(): number { return Math.hypot(this.coffs[0], this.coffs[3], this.coffs[6]); }
  /** @returns Return the Y column magnitude */
  public columnYMagnitude(): number { return Math.hypot(this.coffs[1], this.coffs[4], this.coffs[7]); }
  /** @returns Return the Z column magnitude */
  public columnZMagnitude(): number { return Math.hypot(this.coffs[2], this.coffs[5], this.coffs[8]); }
  /** @returns the dot product of column X with column Y */

  /** @returns Return the X row magnitude squared */
  public rowXMagnitude(): number { return Math.hypot(this.coffs[0], this.coffs[1], this.coffs[2]); }
  /** @returns Return the Y row magnitude squared */
  public rowYMagnitude(): number { return Math.hypot(this.coffs[3], this.coffs[4], this.coffs[5]); }
  /** @returns Return the Z row magnitude squared */
  public rowZMagnitude(): number { return Math.hypot(this.coffs[6], this.coffs[7], this.coffs[8]); }
  /** @returns the dot product of column X with column Y */
  public columnXDotColumnY(): number {
    return this.coffs[0] * this.coffs[1]
      + this.coffs[3] * this.coffs[4]
      + this.coffs[6] * this.coffs[7];
  }
  /** Return (a copy of) the X row */
  public rowX(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[0], this.coffs[1], this.coffs[2], result); }
  /** Return (a copy of) the Y row */
  public rowY(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[3], this.coffs[4], this.coffs[5], result); }
  /** Return (a copy of) the Z row */
  public rowZ(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[6], this.coffs[7], this.coffs[8], result); }

  /** @returns Return the dot product of the vector parameter with the X column. */
  public dotColumnX(vector: XYZ): number { return vector.x * this.coffs[0] + vector.y * this.coffs[3] + vector.z * this.coffs[6]; }
  /** @returns Return the dot product of the vector parameter with the Y column. */
  public dotColumnY(vector: XYZ): number { return vector.x * this.coffs[1] + vector.y * this.coffs[4] + vector.z * this.coffs[7]; }
  /** @returns Return the dot product of the vector parameter with the Z column. */
  public dotColumnZ(vector: XYZ): number { return vector.x * this.coffs[2] + vector.y * this.coffs[5] + vector.z * this.coffs[8]; }

  /** @returns Return the dot product of the vector parameter with the X row. */
  public dotRowX(vector: XYZ): number { return vector.x * this.coffs[0] + vector.y * this.coffs[1] + vector.z * this.coffs[2]; }
  /** @returns Return the dot product of the vector parameter with the Y row. */
  public dotRowY(vector: XYZ): number { return vector.x * this.coffs[3] + vector.y * this.coffs[4] + vector.z * this.coffs[5]; }
  /** @returns Return the dot product of the vector parameter with the Z row. */
  public dotRowZ(vector: XYZ): number { return vector.x * this.coffs[6] + vector.y * this.coffs[7] + vector.z * this.coffs[8]; }

  /** @returns Return the (vector) cross product of the Z column with the vector parameter. */
  public columnZCrossVector(vector: XYZ, result?: Vector3d): Vector3d {
    return Geometry.crossProductXYZXYZ(this.coffs[2], this.coffs[5], this.coffs[8], vector.x, vector.y, vector.z, result);
  }
  /**
   * Replace current rows Ui Uj with (c*Ui - s*Uj) and (c*Uj + s*Ui)
   * @param i first row index.  must be 0,1,2 (unchecked)
   * @param j second row index. must be 0,1,2 (unchecked)
   * @param c fist coefficient
   * @param s second coefficient
   */
  private applyGivensRowOp(i: number, j: number, c: number, s: number): void {
    let ii = 3 * i;
    let jj = 3 * j;
    const limit = ii + 3;
    for (; ii < limit; ii++ , jj++) {
      const a = this.coffs[ii];
      const b = this.coffs[jj];
      this.coffs[ii] = a * c + b * s;
      this.coffs[jj] = -a * s + b * c;
    }
  }
  /**
    * Replace current columns Ui Uj with (c*Ui - s*Uj) and (c*Uj + s*Ui)
    * This is used in compute intensive inner loops -- there is no
    * checking for i,j being 0,1,2
    * @param i first row index.  must be 0,1,2 (unchecked)
    * @param j second row index. must be 0,1,2 (unchecked)
    * @param c fist coefficient
    * @param s second coefficient
    */
  public applyGivensColumnOp(i: number, j: number, c: number, s: number): void {
    const limit = i + 9;
    for (; i < limit; i += 3, j += 3) {
      const a = this.coffs[i];
      const b = this.coffs[j];
      this.coffs[i] = a * c + b * s;
      this.coffs[j] = -a * s + b * c;
    }
  }

  /**
   * create a rigid coordinate frame with:
   * * column z points from origin to x,y,z
   * * column x is perpendicular and in the xy plane
   * * column y is perpendicular to both.  It is the "up" vector on the view plane.
   * * Multiplying a world vector times the transpose of this matrix transforms into the view xy
   * * Multiplying the matrix times the an in-view vector transforms the vector to world.
   * @param x eye x coordinate
   * @param y eye y coordinate
   * @param z eye z coordinate
   * @param result
   */
  public static createRigidViewAxesZTowardsEye(x: number, y: number, z: number, result?: RotMatrix): RotMatrix {
    result = RotMatrix.createIdentity(result);
    const rxy = Geometry.hypotenuseXY(x, y);
    if (Geometry.isSmallMetricDistance(rxy)) {
      // special case for top or bottom view.
      if (z < 0.0)
        result.scaleColumnsInPlace(1.0, -1, -1.0);
    } else {
      //      const d = Geometry.hypotenuseSquaredXYZ(x, y, z);
      const c = x / rxy;
      const s = y / rxy;
      result.setRowValues(
        -s, 0, c,
        c, 0, s,
        0, 1, 0);
      if (z !== 0.0) {
        const r = Geometry.hypotenuseXYZ(x, y, z);
        const s1 = z / r;
        const c1 = rxy / r;
        result.applyGivensColumnOp(1, 2, c1, -s1);
      }
    }
    return result;
  }
  /** Rotate so columns i and j become perpendicular */
  private applyJacobiColumnRotation(i: number, j: number, matrixU: RotMatrix): number {
    const uDotU = this.coffs[i] * this.coffs[i] + this.coffs[i + 3] * this.coffs[i + 3] + this.coffs[i + 6] * this.coffs[i + 6];
    const vDotV = this.coffs[j] * this.coffs[j] + this.coffs[j + 3] * this.coffs[j + 3] + this.coffs[j + 6] * this.coffs[j + 6];
    const uDotV = this.coffs[i] * this.coffs[j] + this.coffs[i + 3] * this.coffs[j + 3] + this.coffs[i + 6] * this.coffs[j + 6];
    // const c2 = uDotU - vDotV;
    // const s2 = 2.0 * uDotV;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(uDotU - vDotV, 2.0 * uDotV);
    // const h = Math.hypot(c2, s2);
    // console.log(" c2 s2", c2 / h, s2 / h);
    // console.log(" C S ", Math.cos(2 * jacobi.radians), Math.sin(2 * jacobi.radians));
    // console.log("i j uDotV", i, j, uDotV);
    if (Math.abs(jacobi.s) < 2.0e-15)
      return 0.0;
    this.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);
    matrixU.applyGivensRowOp(i, j, jacobi.c, jacobi.s);
    // const BTB = this.multiplyMatrixTransposeMatrix(this);
    // console.log("BTB", BTB.at(0, 0), BTB.at(1, 1), BTB.at(2, 2), "       off", BTB.at(0, 1), BTB.at(0, 2), BTB.at(1, 2), "  at(i,j)", BTB.at(i, j));
    return Math.abs(uDotV);
  }
  /**
   * Factor this as a product C * U where C has mutually perpendicular columns and
   * U is orthogonal.
   * @param matrixC (allocate by caller, computed here)
   * @param factor  (allocate by caller, computed here)
   */
  public factorPerpendicularColumns(matrixC: RotMatrix, matrixU: RotMatrix): boolean {
    matrixC.setFrom(this);
    matrixU.setIdentity();
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = matrixC.applyJacobiColumnRotation(0, 1, matrixU)
        + matrixC.applyJacobiColumnRotation(0, 2, matrixU)
        + matrixC.applyJacobiColumnRotation(1, 2, matrixU);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("jacobi iterations", iteration);
        return true;
      }
    }
    return false;
  }
  /** Apply a jacobi step to lambda which evolves towards diagonal. */
  private applySymmetricJacobi(i: number, j: number, lambda: RotMatrix): number {
    const uDotU = lambda.at(i, i);
    const vDotV = lambda.at(j, j);
    const uDotV = lambda.at(i, j);
    if (Math.abs(uDotV) < 1.0e-15 * (uDotU + vDotV))
      return 0.0;
    // const c2 = uDotU - vDotV;
    // const s2 = 2.0 * uDotV;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(uDotU - vDotV, 2.0 * uDotV);
    // const h = Math.hypot(c2, s2);
    // console.log(" c2 s2", c2 / h, s2 / h);
    // console.log(" C S ", Math.cos(2 * jacobi.radians), Math.sin(2 * jacobi.radians));
    // console.log("i j uDotV", i, j, uDotV);
    if (Math.abs(jacobi.s) < 2.0e-15)
      return 0.0;
    // Factored form is this *lambda * thisTranspose
    // Let Q be the rotation matrix.  Q*QT is inserted, viz
    //          this*Q * QT * lambda * Q*thisTranspose
    this.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);

    lambda.applyGivensRowOp(i, j, jacobi.c, jacobi.s);
    lambda.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);
    // const BTB = this.multiplyMatrixTransposeMatrix(this);
    // console.log("BTB", BTB.at(0, 0), BTB.at(1, 1), BTB.at(2, 2), "       off", BTB.at(0, 1), BTB.at(0, 2), BTB.at(1, 2), "  at(i,j)", BTB.at(i, j));
    return Math.abs(uDotV);
  }
  /**
   * Factor this (symmetrized) as a product U * lambda * UT where U is orthogonal, lambda is diagonal.
   * The upper triangle is mirrored to lower triangle to enforce symmetry.
   * @param matrixC (allocate by caller, computed here)
   * @param factor  (allocate by caller, computed here)
   */
  public symmetricEigenvalues(leftEigenvectors: RotMatrix, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    matrix.coffs[3] = matrix.coffs[1];
    matrix.coffs[6] = matrix.coffs[2];
    matrix.coffs[7] = matrix.coffs[5];
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = leftEigenvectors.applySymmetricJacobi(0, 1, matrix)
        + leftEigenvectors.applySymmetricJacobi(0, 2, matrix)
        + leftEigenvectors.applySymmetricJacobi(1, 2, matrix);
      // console.log("symmetric sum", sum);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("symmetric iterations", iteration);
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }

  /** Apply (in place a jacobi update that zeros out this.at(i,j).*/
  private applyFastSymmetricJacobiUpdate(
    i: number,  // row index of zeroed member
    j: number,  // column index of zeroed member
    k: number,  // other row/column index (different from i and j)
    leftEigenVectors: RotMatrix): number {
    const indexII = 4 * i;
    const indexJJ = 4 * j;
    const indexIJ = 3 * i + j;
    const indexIK = 3 * i + k;
    const indexJK = 3 * j + k;
    const dotUU = this.coffs[indexII];
    const dotVV = this.coffs[indexJJ];
    const dotUV = this.coffs[indexIJ];
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(dotUU - dotVV, 2.0 * dotUV);
    if (Math.abs(dotUV) < 1.0e-15 * (dotUU + dotVV))
      return 0.0;
    const c = jacobi.c;
    const s = jacobi.s;
    const cc = c * c;
    const ss = s * s;
    const sc2 = 2.0 * c * s;
    this.coffs[indexII] = cc * dotUU + sc2 * dotUV + ss * dotVV;
    this.coffs[indexJJ] = ss * dotUU - sc2 * dotUV + cc * dotVV;
    this.coffs[indexIJ] = 0.0;
    const a = this.coffs[indexIK];
    const b = this.coffs[indexJK];
    this.coffs[indexIK] = a * c + b * s;
    this.coffs[indexJK] = -s * a + c * b;
    this.coffs[3 * j + i] = 0.0;
    this.coffs[3 * k + i] = this.coffs[indexIK];
    this.coffs[3 * k + j] = this.coffs[indexJK];
    leftEigenVectors.applyGivensColumnOp(i, j, c, s);
    return Math.abs(dotUV);
  }

  /**
 * Factor this (symmetrized) as a product U * lambda * UT where U is orthogonal, lambda is diagonal.
 * The upper triangle is mirrored to lower triangle to enforce symmetry.
 * @param matrixC (allocate by caller, computed here)
 * @param factor  (allocate by caller, computed here)
 */
  public fastSymmetricEigenvalues(leftEigenvectors: RotMatrix, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = matrix.applyFastSymmetricJacobiUpdate(0, 1, 2, leftEigenvectors)
        + matrix.applyFastSymmetricJacobiUpdate(0, 2, 1, leftEigenvectors)
        + matrix.applyFastSymmetricJacobiUpdate(1, 2, 0, leftEigenvectors);
      // console.log("symmetric sum", sum);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("symmetric iterations", iteration);
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }
  /** Create a matrix from column vectors. */
  public static createColumns(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, result?: RotMatrix): RotMatrix {
    return RotMatrix.createRowValues
      (
      vectorU.x, vectorV.x, vectorW.x,
      vectorU.y, vectorV.y, vectorW.y,
      vectorU.z, vectorV.z, vectorW.z, result);
  }

  /** Install data from xyz parts of Point4d  (w part of Point4d ignored) */
  public setColumnsPoint4dXYZ(vectorU: Point4d, vectorV: Point4d, vectorW: Point4d) {
    this.setRowValues(
      vectorU.x, vectorV.x, vectorW.x,
      vectorU.y, vectorV.y, vectorW.y,
      vectorU.z, vectorV.z, vectorW.z);
  }
  /**
   * set entries in one column of the matrix.
   * @param columnIndex column index. this is interpreted cyclically.
   * @param value x,yz, values for column.  If undefined, zeros are installed.
   */
  public setColumn(columnIndex: number, value: Vector3d | undefined) {
    const index = Geometry.cyclic3dAxis(columnIndex);
    if (value) {
      this.coffs[index] = value.x;
      this.coffs[index + 3] = value.y;
      this.coffs[index + 6] = value.z;
    } else {
      this.coffs[index] = 0.0;
      this.coffs[index + 3] = 0.0;
      this.coffs[index + 6] = 0.0;
    }
  }
  /** Set all columns of the matrix. Any undefined vector is zeros. */
  public setColumns(vectorX: Vector3d | undefined, vectorY: Vector3d | undefined, vectorZ?: Vector3d | undefined) {
    this.setColumn(0, vectorX);
    this.setColumn(1, vectorY);
    this.setColumn(2, vectorZ);
  }
  public setRow(columnIndex: number, value: Vector3d) {
    const index = 3 * Geometry.cyclic3dAxis(columnIndex);
    this.coffs[index] = value.x;
    this.coffs[index + 1] = value.y;
    this.coffs[index + 2] = value.z;
    this.inverseState = InverseMatrixState.unknown;
  }
  /** Return a (copy of) a column of the matrix.
   * @param i column index.  Thnis is corrected to 012 by Geoemtry.cyclic3dAxis.
   */
  public getColumn(columnIndex: number, result?: Vector3d): Vector3d {
    const index = Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 3],
      this.coffs[index + 6], result);
  }

  /** Return a (copy of) a row of the matrix.
   * @param i row index.  Thnis is corrected to 012 by Geoemtry.cyclic3dAxis.
   */
  public getRow(columnIndex: number, result?: Vector3d): Vector3d {
    const index = 3 * Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 1],
      this.coffs[index + 2], result);
  }

  /** Create a matrix from column vectors, shuffled into place per AxisTriple */
  public static createShuffledColumns(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, axisOrder: AxisOrder, result?: RotMatrix): RotMatrix {
    const target = RotMatrix._create(result);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 0), vectorU);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 1), vectorV);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 2), vectorW);
    return target;
  }

  /** Create a matrix from row vectors. */
  public static createRows(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, result?: RotMatrix): RotMatrix {
    return RotMatrix.createRowValues
      (
      vectorU.x, vectorU.y, vectorU.z,
      vectorV.x, vectorV.y, vectorV.z,
      vectorW.x, vectorW.y, vectorW.z, result);
  }

  /** Create a matrix that scales along a specified direction. The scale factor can be negative. for instance scale of -1.0 (negative one) is a mirror. */
  public static createDirectionalScale(direction: Vector3d, scale: number, result?: RotMatrix): RotMatrix {
    const unit = direction.normalize();
    if (unit) {
      const x = unit.x;
      const y = unit.y;
      const z = unit.z;
      const a = (scale - 1);
      return RotMatrix.createRowValues
        (
        1 + a * x * x, a * x * y, a * x * z,
        a * y * x, 1 + a * y * y, a * y * z,
        a * z * x, a * z * y, 1 + a * z * z, result);
    }
    return RotMatrix.createUniformScale(scale);
  }

  /* Create a matrix with the indicated column in the (normalized) direction, and the other two columns perpendicular. All columns are normalized.
   * * The direction vector is normalized and appears in column axisIndex
   * * If the direction vector is not close to Z, the "next" column ((axisIndex + 1) mod 3) will be in the XY plane in the direction of (direction cross Z)
   * * If the direction vector is close to Z, the "next" column ((axisIndex + 1) mode 3) will be in the direction of (direction cross Y)
  */
  // static create1Vector(direction: Vector3d, axisIndex: number): RotMatrix;
  // static createFromXYVectors(vectorX: Vector3d, vectorY: Vector3d, axisIndex: number): RotMatrix;

  /** Multiply the matrix * vector, i.e. the vector is a column vector on the right.
      @return the vector result
  */
  public multiplyVector(vector: Vector3d, result?: Vector3d): Vector3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Vector3d.create(
      (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z),
      (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z),
      (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z),
      result);
  }

  /** Multiply the matrix * vector, i.e. the vector is a column vector on the right.
      @return the vector result
  */
  public multiplyVectorArrayInPlace(data: XYZ[]): void {
    for (const v of data) v.set(
      (this.coffs[0] * v.x + this.coffs[1] * v.y + this.coffs[2] * v.z),
      (this.coffs[3] * v.x + this.coffs[4] * v.y + this.coffs[5] * v.z),
      (this.coffs[6] * v.x + this.coffs[7] * v.y + this.coffs[8] * v.z));
  }

  public static XYZMinusMatrixTimesXYZ(origin: XYZ, matrix: RotMatrix, vector: XYZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x - (matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z),
      origin.y - (matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z),
      origin.z - (matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z),
      result);
  }

  public static XYPlusMatrixTimesXY(origin: XAndY, matrix: RotMatrix, vector: XAndY, result?: Point2d): Point2d {
    const x = vector.x;
    const y = vector.y;
    return Point2d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y,
      result);
  }

  public static XYZPlusMatrixTimesXYZ(origin: XYZ, matrix: RotMatrix, vector: XYAndZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result);
  }

  public static XYZPlusMatrixTimesCoordinates(origin: XYZ, matrix: RotMatrix, x: number, y: number, z: number, result?: Point3d): Point3d {
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result);
  }
  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply times point with coordinates `[x,y,z,w]`
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional result.
   */
  public static XYZPlusMatrixTimesWeightedCoordinates(origin: XYZ, matrix: RotMatrix, x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    return Point4d.create(
      w * origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      w * origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      w * origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      w,
      result);
  }
  public multiplyTransposeVector(vector: Vector3d, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    result.x = (this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z);
    result.y = (this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z);
    result.z = (this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * (x,y,z), i.e. the vector (x,y,z) is a column vector on the right.
      @return the vector result
  */
  public multiplyXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z);
    result.y = (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z);
    result.z = (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * xyz, place result in (required) return value.
      @param xyz right side
      @param result result.
  */
  public multiplyXYZtoXYZ(xyz: XYZ, result: XYZ) {
    const x = xyz.x;
    const y = xyz.y;
    const z = xyz.z;
    result.x = (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z);
    result.y = (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z);
    result.z = (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * (x,y,z), i.e. the vector (x,y,z) is a column vector on the right.
      @return the vector result
  */
  public multiplyXY(x: number, y: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[1] * y);
    result.y = (this.coffs[3] * x + this.coffs[4] * y);
    result.z = (this.coffs[6] * x + this.coffs[7] * y);
    return result;
  }

  // origin + this*[x,y,0].  (no nulls allowed !!)
  public originPlusMatrixTimesXY(origin: XYZ, x: number, y: number, result?: Point3d): Point3d {
    return Point3d.create(
      origin.x + this.coffs[0] * x + this.coffs[1] * y,
      origin.y + this.coffs[3] * x + this.coffs[4] * y,
      origin.z + this.coffs[6] * x + this.coffs[7] * y,
      result);
  }

  /** Multiply matrix * (x, y, z) using any 3d object given containing those members */
  public multiplyVectorInPlace(xyzData: XYZ): void {
    const x = xyzData.x;
    const y = xyzData.y;
    const z = xyzData.z;
    const coffs = this.coffs;
    xyzData.x = (coffs[0] * x + coffs[1] * y + coffs[2] * z);
    xyzData.y = (coffs[3] * x + coffs[4] * y + coffs[5] * z);
    xyzData.z = (coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  /** Multiply matrix * (x, y, z) using any 3d object given containing those members */
  public multiplyTransposeVectorInPlace(xyzData: XYZ): void {
    const x = xyzData.x;
    const y = xyzData.y;
    const z = xyzData.z;
    const coffs = this.coffs;
    xyzData.x = (coffs[0] * x + coffs[3] * y + coffs[6] * z);
    xyzData.y = (coffs[1] * x + coffs[4] * y + coffs[7] * z);
    xyzData.z = (coffs[2] * x + coffs[5] * y + coffs[8] * z);
  }

  /** Multiply the (x,y,z) * matrix, i.e. the vector (x,y,z) is a row vector on the left.
   *   @return the vector result
   */
  public multiplyTransposeXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z);
    result.y = (this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z);
    result.z = (this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z);
    return result;
  }
  /** Solve matrix * result = vector, i.e. multiply result = matrixInverse * rightHandSide  */
  public multiplyInverse(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /** Solve matrix * result = vector, i.e. multiply result = matrixInverse * rightHandSide  */
  public multiplyInverseTranspose(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[3] * y + this.inverseCoffs[6] * z),
        (this.inverseCoffs[1] * x + this.inverseCoffs[4] * y + this.inverseCoffs[7] * z),
        (this.inverseCoffs[2] * x + this.inverseCoffs[5] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /**
   *
   * *  multiply matrixInverse * [x,y,z]
   * *  Equivalent to solving matrix * result = [x,y,z]
   * *  return as a Vector3d.
   */
  public multiplyInverseXYZAsVector3d(x: number, y: number, z: number, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /**
   *
   * *  multiply matrixInverse * [x,y,z]
   * *  Equivalent to solving matrix * result = [x,y,z]
   * *  return as a Point3d.
   */
  public multiplyInverseXYZAsPoint3d(x: number, y: number, z: number, result?: Point3d): Point3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Point3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /** Multiply two matrices.
   *   @return the matrix result
   */
  public multiplyMatrixMatrix(other: RotMatrix, result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    multiplyMatrixMatrix(this.coffs, other.coffs, result.coffs);
    return result;
  }

  /** Matrix multiplication `this * otherTranspose`
      @return the matrix result
  */
  public multiplyMatrixMatrixTranspose(other: RotMatrix, result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    multiplyMatrixMatrixTranspose(this.coffs, other.coffs, result.coffs);
    return result;
  }

  /** Matrix multiplication `thisTranspose * other`
      @return the matrix result
  */
  public multiplyMatrixTransposeMatrix(other: RotMatrix, result?: RotMatrix): RotMatrix {
    result = result ? result : new RotMatrix();
    multiplyMatrixTransposeMatrix(this.coffs, other.coffs, result.coffs);
    return result;
  }
  //   [Q 0][R A] = [QR QA]
  //   [0 1][0 1]   [0  1]
  /** multiply this RotMatrix (considered as a transform with 0 translation) times other Transform.
   * @param other right hand RotMatrix for multiplication.
   * @param result optional preallocated result to reuse.
  */
  public multiplyMatrixTransform(other: Transform, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this.multiplyXYZ(other.origin.x, other.origin.y, other.origin.z),
        this.multiplyMatrixMatrix(other.matrix));
    // be sure to do the point mulitplication first before aliasing changes the matrix ..
    this.multiplyXYZtoXYZ(other.origin, result.origin);
    this.multiplyMatrixMatrix(other.matrix, result.matrix);
    return result;
  }

  /** return the transposed matrix */
  public transpose(result?: RotMatrix): RotMatrix {
    if (!result) result = new RotMatrix();
    copy3x3Transposed(this.coffs, result.coffs);
    if (this.inverseCoffs !== undefined) {
      result.inverseState = InverseMatrixState.inverseStored;
      result.inverseCoffs = copy3x3Transposed(this.inverseCoffs, result.inverseCoffs);
    } else {
      result.inverseState = this.inverseState;  // singular or unknown.
      result.inverseCoffs = undefined;
    }
    return result;
  }

  /** return the transposed matrix */
  public transposeInPlace() {
    transpose3x3InPlace(this.coffs);
    if (this.inverseCoffs)
      transpose3x3InPlace(this.inverseCoffs);
  }

  /** return the inverse matrix.  The return is  null if the matrix is singular (has columns that are coplanar or colinear) */
  public inverse(result?: RotMatrix): RotMatrix | undefined {
    this.computeCachedInverse(true);
    if (this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs)
      return RotMatrix.createRowValues(this.inverseCoffs[0], this.inverseCoffs[1], this.inverseCoffs[2],
        this.inverseCoffs[3], this.inverseCoffs[4], this.inverseCoffs[5],
        this.inverseCoffs[6], this.inverseCoffs[7], this.inverseCoffs[8], result);
    return undefined;
  }

  /** copy the transpose of the coffs to the inverseCoffs.
   * * mark the matrix as inverseStored.
   */
  private setupInverseTranspose() {
    const coffs = this.coffs;
    this.inverseState = InverseMatrixState.inverseStored;
    this.inverseCoffs = Float64Array.from([coffs[0], coffs[3], coffs[6],
    coffs[1], coffs[4], coffs[7],
    coffs[2], coffs[5], coffs[8]]);
  }

  /* Alternate implementation of computedCachedInverse - more direct addressing of arrays.
     This is indeed 10% faster than using static work areas. */

  // take the cross product of two rows of source.
  // store as a column of dest.
  private static indexedRowCrossProduct(source: Float64Array, rowStart0: number, rowStart1: number, dest: Float64Array, columnStart: number) {
    dest[columnStart] = source[rowStart0 + 1] * source[rowStart1 + 2] - source[rowStart0 + 2] * source[rowStart1 + 1];
    dest[columnStart + 3] = source[rowStart0 + 2] * source[rowStart1] - source[rowStart0] * source[rowStart1 + 2];
    dest[columnStart + 6] = source[rowStart0] * source[rowStart1 + 1] - source[rowStart0 + 1] * source[rowStart1];
  }

  // take the cross product of two columns of source.
  // store as third column in same RotMatrix.
  // This is private because the columnStart values are unchecked raw indices into the coffs
  private indexedColumnCrossProductInPlace(colStart0: number, colStart1: number, colStart2: number) {
    const coffs = this.coffs;
    coffs[colStart2] = coffs[colStart0 + 3] * coffs[colStart1 + 6] - coffs[colStart0 + 6] * coffs[colStart1 + 3];
    coffs[colStart2 + 3] = coffs[colStart0 + 6] * coffs[colStart1] - coffs[colStart0] * coffs[colStart1 + 6];
    coffs[colStart2 + 6] = coffs[colStart0] * coffs[colStart1 + 3] - coffs[colStart0 + 3] * coffs[colStart1];
  }
  /** Form cross products among axes in axisOrder.
   * For axis order ABC,
   * * form cross product of column A and B, store in C
   * * form cross product of column C and A, store in B.
   * This means that in the final matrix:
   * * column A is strictly parallel to original column A
   * * column B is linear combination of only original A and B
   * * column C is perpenedicular to A and B of both the original and final.
   * * original column C does not participate in the result.
   */
  public axisOrderCrossProductsInPlace(axisOrder: AxisOrder) {
    switch (axisOrder) {
      case AxisOrder.XYZ: {
        this.indexedColumnCrossProductInPlace(0, 1, 2);
        this.indexedColumnCrossProductInPlace(2, 0, 1);
        break;
      }
      case AxisOrder.YZX: {
        this.indexedColumnCrossProductInPlace(1, 2, 0);
        this.indexedColumnCrossProductInPlace(0, 1, 2);
        break;
      }
      case AxisOrder.ZXY: {
        this.indexedColumnCrossProductInPlace(2, 0, 1);
        this.indexedColumnCrossProductInPlace(1, 2, 0);
        break;
      }
      case AxisOrder.XZY: {
        this.indexedColumnCrossProductInPlace(0, 2, 1);
        this.indexedColumnCrossProductInPlace(1, 0, 2);
        break;
      }
      case AxisOrder.YXZ: {
        this.indexedColumnCrossProductInPlace(1, 0, 2);
        this.indexedColumnCrossProductInPlace(2, 1, 0);
        break;
      }
      case AxisOrder.ZYX: {
        this.indexedColumnCrossProductInPlace(2, 1, 0);
        this.indexedColumnCrossProductInPlace(0, 2, 1);
        break;
      }
    }
  }

  /** Normalize each column in place.
   * * For false return the magnitudes are stored in the originalMagnitudes vector but no columns are altered.
   * @returns Return true if all columns had nonzero lengths.
   * @param originalMagnitudes optional vector to receive original column magnitudes.
   */
  public normalizeColumnsInPlace(originalMagnitudes?: Vector3d): boolean {
    const ax = this.columnXMagnitude();
    const ay = this.columnYMagnitude();
    const az = this.columnZMagnitude();
    if (originalMagnitudes)
      originalMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleColumns(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  /** Normalize each row in place */
  public normalizeRowsInPlace(originalMagnitudes?: Vector3d): boolean {
    const ax = this.rowXMagnitude();
    const ay = this.rowYMagnitude();
    const az = this.rowZMagnitude();
    if (originalMagnitudes)
      originalMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleRows(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  // take the cross product of two rows of source.
  // store as a column of dest.
  private static rowColumnDot(coffA: Float64Array, rowStartA: number, coffB: Float64Array, columnStartB: number): number {
    return coffA[rowStartA] * coffB[columnStartB] + coffA[rowStartA + 1] * coffB[columnStartB + 3] + coffA[rowStartA + 2] * coffB[columnStartB + 6];
  }
  /** compute the inverse of this RotMatrix. The inverse is stored for later use.
   * @returns Return true if the inverse computed.  (False if the columns collapse to a point, line or plane.)
   */
  public computeCachedInverse(useCacheIfAvailable: boolean): boolean {
    if (useCacheIfAvailable && RotMatrix.useCachedInverse && this.inverseState !== InverseMatrixState.unknown) {
      RotMatrix.numUseCache++;
      return this.inverseState === InverseMatrixState.inverseStored;
    }
    this.inverseState = InverseMatrixState.unknown;
    if (this.inverseCoffs === undefined)
      this.inverseCoffs = new Float64Array(9);
    const coffs = this.coffs;
    const inverseCoffs = this.inverseCoffs;
    RotMatrix.indexedRowCrossProduct(coffs, 3, 6, inverseCoffs, 0);
    RotMatrix.indexedRowCrossProduct(coffs, 6, 0, inverseCoffs, 1);
    RotMatrix.indexedRowCrossProduct(coffs, 0, 3, inverseCoffs, 2);
    RotMatrix.numComputeCache++;
    const d = RotMatrix.rowColumnDot(coffs, 0, inverseCoffs, 0);
    if (d === 0.0) {     // better test?
      this.inverseState = InverseMatrixState.singular;
      this.inverseCoffs = undefined;
      return false;
    }
    const f = 1.0 / d;
    for (let i = 0; i < 9; i++)inverseCoffs[i] *= f;
    this.inverseState = InverseMatrixState.inverseStored;
    // verify inverse
    // const p = new Float64Array(9);
    // for (let i = 0; i < 9; i += 3)
    //   for (let j = 0; j < 3; j++)
    //    p[i + j] = RotMatrix.rowColumnDot (coffs, i, inverseCoffs, j);
    return true;
  }

  /* "Classic" inverse implementation with temporary vectors.
    private static rowX: Vector3d = Vector3d.create();
    private static rowY: Vector3d = Vector3d.create();
    private static rowZ: Vector3d = Vector3d.create();
    private static crossXY: Vector3d = Vector3d.create();
    private static crossZX: Vector3d = Vector3d.create();
    private static crossYZ: Vector3d = Vector3d.create();
  private computeCachedInverse(useCacheIfAvailable: boolean) {
      if (useCacheIfAvailable && RotMatrix.useCachedInverse && this.inverseState !== InverseMatrixState.unknown) {
        RotMatrix.numUseCache++;
        return this.inverseState === InverseMatrixState.inverseStored;
      }
      this.inverseState = InverseMatrixState.unknown;
      RotMatrix.numComputeCache++;
      const rowX = this.rowX(RotMatrix.rowX);
      const rowY = this.rowY(RotMatrix.rowY);
      const rowZ = this.rowZ(RotMatrix.rowZ);
      const crossXY = rowX.crossProduct(rowY, RotMatrix.crossXY);
      const crossYZ = rowY.crossProduct(rowZ, RotMatrix.crossYZ);
      const crossZX = rowZ.crossProduct(rowX, RotMatrix.crossZX);
      const d = rowX.dotProduct(crossYZ);  // that's the determinant
      if (d === 0.0) {     // better test?
        this.inverseState = InverseMatrixState.singular;
        this.inverseCoffs = undefined;
        return false;
      }
      const f = 1.0 / d;
      this.inverseState = InverseMatrixState.inverseStored;   // Currently just lists that the inverse has been stored... singular case not handled
      this.inverseCoffs = Float64Array.from([crossYZ.x * f, crossZX.x * f, crossXY.x * f,
      crossYZ.y * f, crossZX.y * f, crossXY.y * f,
      crossYZ.z * f, crossZX.z * f, crossXY.z * f]);
      return true;
    }
  */
  public static flatIndexOf(row: number, column: number): number {
    return 3 * Geometry.cyclic3dAxis(row) + Geometry.cyclic3dAxis(column);
  }

  /** Get a column by index (0,1,2), packaged as a Point4d with given weight.   Out of range index is interpreted cyclically.  */
  public indexedColumnWithWeight(index: number, weight: number, result?: Point4d): Point4d {
    index = Geometry.cyclic3dAxis(index);
    return Point4d.create(this.coffs[index], this.coffs[index + 3], this.coffs[index + 6], weight, result);
  }

  /** return the entry at specific row and column */
  public at(row: number, column: number): number {
    return this.coffs[RotMatrix.flatIndexOf(row, column)];
  }

  /** Set the entry at specific row and column */
  public setAt(row: number, column: number, value: number): void {
    this.coffs[RotMatrix.flatIndexOf(row, column)] = value;
    this.inverseState = InverseMatrixState.unknown;
  }

  /** create a RotMatrix whose columns are scaled copies of this RotMatrix.
   * @param scaleX scale factor for columns x
   * @param scaleY scale factor for column y
   * @param scaleZ scale factor for column z
   * @param result optional result.
   * */
  public scaleColumns(scaleX: number, scaleY: number, scaleZ: number, result?: RotMatrix): RotMatrix {
    return RotMatrix.createRowValues
      (
      this.coffs[0] * scaleX, this.coffs[1] * scaleY, this.coffs[2] * scaleZ,
      this.coffs[3] * scaleX, this.coffs[4] * scaleY, this.coffs[5] * scaleZ,
      this.coffs[6] * scaleX, this.coffs[7] * scaleY, this.coffs[8] * scaleZ,
      result);
  }

  /** create a RotMatrix whose columns are scaled copies of this RotMatrix.
   * @param scaleX scale factor for columns x
   * @param scaleY scale factor for column y
   * @param scaleZ scale factor for column z
   * @param result optional result.
   * */
  public scaleColumnsInPlace(scaleX: number, scaleY: number, scaleZ: number) {

    this.coffs[0] *= scaleX; this.coffs[1] *= scaleY; this.coffs[2] *= scaleZ;
    this.coffs[3] *= scaleX; this.coffs[4] *= scaleY; this.coffs[5] *= scaleZ;
    this.coffs[6] *= scaleX; this.coffs[7] *= scaleY; this.coffs[8] *= scaleZ;
    if (this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined) {
      // apply reciprocal scales to the ROWS of the inverse .  . .
      const divX = Geometry.conditionalDivideFraction(1.0, scaleX);
      const divY = Geometry.conditionalDivideFraction(1.0, scaleY);
      const divZ = Geometry.conditionalDivideFraction(1.0, scaleZ);
      if (divX !== undefined && divY !== undefined && divZ !== undefined) {
        this.inverseCoffs[0] *= divX; this.inverseCoffs[1] *= divX; this.inverseCoffs[2] *= divX;
        this.inverseCoffs[3] *= divY; this.inverseCoffs[4] *= divY; this.inverseCoffs[5] *= divY;
        this.inverseCoffs[6] *= divZ; this.inverseCoffs[7] *= divZ; this.inverseCoffs[8] *= divZ;
      } else
        this.inverseState = InverseMatrixState.singular;
    }
  }

  /** create a RotMatrix whose rows are scaled copies of this RotMatrix.
   * @param scaleX scale factor for row x
   * @param scaleY scale factor for row y
   * @param scaleZ scale factor for row z
   * @param result optional result.
   * */
  public scaleRows(scaleX: number, scaleY: number, scaleZ: number, result?: RotMatrix): RotMatrix {
    return RotMatrix.createRowValues
      (
      this.coffs[0] * scaleX, this.coffs[1] * scaleX, this.coffs[2] * scaleX,
      this.coffs[3] * scaleY, this.coffs[4] * scaleY, this.coffs[5] * scaleY,
      this.coffs[6] * scaleZ, this.coffs[7] * scaleZ, this.coffs[8] * scaleZ,
      result);
  }
  /**
   * add scaled values from other RotMatrix to this RotMatrix
   * @param other RotMatrix with values to be added
   * @param scale scale factor to apply to th eadded values.
   */
  public addScaledInPlace(other: RotMatrix, scale: number): void {
    for (let i = 0; i < 9; i++)
      this.coffs[i] += scale * other.coffs[i];
    this.inverseState = InverseMatrixState.unknown;
  }
  /** create a RotMatrix whose values are uniformly scaled from this.
   * @param scale scale factor to apply.
   * @param result optional result.
   * @returns Return the new or repopulated matrix
   */
  public scale(scale: number, result?: RotMatrix): RotMatrix {
    return RotMatrix.createRowValues
      (
      this.coffs[0] * scale, this.coffs[1] * scale, this.coffs[2] * scale,
      this.coffs[3] * scale, this.coffs[4] * scale, this.coffs[5] * scale,
      this.coffs[6] * scale, this.coffs[7] * scale, this.coffs[8] * scale,
      result);

  }

  /** Return the determinant of this matrix. */
  public determinant(): number {
    return this.coffs[0] * this.coffs[4] * this.coffs[8]
      - this.coffs[0] * this.coffs[7] * this.coffs[5]
      + this.coffs[3] * this.coffs[7] * this.coffs[2]
      - this.coffs[3] * this.coffs[1] * this.coffs[8]
      + this.coffs[6] * this.coffs[1] * this.coffs[5]
      - this.coffs[6] * this.coffs[4] * this.coffs[2];
  }

  /** Return an estimate of how independent the columns are.  Near zero is bad. */
  // ConditionNumber(): number;
  /** Return the sum of squares of all entries */
  public sumSquares(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a += this.coffs[i] * this.coffs[i];
    return a;
  }

  /** Return the sum of squares of diagonal entries */
  public sumDiagonalSquares(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i += 4)
      a += this.coffs[i] * this.coffs[i];
    return a;
  }

  /** Return the sum of diagonal entries (also known as the trace) */
  public sumDiagonal(): number {
    return this.coffs[0] + this.coffs[4] + this.coffs[8];
  }

  /** Return the Maximum absolute value of any single entry */
  public maxAbs(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a = Math.max(a, Math.abs(this.coffs[i]));
    return a;
  }

  /** Return the maximum absolute difference between corresponding entries */
  public maxDiff(other: RotMatrix): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a = Math.max(a, Math.abs(this.coffs[i] - other.coffs[i]));
    return a;
  }

  /** Test if the matrix is (very near to) an identity */
  public isIdentity(): boolean {
    return this.maxDiff(RotMatrix.identity) < Geometry.smallAngleRadians;

  }

  /** Test if the off diagonal entries are all nearly zero */
  public isDiagonal(): boolean {
    const sumAll = this.sumSquares();
    const sumDiagonal = this.sumDiagonalSquares();
    const sumOff = Math.abs(sumAll - sumDiagonal);
    return Math.sqrt(sumOff) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }

  /** Test if the below diagonal entries are all nearly zero */
  public isUpperTriangular(): boolean {
    const sumAll = this.sumSquares();
    const sumLow = Geometry.hypotenuseSquaredXYZ(this.coffs[3], this.coffs[6], this.coffs[7]);
    return Math.sqrt(sumLow) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }

  /** If the matrix is diagonal and all diagonals are within tolerance, return the first diagonal.  Otherwise return undefined.
   */
  public sameDiagonalScale(): number | undefined {
    const sumAll = this.sumSquares();
    const sumDiagonal = this.sumDiagonalSquares();
    const sumOff = Math.abs(sumAll - sumDiagonal);
    if (Math.sqrt(sumOff) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll))
      && Geometry.isSameCoordinate(this.coffs[0], this.coffs[4]) && Geometry.isSameCoordinate(this.coffs[0], this.coffs[8]))
      return this.coffs[0];
    return undefined;
  }

  /** Sum of squared differences between symmetric pairs */
  public sumSkewSquares(): number {
    return Geometry.hypotenuseSquaredXYZ(
      this.coffs[1] - this.coffs[3],
      this.coffs[2] - this.coffs[6],
      this.coffs[5] - this.coffs[7]);
  }

  /** Test if the matrix is a pure rotation. */
  public isRigid(allowMirror: boolean = false): boolean {
    return this.hasPerpendicularUnitRowsAndColumns() && (allowMirror || this.determinant() > 0);
  }
  /** Test if all rows and columns are perpendicular to each other and have equal length.
   * If so, the length (or its negative) is the scale factor from a set of rigid axes to these axes.
   * * result.rigidAxes is the rigid axes (with the scale factor removed)
   * * result.scale is the scale factor
   */
  public factorRigidWithSignedScale(): { rigidAxes: RotMatrix, scale: number } | undefined {
    const product = this.multiplyMatrixMatrixTranspose(this);
    const ss = product.sameDiagonalScale();
    if (ss === undefined || ss <= 0.0) return undefined;
    const s = this.determinant() > 0 ? Math.sqrt(ss) : -Math.sqrt(ss);
    const divS = 1.0 / s;
    const result = { rigidAxes: this.scaleColumns(divS, divS, divS), scale: s };
    return result;
  }

  /** Test if the matrix is shuffles and negates columns. */
  public isSignedPermutation(): boolean {
    let count = 0;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const q = this.at(row, col);
        if (q === 0) {// This comment makes the block non-empty
        } else if (q === 1 || q === -1) {
          // the rest of this row and column should be 0.
          // "at" will apply cyclic indexing.
          count++;
          if (this.at(row + 1, col) !== 0)
            return false;
          if (this.at(row + 2, col) !== 0)
            return false;
          if (this.at(row, col + 1) !== 0)
            return false;
          if (this.at(row, col + 2) !== 0)
            return false;
        } else {// entry is not from 0,1,-1 . . .
          return false;
        }
      }
    return count === 3;
  }

  /** Test if all rows and columns are length 1 and are perpendicular to each other.  (I.e. the matrix is either a pure rotation with uniform scale factor of 1 or -1) */
  public hasPerpendicularUnitRowsAndColumns(): boolean {
    const product = this.multiplyMatrixMatrixTranspose(this);
    return product.isIdentity();
  }
  /** create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse)
   * vectorA is placed in the first column of the axis order.
   * vectorB is projected perpendicular to vectorA within their plane and placed in the second column.
   */
  public static createRigidFromColumns(
    vectorA: Vector3d,
    vectorB: Vector3d,
    axisOrder: AxisOrder,
    result?: RotMatrix): RotMatrix | undefined {
    const vectorA1 = vectorA.normalize();
    if (vectorA1) {
      const vectorC1 = vectorA1.unitCrossProduct(vectorB);
      if (vectorC1) {
        const vectorB1 = vectorC1.unitCrossProduct(vectorA);
        if (vectorB1) {
          const retVal = RotMatrix.createShuffledColumns(vectorA1, vectorB1, vectorC1, axisOrder, result);
          retVal.setupInverseTranspose();
          return retVal;
        }
      }
    }
    return undefined;
  }

  /** create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse)
   * columns are taken from the source RotMatrix in order indicated by the axis order.
   */
  public static createRigidFromRotMatrix(
    source: RotMatrix,
    axisOrder: AxisOrder = AxisOrder.XYZ,
    result?: RotMatrix): RotMatrix | undefined {
    result = source.clone(result);
    result.axisOrderCrossProductsInPlace(axisOrder);
    if (result.normalizeColumnsInPlace())
      return result;
    return undefined;
  }
}

/** A transform is an origin and a RotMatrix.
 *
 * * This describes a coordinate frame with
 * this origin, with the columns of the RotMatrix being the
 * local x,y,z axis directions.
 * *  Beware that for common transformations (e.g. scale about point,
 * rotate around line, mirror across a plane) the "fixed point" that is used
 * when describing the transform is NOT the "origin" stored in the transform.
 * Setup methods (e.g createFixedPointAndMatrix, createScaleAboutPoint)
 * take care of determining the appropriate origin coordinates.
 */
export class Transform implements BeJSONFunctions {
  // static (one per class) vars for temporaries in computation.
  // ASSUME any user of these vars needs them only within its own scope
  // ASSUME no calls to other methods that use the same scratch.
  // When Transform was in the same file with Point3d, this was initialized right here.
  // But when split, there is a load order issue, so it has to be initialized at point-of-use
  private static scratchPoint: Point3d;
  private _origin: XYZ;
  private _matrix: RotMatrix;
  // Constructor accepts and uses POINTER to content .. no copy here.
  private constructor(origin: XYZ, matrix: RotMatrix) { this._origin = origin; this._matrix = matrix; }

  private static _identity?: Transform;
  /** The identity Transform. Value is frozen and cannot be modified. */
  public static get identity(): Transform {
    if (undefined === this._identity) {
      this._identity = Transform.createIdentity();
      this._identity.freeze();
    }

    return this._identity;
  }

  public freeze() { Object.freeze(this); Object.freeze(this._origin); this._matrix.freeze(); }
  public setFrom(other: Transform) { this._origin.setFrom(other._origin), this._matrix.setFrom(other._matrix); }
  /** Set this Transform to be an identity. */
  public setIdentity() { this._origin.setZero(); this._matrix.setIdentity(); }
  public setFromJSON(json?: TransformProps): void {
    if (json) {
      if (json instanceof Object && (json as any).origin && (json as any).matrix) {
        this._origin.setFromJSON((json as any).origin);
        this._matrix.setFromJSON((json as any).matrix);
        return;
      }
      if (Geometry.isArrayOfNumberArray(json, 3, 4)) {
        const data = json as number[][];
        this._matrix.setRowValues(
          data[0][0], data[0][1], data[0][2],
          data[1][0], data[1][1], data[1][2],
          data[2][0], data[2][1], data[2][2]);
        this._origin.set(data[0][3], data[1][3], data[2][3]);
        return;
      }

    }
    this.setIdentity();
  }
  /**
   * Test for near equality with other Transform.  Comparison uses the isAlmostEqual methods on
   * the origin and matrix parts.
   * @param other Transform to compare to.
   */
  public isAlmostEqual(other: Transform): boolean { return this._origin.isAlmostEqual(other._origin) && this._matrix.isAlmostEqual(other._matrix); }
  public toJSON(): TransformProps {
    // return { origin: this._origin.toJSON(), matrix: this._matrix.toJSON() };
    return [
      [this._matrix.coffs[0], this._matrix.coffs[1], this._matrix.coffs[2], this._origin.x],
      [this._matrix.coffs[3], this._matrix.coffs[4], this._matrix.coffs[5], this._origin.y],
      [this._matrix.coffs[6], this._matrix.coffs[7], this._matrix.coffs[8], this._origin.z],
    ];
  }

  public static fromJSON(json?: TransformProps): Transform {
    const result = Transform.createIdentity();
    result.setFromJSON(json);
    return result;
  }
  /** Copy the contents of this transform into a new Transform (or to the result, if specified). */
  public clone(result?: Transform): Transform {
    if (result) {
      result._matrix.setFrom(this._matrix);
      result._origin.setFrom(this._origin);
      return result;
    }
    return new Transform(
      Point3d.createFrom(this._origin),
      this._matrix.clone());
  }
  /** @returns Return a copy of this Transform, modified so that its axes are rigid
   */
  public cloneRigid(axisOrder: AxisOrder = AxisOrder.XYZ): Transform | undefined {
    const axes0 = RotMatrix.createRigidFromRotMatrix(this.matrix, axisOrder);
    if (!axes0)
      return undefined;
    return new Transform(this.origin.cloneAsPoint3d(), axes0);
  }
  /** Create a copy with the given origin and matrix captured as the Transform origin and RotMatrix. */
  public static createRefs(origin: XYZ, matrix: RotMatrix, result?: Transform): Transform {
    if (result) {
      result._origin = origin;
      result._matrix = matrix;
      return result;
    }
    return new Transform(origin, matrix);
  }
  /**
   * create a Transform with translation provided by x,y,z parts.
   * @param x x part of translation
   * @param y y part of translation
   * @param z z part of translation
   * @param result optional result
   * @returns new or updated transform.
   */
  public static createTranslationXYZ(x: number = 0, y: number = 0, z: number = 0, result?: Transform): Transform {
    return Transform.createRefs(Vector3d.create(x, y, z), RotMatrix.createIdentity(), result);
  }
  /** Create a matrix with specified translation part.
   * @param XYZ x,y,z parts of the translation.
   * @returns new or updated transform.
   */
  public static createTranslation(translation: XYZ, result?: Transform): Transform {
    return Transform.createRefs(translation, RotMatrix.createIdentity(), result);
  }

  /** Return a reference to the matrix within the transform.  (NOT a copy) */
  public get matrix(): RotMatrix { return this._matrix; }
  /** Return a reference to the origin within the transform.  (NOT a copy) */
  public get origin(): XYZ { return this._origin; }

  /** return a (clone of) the origin part of the transform, as a Point3d */
  public getOrigin(): Point3d { return Point3d.createFrom(this._origin); }

  /** return a (clone of) the origin part of the transform, as a Vector3d */
  public getTranslation(): Vector3d { return Vector3d.createFrom(this._origin); }

  /** test if the transform has 000 origin and identity RotMatrix */
  public isIdentity(): boolean {
    return this._matrix.isIdentity() && this._origin.isAlmostZero();
  }
  /** Return an identity transform, optionally filling existing transform.  */
  public static createIdentity(result?: Transform): Transform {
    if (result) {
      result._origin.setZero();
      result._matrix.setIdentity();
      return result;
    }
    return Transform.createRefs(Point3d.createZero(), RotMatrix.createIdentity());
  }
  /** Create by directly installing origin and matrix
   * this is a the appropriate construction when the columns of the matrix are coordinate axes of a local-to-global mapping
   * Note there is a closely related createFixedPointAndMatrix whose point input is the fixed point of the global-to-global transformation.
   */
  public static createOriginAndMatrix(origin: XYZ | undefined, matrix: RotMatrix | undefined, result?: Transform): Transform {
    return Transform.createRefs(
      origin ? origin.cloneAsPoint3d() : Point3d.createZero(),
      matrix === undefined ? RotMatrix.createIdentity() : matrix.clone(), result);
  }
  /** Create by directly installing origin and columns of the matrix
  */
  public static createOriginAndMatrixColumns(origin: XYZ, vectorX: Vector3d, vectorY: Vector3d, vectorZ: Vector3d, result?: Transform): Transform {
    if (result)
      result.setOriginAndMatrixColumns(origin, vectorX, vectorY, vectorZ);
    else
      result = Transform.createRefs(Vector3d.createFrom(origin), RotMatrix.createColumns(vectorX, vectorY, vectorZ));
    return result;
  }
  /** Reinitialize by directly installing origin and columns of the matrix
   */
  public setOriginAndMatrixColumns(origin: XYZ, vectorX: Vector3d, vectorY: Vector3d, vectorZ: Vector3d) {
    this._origin.setFrom(origin);
    this._matrix.setColumns(vectorX, vectorY, vectorZ);
  }

  /** Create a transform with the specified matrix. Compute an origin (different from the given fixedPoint)
   * so that the fixedPoint maps back to itself.
   */
  public static createFixedPointAndMatrix(fixedPoint: Point3d, matrix: RotMatrix, result?: Transform): Transform {
    const origin = RotMatrix.XYZMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
    return Transform.createRefs(origin, matrix.clone(), result);
  }
  /** Create a Transform which leaves the fixedPoint unchanged and
   * scales everything else around it by a single scale factor.
   */
  public static createScaleAboutPoint(fixedPoint: Point3d, scale: number, result?: Transform): Transform {
    const matrix = RotMatrix.createScale(scale, scale, scale);
    const origin = RotMatrix.XYZMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
    return Transform.createRefs(origin, matrix, result);
  }

  /** Transform the input 2d point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyPoint2d(source: XAndY, result?: Point2d): Point2d {
    return RotMatrix.XYPlusMatrixTimesXY(this._origin, this._matrix, source, result);
  }

  /** Transform the input 3d point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyPoint3d(point: XYAndZ, result?: Point3d): Point3d {
    return RotMatrix.XYZPlusMatrixTimesXYZ(this._origin, this._matrix, point, result);
  }

  /** Transform the input point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZ(x: number, y: number, z: number, result?: Point3d): Point3d {
    return RotMatrix.XYZPlusMatrixTimesCoordinates(this._origin, this._matrix, x, y, z, result);
  }

  /** Transform the input homogeneous point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    return RotMatrix.XYZPlusMatrixTimesWeightedCoordinates(this._origin, this._matrix, x, y, z, w, result);
  }
  /** for each point:  replace point by Transform*point */
  public multiplyPoint3dArrayInPlace(points: Point3d[]) {
    let point;
    for (point of points)
      RotMatrix.XYZPlusMatrixTimesXYZ(this._origin, this._matrix, point, point);
  }

  /** @returns Return product of the transform's inverse times a point. */
  public multiplyInversePoint3d(point: XYAndZ, result?: Point3d): Point3d | undefined {
    return this._matrix.multiplyInverseXYZAsPoint3d(
      point.x - this._origin.x,
      point.y - this._origin.y,
      point.z - this._origin.z,
      result);
  }
  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyInversePoint3dArray(source: Point3d[], result?: Point3d[]): Point3d[] | undefined {
    if (!this._matrix.computeCachedInverse(true))
      return undefined;
    const originX = this.origin.x;
    const originY = this.origin.y;
    const originZ = this.origin.z;
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point3d.createZero);
      for (let i = 0; i < n; i++)
        this._matrix.multiplyInverseXYZAsPoint3d(
          source[i].x - originX,
          source[i].y - originY,
          source[i].z - originZ,
          result[i]);
    }
    result = [];
    for (const p of source)
      result.push(this._matrix.multiplyInverseXYZAsPoint3d(
        p.x - originX,
        p.y - originY,
        p.z - originZ)!);

    return result;
  }
  /**
    * *  for each point:   multiply    transform * point
    * *  if result is given, resize to match source and replace each corresponding pi
    * *  if result is not given, return a new array.
    */
  public multiplyInversePoint3dArrayInPlace(source: Point3d[]): void {
    if (!this._matrix.computeCachedInverse(true))
      return undefined;
    const originX = this.origin.x;
    const originY = this.origin.y;
    const originZ = this.origin.z;
    const n = source.length;
    for (let i = 0; i < n; i++)
      this._matrix.multiplyInverseXYZAsPoint3d(
        source[i].x - originX,
        source[i].y - originY,
        source[i].z - originZ,
        source[i]);
  }
  // modify destination so it has non-null points for the same length as the source.
  // (ASSUME existing elements of dest are non-null, and that parameters are given as either Point2d or Point3d arrays)
  public static matchArrayLengths(source: any[], dest: any[], constructionFunction: () => any): number {
    const numSource = source.length;
    const numDest = dest.length;
    if (numSource > numDest) {
      for (let i = numDest; i < numSource; i++) {
        dest.push(constructionFunction());
      }
    } else if (numDest > numSource) {
      dest.length = numSource;
    }
    return numSource;
  }

  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyPoint2dArray(source: Point2d[], result?: Point2d[]): Point2d[] {
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point2d.createZero);
      for (let i = 0; i < n; i++)
        RotMatrix.XYPlusMatrixTimesXY(this._origin, this._matrix, source[i], result[i]);
      return result;
    }
    result = [];
    for (const p of source)
      result.push(RotMatrix.XYPlusMatrixTimesXY(this._origin, this._matrix, p));

    return result;
  }
  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyPoint3dArray(source: Point3d[], result?: Point3d[]): Point3d[] {
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point3d.createZero);
      for (let i = 0; i < n; i++)
        RotMatrix.XYZPlusMatrixTimesXYZ(this._origin, this._matrix, source[i], result[i]);
      return result;
    }
    result = [];
    for (const p of source)
      result.push(RotMatrix.XYZPlusMatrixTimesXYZ(this._origin, this._matrix, p));

    return result;
  }

  /** Multiply the vector by the RotMatrix part of the transform.
   *
   * *  The transform's origin is not used.
   * *  Return as new or result by usual optional result convention
   */
  public multiplyVector(vector: Vector3d, result?: Vector3d): Vector3d {
    return this._matrix.multiplyVector(vector, result);
  }
  /** Multiply the vector (x,y,z) by the RotMatrix part of the transform.
 *
 * *  The transform's origin is not used.
 * *  Return as new or result by usual optional result convention
 */
  public multiplyVectorXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    return this._matrix.multiplyXYZ(x, y, z, result);
  }
  /** multiply this Transform times other Transform.
   * @param other right hand transform for multiplication.
   * @param result optional preallocated result to reuse.
  */
  public multiplyTransformTransform(other: Transform, result?: Transform) {
    if (!result)
      return Transform.createRefs(
        RotMatrix.XYZPlusMatrixTimesXYZ(this._origin, this._matrix, other._origin),
        this._matrix.multiplyMatrixMatrix(other._matrix));
    result.setMultiplyTransformTransform(this, other);
    return result;
  }
  /**
   * multiply transformA * transformB, store to calling instance.
   * @param transformA left operand
   * @param transformB right operand
   */
  public setMultiplyTransformTransform(transformA: Transform, transformB: Transform): void {
    if (Transform.scratchPoint === undefined)
      Transform.scratchPoint = Point3d.create();
    RotMatrix.XYZPlusMatrixTimesXYZ(transformA._origin, transformA._matrix, transformB._origin, Transform.scratchPoint);
    this._origin.setFrom(Transform.scratchPoint);
    transformA._matrix.multiplyMatrixMatrix(transformB._matrix, this._matrix);
  }
  //   [Q A][R 0] = [QR A]
  //   [0 1][0 1]   [0  1]
  /** multiply this Transform times other RotMatrix, with other considered to be a Transform with 0 translation.
   * @param other right hand RotMatrix for multiplication.
   * @param result optional preallocated result to reuse.
  */
  public multiplyTransformRotMatrix(other: RotMatrix, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this._origin.cloneAsPoint3d(),
        this._matrix.multiplyMatrixMatrix(other));
    this._matrix.multiplyMatrixMatrix(other, result._matrix);
    result._origin.setFrom(this._origin);
    return result;
  }

  /** transform each of the 8 corners of a range. Return the range of the transformed corers */
  public multiplyRange(range: Range3d, result?: Range3d): Range3d {
    // snag current values to allow aliasing.
    const lowx = range.low.x;
    const lowy = range.low.y;
    const lowz = range.low.z;
    const highx = range.high.x;
    const highy = range.high.y;
    const highz = range.high.z;
    result = Range3d.createNull(result);
    result.extendTransformedXYZ(this, lowx, lowy, lowz);
    result.extendTransformedXYZ(this, highx, lowy, lowz);
    result.extendTransformedXYZ(this, lowx, highy, lowz);
    result.extendTransformedXYZ(this, highx, highy, lowz);

    result.extendTransformedXYZ(this, lowx, lowy, highz);
    result.extendTransformedXYZ(this, highx, lowy, highz);
    result.extendTransformedXYZ(this, lowx, highy, highz);
    result.extendTransformedXYZ(this, highx, highy, highz);
    return result;
  }
  /**
   * @returns Return a Transform which is the inverse of this transform. Return undefined if this Transform's matrix is singular.
   */
  public inverse(): Transform | undefined {
    const matrixInverse = this._matrix.inverse();
    if (!matrixInverse)
      return undefined;
    return Transform.createRefs(
      matrixInverse.multiplyXYZ(-this._origin.x, -this._origin.y, -this._origin.z),
      matrixInverse);
  }
  /** Initialize transforms that map each direction of a box (axis aligned) to `[0,1]`.
   * @param min the "000" corner of the box
   * @param max the "111" corner of the box
   * @param npcToGlobal (object created by caller, re-initialized) transform that carries 01 coordinates into the min,max box.
   * @param globalToNpc (object created by caller, re-initialized) transform that carries world coordinates into 01
   */
  public static initFromRange(min: Point3d, max: Point3d, npcToGlobal?: Transform, globalToNpc?: Transform) {
    const diag = max.minus(min);
    if (diag.x === 0.0) diag.x = 1.0;
    if (diag.y === 0.0) diag.y = 1.0;
    if (diag.z === 0.0) diag.z = 1.0;

    const rMatrix = new RotMatrix();
    if (npcToGlobal) {
      RotMatrix.createScale(diag.x, diag.y, diag.z, rMatrix);
      Transform.createOriginAndMatrix(min, rMatrix, npcToGlobal);
    }

    if (globalToNpc) {
      const origin = new Point3d(- min.x / diag.x, - min.y / diag.y, - min.z / diag.z);
      RotMatrix.createScale(1.0 / diag.x, 1.0 / diag.y, 1.0 / diag.z, rMatrix);
      Transform.createOriginAndMatrix(origin, rMatrix, globalToNpc);
    }
  }
}
