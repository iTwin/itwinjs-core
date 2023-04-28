/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.geom;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "./Bounds";
import { Coordinate } from "./Coordinate";

/**
 * Class Transform defines a generic 3D transformation.
 *
 * @version 1.0 November 2015
 */
/** @internal */
export class Transform {
  /** The 16 elements (row major order) */
  private _elements: Float64Array;

  /**
   * Create a new (identity) transform.
   */
  public constructor() {
    this._elements = new Float64Array(16);
    this._elements[0] = 1.0; // m00
    this._elements[1] = 0.0; // m01
    this._elements[2] = 0.0; // m02
    this._elements[3] = 0.0; // m03
    this._elements[4] = 0.0; // m10
    this._elements[5] = 1.0; // m11
    this._elements[6] = 0.0; // m12
    this._elements[7] = 0.0; // m13
    this._elements[8] = 0.0; // m20
    this._elements[9] = 0.0; // m21
    this._elements[10] = 1.0; // m22
    this._elements[11] = 0.0; // m23
    this._elements[12] = 0.0; // m30
    this._elements[13] = 0.0; // m31
    this._elements[14] = 0.0; // m32
    this._elements[15] = 1.0; // m33
  }

  /**
   * Create a new (identity) transform.
   */
  public static create(): Transform {
    return new Transform();
  }

  /**
   * Create a transformation from elements.
   * @param elements the 16 matrix elements (row major order).
   * @return the transformation.
   */
  public static fromRowMajor(elements: Float64Array): Transform {
    if (elements == null) return null;
    if (elements.length == 0) return null;
    let transform: Transform = new Transform();
    let index: int32 = 0;
    for (let r: number = 0; r < 4; r++)
      for (let c: number = 0; c < 4; c++) transform.setElement(r, c, elements[index++]);
    return transform;
  }

  /**
   * Create a transformation from elements.
   * @param elements the 16 matrix elements (column major order).
   * @return the transformation.
   */
  public static fromColumnMajor(elements: Float64Array): Transform {
    if (elements == null) return null;
    if (elements.length == 0) return null;
    let transform: Transform = new Transform();
    let index: int32 = 0;
    for (let c: number = 0; c < 4; c++)
      for (let r: number = 0; r < 4; r++) transform.setElement(r, c, elements[index++]);
    return transform;
  }

  /**
   * Create a transformation from elements.
   * @param elements the 9 matrix elements (row major order).
   * @return the transformation.
   */
  public static fromRotationElements(
    m00: float64,
    m01: float64,
    m02: float64,
    m10: float64,
    m11: float64,
    m12: float64,
    m20: float64,
    m21: float64,
    m22: float64
  ): Transform {
    let transform: Transform = new Transform();
    transform.setElement(0, 0, m00);
    transform.setElement(0, 1, m01);
    transform.setElement(0, 2, m02);
    transform.setElement(1, 0, m10);
    transform.setElement(1, 1, m11);
    transform.setElement(1, 2, m12);
    transform.setElement(2, 0, m20);
    transform.setElement(2, 1, m21);
    transform.setElement(2, 2, m22);
    return transform;
  }

  /**
   * Create a transformation from elements.
   * @param elements the 16 matrix elements (row major order).
   * @return the transformation.
   */
  public static fromElements(
    m00: float64,
    m01: float64,
    m02: float64,
    m03: float64,
    m10: float64,
    m11: float64,
    m12: float64,
    m13: float64,
    m20: float64,
    m21: float64,
    m22: float64,
    m23: float64
  ): Transform {
    let transform: Transform = Transform.fromRotationElements(m00, m01, m02, m10, m11, m12, m20, m21, m22);
    transform.setElement(0, 3, m03);
    transform.setElement(1, 3, m13);
    transform.setElement(2, 3, m23);
    return transform;
  }

  /**
   * Get an element.
   * @param index the index of the element.
   * @return the element.
   */
  public get(index: int32): float64 {
    return this._elements[index];
  }

  /**
   * Set an element.
   * @param index the index of the element.
   * @param value the value.
   */
  public set(index: int32, value: float64): void {
    this._elements[index] = value;
  }

  /**
   * Get an element.
   * @param row the row index.
   * @param col the column index.
   * @return the element.
   */
  public getElement(row: int32, col: int32): float64 {
    return this._elements[row * 4 + col];
  }

  /**
   * Set an element.
   * @param row the row index.
   * @param col the column index.
   * @param value the value.
   */
  public setElement(row: int32, col: int32, value: float64): void {
    this._elements[row * 4 + col] = value;
  }

  /**
   * Get the elements.
   * @return the elements (row major order).
   */
  public getElements(): Float64Array {
    return this._elements;
  }

  /**
   * Set the elements.
   * @param elements the elements (row major order).
   */
  public setElements(elements: Float64Array): void {
    for (let i: number = 0; i < this._elements.length; i++) this._elements[i] = elements[i];
  }

  /**
   * Get the X column.
   * @return the X column.
   */
  public getColumnX(): Coordinate {
    return new Coordinate(this.getElement(0, 0), this.getElement(1, 0), this.getElement(2, 0));
  }

  /**
   * Get the Y column.
   * @return the Y column.
   */
  public getColumnY(): Coordinate {
    return new Coordinate(this.getElement(0, 1), this.getElement(1, 1), this.getElement(2, 1));
  }

  /**
   * Get the Z column.
   * @return the Z column.
   */
  public getColumnZ(): Coordinate {
    return new Coordinate(this.getElement(0, 2), this.getElement(1, 2), this.getElement(2, 2));
  }

  /**
   * Get the translation column.
   * @return the translation column.
   */
  public getTranslation(): Coordinate {
    return new Coordinate(this.getElement(0, 3), this.getElement(1, 3), this.getElement(2, 3));
  }

  /**
   * Set the translation.
   * @param tx the x position of the translation.
   * @param ty the y position of the translation.
   * @param tz the z position of the translation.
   * @return the tranformation.
   */
  public setTranslation(tx: float64, ty: float64, tz: float64): Transform {
    this.setElement(0, 3, tx);
    this.setElement(1, 3, ty);
    this.setElement(2, 3, tz);
    return this;
  }

  /**
   * Clear the translation.
   * @return the tranformation.
   */
  public clearTranslation(): Transform {
    this.setElement(0, 3, 0.0);
    this.setElement(1, 3, 0.0);
    this.setElement(2, 3, 0.0);
    return this;
  }

  /**
   * Swap two rows.
   * @param row1 the first row.
   * @param row2 the second row.
   */
  public swapRows(row1: int32, row2: int32): void {
    for (let i: number = 0; i < 4; i++) {
      let e1: float64 = this.getElement(row1, i);
      let e2: float64 = this.getElement(row2, i);
      this.setElement(row1, i, e2);
      this.setElement(row2, i, e1);
    }
  }

  /**
   * Swap two columns.
   * @param col1 the first column.
   * @param col2 the second column.
   */
  public swapColumns(col1: int32, col2: int32): void {
    for (let i: number = 0; i < 4; i++) {
      let e1: float64 = this.getElement(i, col1);
      let e2: float64 = this.getElement(i, col2);
      this.setElement(i, col1, e2);
      this.setElement(i, col2, e1);
    }
  }

  /**
   * Swap the YZ coordinates.
   */
  public swapYZ(): void {
    let result: Transform = Transform.multiply2(this, Transform.createSwapYZ());
    this.setElements(result.getElements());
  }

  /**
   * Calculate the cosine of an angle.
   * @param angle the angle (in degrees).
   * @return the cosine.
   */
  public static cos(angle: float64): float64 {
    /* One? */
    if (angle == 0.0) return 1.0;
    if (angle == 360.0) return 1.0;
    /* Minus one? */
    if (angle == 180.0) return -1.0;
    if (angle == -180.0) return -1.0;
    /* Zero? */
    if (angle == 90.0) return 0.0;
    if (angle == -90.0) return 0.0;
    if (angle == 270.0) return 0.0;
    /* Calculate */
    return Math.cos((angle / 180.0) * Math.PI);
  }

  /**
   * Calculate the sine of an angle.
   * @param angle the angle (in degrees).
   * @return the sine.
   */
  public static sin(angle: float64): float64 {
    /* One? */
    if (angle == 90.0) return 1.0;
    /* Minus one? */
    if (angle == -90.0) return -1.0;
    if (angle == 270.0) return -1.0;
    /* Zero? */
    if (angle == 0.0) return 0.0;
    if (angle == 360.0) return 0.0;
    if (angle == 180.0) return 0.0;
    if (angle == -180.0) return 0.0;
    /* Calculate */
    return Math.sin((angle / 180.0) * Math.PI);
  }

  /**
   * Rotate around the X axis.
   * @param angle the rotation angle (degree).
   */
  public rotateX(angle: float64): void {
    if (angle == 0.0) return;
    let result: Transform = Transform.multiply2(this, Transform.createRotationX(angle));
    this.setElements(result.getElements());
  }

  /**
   * Apply a rotation around X axis.
   * @param point the (mutable) point to rotate.
   * @param rotation the (Y->Z,counterclockwise) rotation (degrees).
   */
  public static rotatePointX(point: Coordinate, rotation: float64): void {
    if (rotation == 0.0) return;
    let a: float64 = rotation;
    let dcos: float64 = Transform.cos(a);
    let dsin: float64 = Transform.sin(a);
    let ny: float64 = dcos * point.getY() - dsin * point.getZ();
    let nz: float64 = dsin * point.getY() + dcos * point.getZ();
    point.setXYZ(point.getX(), ny, nz);
  }

  /**
   * Rotate around the Y axis.
   * @param angle the rotation angle (degree).
   */
  public rotateY(angle: float64): void {
    if (angle == 0.0) return;
    let result: Transform = Transform.multiply2(this, Transform.createRotationY(angle));
    this.setElements(result.getElements());
  }

  /**
   * Apply a rotation around Y axis.
   * @param point the (mutable) point to rotate.
   * @param rotation the (Z->X,counterclockwise) rotation (degrees).
   */
  public static rotatePointY(point: Coordinate, rotation: float64): void {
    if (rotation == 0.0) return;
    let a: float64 = -rotation; // swapped orientation to CCW on 09/03/2012
    let dcos: float64 = Transform.cos(a);
    let dsin: float64 = Transform.sin(a);
    let nx: float64 = dcos * point.getX() - dsin * point.getZ();
    let nz: float64 = dsin * point.getX() + dcos * point.getZ();
    point.setXYZ(nx, point.getY(), nz);
  }

  /**
   * Rotate around the Z axis.
   * @param angle the rotation angle (degree).
   */
  public rotateZ(angle: float64): void {
    if (angle == 0.0) return;
    let result: Transform = Transform.multiply2(this, Transform.createRotationZ(angle));
    this.setElements(result.getElements());
  }

  /**
   * Apply a rotation around Z axis.
   * @param point the (mutable) point to rotate.
   * @param rotation the (X->Y,counterclockwise) rotation (degrees).
   */
  public static rotatePointZ(point: Coordinate, rotation: float64): void {
    if (rotation == 0.0) return;
    let a: float64 = rotation;
    let dcos: float64 = Transform.cos(a);
    let dsin: float64 = Transform.sin(a);
    let nx: float64 = dcos * point.getX() - dsin * point.getY();
    let ny: float64 = dsin * point.getX() + dcos * point.getY();
    point.setXYZ(nx, ny, point.getZ());
  }

  /**
   * Multiply two matrices.
   * @param a the first transform.
   * @param b the second transform.
   * @return the result transform (a x b).
   */
  public static multiply2(a: Transform, b: Transform): Transform {
    /* Allow nulls */
    if (a == null) a = new Transform();
    if (b == null) b = new Transform();
    /* Fill the destination transform "d" */
    let d: Transform = new Transform();
    for (let i: number = 0; i < 4; i++) {
      /* Get the next row from "a" */
      let ai0: float64 = a.getElement(i, 0);
      let ai1: float64 = a.getElement(i, 1);
      let ai2: float64 = a.getElement(i, 2);
      let ai3: float64 = a.getElement(i, 3);
      /* Set the target row in "d" */
      d.setElement(
        i,
        0,
        ai0 * b.getElement(0, 0) + ai1 * b.getElement(1, 0) + ai2 * b.getElement(2, 0) + ai3 * b.getElement(3, 0)
      ); // multiply by column(0) of "b"
      d.setElement(
        i,
        1,
        ai0 * b.getElement(0, 1) + ai1 * b.getElement(1, 1) + ai2 * b.getElement(2, 1) + ai3 * b.getElement(3, 1)
      ); // multiply by column(1) of "b"
      d.setElement(
        i,
        2,
        ai0 * b.getElement(0, 2) + ai1 * b.getElement(1, 2) + ai2 * b.getElement(2, 2) + ai3 * b.getElement(3, 2)
      ); // multiply by column(2) of "b"
      d.setElement(
        i,
        3,
        ai0 * b.getElement(0, 3) + ai1 * b.getElement(1, 3) + ai2 * b.getElement(2, 3) + ai3 * b.getElement(3, 3)
      ); // multiply by column(3) of "b"
    }
    /* Return the transform */
    return d;
  }

  /**
   * Concatenate a transform.
   * @param transform the transform to concatenate.
   * @return the combined transformation.
   */
  public concat(transform: Transform): Transform {
    return Transform.multiply2(this, transform);
  }

  /**
   * Multiply.
   * @param transform the transform to multiply with.
   */
  public multiply(transform: Transform): void {
    let result: Transform = Transform.multiply2(this, transform);
    this.setElements(result.getElements());
  }

  /**
   * Translate.
   * @param tx the x translation.
   * @param ty the y translation.
   * @param tz the z translation.
   */
  public translate(tx: float64, ty: float64, tz: float64): void {
    let result: Transform = Transform.multiply2(this, Transform.createTranslation(tx, ty, tz));
    this.setElements(result.getElements());
  }

  /**
   * Translate.
   * @param point the xyz translation.
   */
  public translatePoint(point: Coordinate): void {
    this.translate(point.getX(), point.getY(), point.getZ());
  }

  /**
   * Scale.
   * @param sx the x scale.
   * @param sy the y scale.
   * @param sz the z scale.
   */
  public scale(sx: float64, sy: float64, sz: float64): void {
    let result: Transform = Transform.multiply2(this, Transform.createScale(sx, sy, sz));
    this.setElements(result.getElements());
  }

  /**
   * Scale XYZ.
   * @param s the scale.
   */
  public scale3(s: float64): void {
    this.scale(s, s, s);
  }

  /**
   * Create the inverse transform.
   * @return the inverse transform.
   */
  public createInverse(): Transform {
    /* Get the 3x3 elements */
    let a: float64 = this.getElement(0, 0);
    let b: float64 = this.getElement(0, 1);
    let c: float64 = this.getElement(0, 2);
    let d: float64 = this.getElement(1, 0);
    let e: float64 = this.getElement(1, 1);
    let f: float64 = this.getElement(1, 2);
    let g: float64 = this.getElement(2, 0);
    let h: float64 = this.getElement(2, 1);
    let i: float64 = this.getElement(2, 2);
    /* Invert the 3x3 matrix */
    let idet: float64 = 1.0 / (a * (e * i - h * f) - b * (d * i - g * f) + c * (d * h - g * e));
    let inverse: Transform = new Transform();
    inverse.setElement(0, 0, (e * i - f * h) * idet);
    inverse.setElement(0, 1, -(b * i - c * h) * idet);
    inverse.setElement(0, 2, (b * f - c * e) * idet);
    inverse.setElement(1, 0, -(d * i - f * g) * idet);
    inverse.setElement(1, 1, (a * i - c * g) * idet);
    inverse.setElement(1, 2, -(a * f - c * d) * idet);
    inverse.setElement(2, 0, (d * h - e * g) * idet);
    inverse.setElement(2, 1, -(a * h - b * g) * idet);
    inverse.setElement(2, 2, (a * e - b * d) * idet);
    /* Invert the translation */
    let t: Coordinate = new Coordinate(this.getElement(0, 3), this.getElement(1, 3), this.getElement(2, 3));
    inverse.transformTo(t, t);
    inverse.setElement(0, 3, -t.getX());
    inverse.setElement(1, 3, -t.getY());
    inverse.setElement(2, 3, -t.getZ());
    /* Done */
    return inverse;
  }

  /**
   * Invert.
   */
  public invert(): void {
    let result: Transform = this.createInverse();
    this.setElements(result.getElements());
  }

  /**
   * Create a copy.
   * @return a copy.
   */
  public copy(): Transform {
    let copy: Transform = new Transform();
    for (let i: number = 0; i < 16; i++) copy._elements[i] = this._elements[i];
    return copy;
  }

  /**
   * Create an identity transform.
   * @return the transform.
   */
  public static createIdentity(): Transform {
    return new Transform();
  }

  /**
   * Create a translation transform.
   * @param tx the x translation.
   * @param ty the y translation.
   * @param tz the z translation.
   * @return the transform.
   */
  public static createTranslation(tx: float64, ty: float64, tz: float64): Transform {
    let transform: Transform = Transform.createIdentity();
    transform.setElement(0, 3, tx);
    transform.setElement(1, 3, ty);
    transform.setElement(2, 3, tz);
    return transform;
  }

  /**
   * Create a translation transform.
   * @param position the translation.
   * @return the transform.
   */
  public static createTranslation2(position: Coordinate): Transform {
    return Transform.createTranslation(position.getX(), position.getY(), position.getZ());
  }

  /**
   * Create a scale transform.
   * @param sx the x translation.
   * @param sy the y translation.
   * @param sz the z translation.
   * @return the transform.
   */
  public static createScale(sx: float64, sy: float64, sz: float64): Transform {
    let transform: Transform = Transform.createIdentity();
    transform.setElement(0, 0, sx);
    transform.setElement(1, 1, sy);
    transform.setElement(2, 2, sz);
    return transform;
  }

  /**
   * Create a rotation-round-X transform.
   * @param angle the rotation angle (degree).
   * @return the transform.
   */
  public static createRotationX(angle: float64): Transform {
    let rad: float64 = (angle / 180.0) * Math.PI;
    let sin: float64 = angle == 90.0 ? 1.0 : Math.sin(rad);
    let cos: float64 = angle == 90.0 ? 0.0 : Math.cos(rad);
    let transform: Transform = Transform.createIdentity();
    transform.setElement(1, 1, cos);
    transform.setElement(2, 1, sin);
    transform.setElement(1, 2, -sin);
    transform.setElement(2, 2, cos);
    return transform;
  }

  /**
   * Create a rotation-round-Y transform.
   * @param angle the rotation angle (degree).
   * @return the transform.
   */
  public static createRotationY(angle: float64): Transform {
    let rad: float64 = (angle / 180.0) * Math.PI;
    let sin: float64 = Math.sin(rad);
    let cos: float64 = Math.cos(rad);
    let transform: Transform = Transform.createIdentity();
    transform.setElement(0, 0, cos);
    transform.setElement(2, 0, -sin);
    transform.setElement(0, 2, sin);
    transform.setElement(2, 2, cos);
    return transform;
  }

  /**
   * Create a rotation-round-Z transform.
   * @param angle the rotation angle (degree).
   * @return the transform.
   */
  public static createRotationZ(angle: float64): Transform {
    let rad: float64 = (angle / 180.0) * Math.PI;
    let sin: float64 = Math.sin(rad);
    let cos: float64 = Math.cos(rad);
    let transform: Transform = Transform.createIdentity();
    transform.setElement(0, 0, cos);
    transform.setElement(1, 0, sin);
    transform.setElement(0, 1, -sin);
    transform.setElement(1, 1, cos);
    return transform;
  }

  /**
   * Create a swap YZ transform.
   * @return the transform.
   */
  public static createSwapYZ(): Transform {
    let transform: Transform = Transform.createIdentity();
    transform.setElement(1, 1, 0.0);
    transform.setElement(1, 2, 1.0);
    transform.setElement(2, 1, 1.0);
    transform.setElement(2, 2, 0.0);
    return transform;
  }

  /**
   * Create a transformation from elements.
   * @param elements the elements (row major order)
   * @return the transformation.
   */
  public static createWithElements(elements: Float64Array): Transform {
    let transform: Transform = Transform.createIdentity();
    transform.setElements(elements);
    return transform;
  }

  /**
   * Create a transformation from columns.
   * @param col0 the first column.
   * @param col1 the second column.
   * @param col2 the third column.
   * @param col3 the fourth column (considered zero if null).
   * @return the transformation.
   */
  public static createWithColumns(col0: Coordinate, col1: Coordinate, col2: Coordinate, col3: Coordinate): Transform {
    let transform: Transform = Transform.createIdentity();
    transform.setElement(0, 0, col0.getX());
    transform.setElement(1, 0, col0.getY());
    transform.setElement(2, 0, col0.getZ());
    transform.setElement(0, 1, col1.getX());
    transform.setElement(1, 1, col1.getY());
    transform.setElement(2, 1, col1.getZ());
    transform.setElement(0, 2, col2.getX());
    transform.setElement(1, 2, col2.getY());
    transform.setElement(2, 2, col2.getZ());
    if (col3 != null) {
      transform.setElement(0, 3, col3.getX());
      transform.setElement(1, 3, col3.getY());
      transform.setElement(2, 3, col3.getZ());
    }
    return transform;
  }

  /**
   * Create an orthogonal rotation from a quaternion.
   * @param a the first quaternion element (q1).
   * @param b the second quaternion element (q2).
   * @param c the third quaternion element (q3).
   * @param d the fourth quaternion element (q4).
   * @return the rotation matrix.
   */
  public static fromQuaternion(a: float64, b: float64, c: float64, d: float64): Transform {
    // See "Quaternions and spatial rotation" section "From a quaternion to an orthogonal matrix"
    // at https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
    //
    /* We should have a unit quaternion */
    let len: float64 = a * a + b * b + c * c + d * d;
    /* First row */
    let m00: float64 = a * a + b * b - c * c - d * d;
    let m01: float64 = 2.0 * b * c - 2.0 * a * d;
    let m02: float64 = 2.0 * b * d + 2.0 * a * c;
    /* Second row */
    let m10: float64 = 2.0 * b * c + 2.0 * a * d;
    let m11: float64 = a * a - b * b + c * c - d * d;
    let m12: float64 = 2.0 * c * d - 2.0 * a * b;
    /* Third row */
    let m20: float64 = 2.0 * b * d - 2.0 * a * c;
    let m21: float64 = 2.0 * c * d + 2.0 * a * b;
    let m22: float64 = a * a - b * b - c * c + d * d;
    /* Return the rotation */
    let transform: Transform = new Transform();
    transform.setElement(0, 0, m00);
    transform.setElement(0, 1, m01);
    transform.setElement(0, 2, m02);
    transform.setElement(1, 0, m10);
    transform.setElement(1, 1, m11);
    transform.setElement(1, 2, m12);
    transform.setElement(2, 0, m20);
    transform.setElement(2, 1, m21);
    transform.setElement(2, 2, m22);
    return transform;
  }

  /**
   * Transform a point.
   * @param source the source point.
   * @param target the target point (can be same as source).
   * @return the target point.
   */
  public transformTo(source: Coordinate, target: Coordinate): Coordinate {
    let sx: float64 = source.getX();
    let sy: float64 = source.getY();
    let sz: float64 = source.getZ();
    target.x = this._elements[0] * sx + this._elements[1] * sy + this._elements[2] * sz + this._elements[3];
    target.y = this._elements[4] * sx + this._elements[5] * sy + this._elements[6] * sz + this._elements[7];
    target.z = this._elements[8] * sx + this._elements[9] * sy + this._elements[10] * sz + this._elements[11];
    return target;
  }

  /**
   * Transform a point.
   * @param source the source point.
   * @return the target point.
   */
  public transform(source: Coordinate): Coordinate {
    return this.transformTo(source, Coordinate.create());
  }

  /**
   * Transform bounds.
   * @param bounds the bounds.
   * @return the transformed bounds.
   */
  public transformBounds(bounds: Bounds): Bounds {
    /* Not valid? */
    if (bounds.isValid() == false) return bounds;
    /* Transform all corners */
    let nbounds: Bounds = new Bounds();
    let point: Coordinate = Coordinate.create();
    for (let i: number = 0; i < 8; i++) {
      /* Transform the next corner */
      bounds.getCorner(i, point);
      this.transformTo(point, point);
      nbounds.add(point);
    }
    /* Return the new bounds */
    return nbounds;
  }

  /**
   * Check if the transform matches another transform.
   * @param other the other transform.
   * @return true if same.
   */
  public same(other: Transform): boolean {
    for (let i: number = 0; i < 16; i++) if (this._elements[i] != other._elements[i]) return false;
    return true;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[Transform:m00=" +
      this._elements[0] +
      ",m10=" +
      this._elements[4] +
      ",m20=" +
      this._elements[8] +
      ",m01=" +
      this._elements[1] +
      ",m11=" +
      this._elements[5] +
      ",m21=" +
      this._elements[9] +
      ",m02=" +
      this._elements[2] +
      ",m12=" +
      this._elements[6] +
      ",m22=" +
      this._elements[10] +
      ",m03=" +
      this._elements[3] +
      ",m13=" +
      this._elements[7] +
      ",m23=" +
      this._elements[11] +
      "]"
    );
  }
}
