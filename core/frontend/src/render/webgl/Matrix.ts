/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Vector3d, Point3d, RotMatrix, Transform, Matrix4d } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";

export class Matrix3 {
  public readonly data: Float32Array = new Float32Array(3 * 3);

  public constructor() { }

  public initIdentity(): void {
    this.setValues(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }
  public static fromIdentity(out?: Matrix3): Matrix3 {
    const mat = undefined !== out ? out : new Matrix3();
    mat.initIdentity();
    return mat;
  }

  public copyFrom(src: Matrix3): void {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = src.data[i];
    }
  }
  public clone(out?: Matrix3): Matrix3 {
    const mat = undefined !== out ? out : new Matrix3();
    mat.copyFrom(this);
    return mat;
  }

  public setValues(m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number) {
    this.m00 = m00; this.m01 = m01; this.m02 = m02;
    this.m10 = m10; this.m11 = m11; this.m12 = m12;
    this.m20 = m20; this.m21 = m21; this.m22 = m22;
  }
  public static fromValues(m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number, out?: Matrix3) {
    const mat = undefined !== out ? out : new Matrix3();
    mat.setValues(m00, m01, m02, m10, m11, m12, m20, m21, m22);
    return mat;
  }

  public initFromRotMatrix(rot: RotMatrix): void {
    this.setValues(
      rot.at(0, 0), rot.at(0, 1), rot.at(0, 2),
      rot.at(1, 0), rot.at(1, 1), rot.at(1, 2),
      rot.at(2, 0), rot.at(2, 1), rot.at(2, 2));
  }
  public static fromRotMatrix(rot: RotMatrix, out?: Matrix3): Matrix3 {
    const mat = undefined !== out ? out : new Matrix3();
    mat.initFromRotMatrix(rot);
    return mat;
  }
  public toRotMatrix(): RotMatrix {
    const data = this.data;
    return RotMatrix.createRowValues(data[0], data[3], data[6], data[1], data[4], data[7], data[2], data[5], data[8]);
  }

  public swap(firstIndex: number, secondIndex: number) {
    assert(firstIndex < this.data.length);
    assert(secondIndex < this.data.length);
    assert(secondIndex !== firstIndex);
    const tmp = this.data[firstIndex];
    this.data[firstIndex] = this.data[secondIndex];
    this.data[secondIndex] = tmp;
  }

  public transpose(): void {
    this.swap(1, 3);
    this.swap(5, 7);
    this.swap(2, 6);
  }
  public static fromTranspose(src: Matrix3, out?: Matrix3) {
    const mat = src.clone(out);
    mat.transpose();
    return mat;
  }

  public get(index: number) { assert(index < this.data.length); return this.data[index]; }
  public set(index: number, value: number) { assert(index < this.data.length); this.data[index] = value; }

  public at(row: number, col: number) { return this.get(col * 3 + row); }
  public setAt(row: number, col: number, value: number) { this.set(col * 3 + row, value); }

  public get m00() { return this.at(0, 0); }
  public set m00(value: number) { this.setAt(0, 0, value); }
  public get m01() { return this.at(0, 1); }
  public set m01(value: number) { this.setAt(0, 1, value); }
  public get m02() { return this.at(0, 2); }
  public set m02(value: number) { this.setAt(0, 2, value); }
  public get m10() { return this.at(1, 0); }
  public set m10(value: number) { this.setAt(1, 0, value); }
  public get m11() { return this.at(1, 1); }
  public set m11(value: number) { this.setAt(1, 1, value); }
  public get m12() { return this.at(1, 2); }
  public set m12(value: number) { this.setAt(1, 2, value); }
  public get m20() { return this.at(2, 0); }
  public set m20(value: number) { this.setAt(2, 0, value); }
  public get m21() { return this.at(2, 1); }
  public set m21(value: number) { this.setAt(2, 1, value); }
  public get m22() { return this.at(2, 2); }
  public set m22(value: number) { this.setAt(2, 2, value); }
}

export class Matrix4 {
  public readonly data: Float32Array = new Float32Array(4 * 4);

  public constructor() { }

  public copyFrom(src: Matrix4): void {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = src.data[i];
    }
  }
  public clone(out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.copyFrom(this);
    return mat;
  }

  public initIdentity(): void {
    this.setValues(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1);
  }
  public static fromIdentity(out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.initIdentity();
    return mat;
  }

  public setValues(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number) {
    this.m00 = m00; this.m01 = m01; this.m02 = m02; this.m03 = m03;
    this.m10 = m10; this.m11 = m11; this.m12 = m12; this.m13 = m13;
    this.m20 = m20; this.m21 = m21; this.m22 = m22; this.m23 = m23;
    this.m30 = m30; this.m31 = m31; this.m32 = m32; this.m33 = m33;
  }
  public static fromValues(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number, out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.setValues(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
    return mat;
  }

  public getRotation(out?: Matrix3): Matrix3 {
    const rot = undefined !== out ? out : new Matrix3();
    rot.setValues(this.m00, this.m01, this.m02, this.m10, this.m11, this.m12, this.m20, this.m21, this.m22);
    return rot;
  }

  public initFromTransform(transform: Transform): void {
    const mat = transform.matrix;
    const org = transform.origin;
    this.setValues(
      mat.at(0, 0), mat.at(0, 1), mat.at(0, 2), org.x,
      mat.at(1, 0), mat.at(1, 1), mat.at(1, 2), org.y,
      mat.at(2, 0), mat.at(2, 1), mat.at(2, 2), org.z,
      0, 0, 0, 1);
  }
  public static fromTransform(transform: Transform, out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.initFromTransform(transform);
    return mat;
  }
  public toTransform(): Transform {
    const data = this.data;
    assert(0.0 === data[3] && 0.0 === data[7] && 0.0 === data[11] && 1.0 === data[15]);
    const origin = new Point3d(data[12], data[13], data[14]);
    const rotMat = RotMatrix.createIdentity();
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        rotMat.setAt(i, j, data[i + j * 4]);

    return Transform.createRefs(origin, rotMat);
  }

  public initFromMatrix4d(mat: Matrix4d): void {
    this.setValues(
      mat.atIJ(0, 0), mat.atIJ(0, 1), mat.atIJ(0, 2), mat.atIJ(0, 3),
      mat.atIJ(1, 0), mat.atIJ(1, 1), mat.atIJ(1, 2), mat.atIJ(1, 3),
      mat.atIJ(2, 0), mat.atIJ(2, 1), mat.atIJ(2, 2), mat.atIJ(2, 3),
      mat.atIJ(3, 0), mat.atIJ(3, 1), mat.atIJ(3, 2), mat.atIJ(3, 3));
  }
  public static fromMatrix4d(mat: Matrix4d, out?: Matrix4): Matrix4 {
    const result = undefined !== out ? out : new Matrix4();
    result.initFromMatrix4d(mat);
    return result;
  }
  public toMatrix4d(): Matrix4d {
    const data = this.data;
    return Matrix4d.createRowValues(data[0], data[4], data[8], data[12], data[1], data[5], data[9], data[13], data[2], data[6], data[10], data[14], data[3], data[7], data[11], data[15]);
  }

  public lookAt(eye: Point3d, center: Point3d, up: Vector3d): boolean {
    const f = normalizedDifference(center, eye);
    if (undefined === f) {
      return false;
    }

    const s = fromNormalizedCrossProduct(f, up);
    if (undefined === s) {
      return false;
    }

    const u = Vector3d.createCrossProduct(s.x, s.y, s.z, f.x, f.y, f.z);
    this.setValues(
      s.x, s.y, s.z, -s.dotProduct(eye),
      u.x, u.y, u.z, -u.dotProduct(eye),
      -f.x, -f.y, -f.z, f.dotProduct(eye),
      0, 0, 0, 1);
    return true;
  }
  public static fromLookAt(eye: Point3d, center: Point3d, up: Vector3d, out?: Matrix4): Matrix4 | undefined {
    const mat = undefined !== out ? out : new Matrix4();
    return mat.lookAt(eye, center, up) ? mat : undefined;
  }

  // left, right, bottom, top, near, far
  public frustum(l: number, r: number, b: number, t: number, n: number, f: number): void {
    this.setValues((2 * n) / (r - l), 0, (r + l) / (r - l), 0, 0, (2 * n) / (t - b),
      (t + b) / (t - b), 0, 0, 0, -(f + n) / (f - n),
      -(2 * f * n) / (f - n), 0, 0, -1, 0);
  }
  public static fromFrustum(l: number, r: number, b: number, t: number, n: number, f: number, out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.frustum(l, r, b, t, n, f);
    return mat;
  }

  public perspective(fovY: number, aspectRatio: number, nearZ: number, farZ: number): void {
    const frustumHeight = Math.tan(fovY / 360 * Math.PI) * nearZ;
    const frustumWidth = frustumHeight * aspectRatio;
    this.frustum(-frustumWidth, frustumWidth, -frustumHeight, frustumHeight, nearZ, farZ);
  }
  public static fromPerspective(fovY: number, aspectRatio: number, nearZ: number, farZ: number, out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.perspective(fovY, aspectRatio, nearZ, farZ);
    return mat;
  }

  public ortho(l: number, r: number, b: number, t: number, n: number, f: number): void {
    this.setValues(
      2 / (r - l), 0, 0, -(r + l) / (r - l),
      0, 2 / (t - b), 0, -(t + b) / (t - b),
      0, 0, -2 / (f - n), -(f + n) / (f - n),
      0, 0, 0, 1);
  }
  public static fromOrtho(l: number, r: number, b: number, t: number, n: number, f: number, out?: Matrix4): Matrix4 {
    const mat = undefined !== out ? out : new Matrix4();
    mat.ortho(l, r, b, t, n, f);
    return mat;
  }

  public invert(): boolean {
    const d = this.data;
    const d0 = d[0];
    const d1 = d[1];
    const d2 = d[2];
    const d3 = d[3];

    this.setValues(
      d[5] * d[10] * d[15] - d[5] * d[11] * d[14] - d[9] * d[6] * d[15] + d[9] * d[7] * d[14] + d[13] * d[6] * d[11] - d[13] * d[7] * d[10],
      -d[4] * d[10] * d[15] + d[4] * d[11] * d[14] + d[8] * d[6] * d[15] - d[8] * d[7] * d[14] - d[12] * d[6] * d[11] + d[12] * d[7] * d[10],
      d[4] * d[9] * d[15] - d[4] * d[11] * d[13] - d[8] * d[5] * d[15] + d[8] * d[7] * d[13] + d[12] * d[5] * d[11] - d[12] * d[7] * d[9],
      -d[4] * d[9] * d[14] + d[4] * d[10] * d[13] + d[8] * d[5] * d[14] - d[8] * d[6] * d[13] - d[12] * d[5] * d[10] + d[12] * d[6] * d[9],
      -d[1] * d[10] * d[15] + d[1] * d[11] * d[14] + d[9] * d[2] * d[15] - d[9] * d[3] * d[14] - d[13] * d[2] * d[11] + d[13] * d[3] * d[10],
      d[0] * d[10] * d[15] - d[0] * d[11] * d[14] - d[8] * d[2] * d[15] + d[8] * d[3] * d[14] + d[12] * d[2] * d[11] - d[12] * d[3] * d[10],
      -d[0] * d[9] * d[15] + d[0] * d[11] * d[13] + d[8] * d[1] * d[15] - d[8] * d[3] * d[13] - d[12] * d[1] * d[11] + d[12] * d[3] * d[9],
      d[0] * d[9] * d[14] - d[0] * d[10] * d[13] - d[8] * d[1] * d[14] + d[8] * d[2] * d[13] + d[12] * d[1] * d[10] - d[12] * d[2] * d[9],
      d[1] * d[6] * d[15] - d[1] * d[7] * d[14] - d[5] * d[2] * d[15] + d[5] * d[3] * d[14] + d[13] * d[2] * d[7] - d[13] * d[3] * d[6],
      -d[0] * d[6] * d[15] + d[0] * d[7] * d[14] + d[4] * d[2] * d[15] - d[4] * d[3] * d[14] - d[12] * d[2] * d[7] + d[12] * d[3] * d[6],
      d[0] * d[5] * d[15] - d[0] * d[7] * d[13] - d[4] * d[1] * d[15] + d[4] * d[3] * d[13] + d[12] * d[1] * d[7] - d[12] * d[3] * d[5],
      -d[0] * d[5] * d[14] + d[0] * d[6] * d[13] + d[4] * d[1] * d[14] - d[4] * d[2] * d[13] - d[12] * d[1] * d[6] + d[12] * d[2] * d[5],
      -d[1] * d[6] * d[11] + d[1] * d[7] * d[10] + d[5] * d[2] * d[11] - d[5] * d[3] * d[10] - d[9] * d[2] * d[7] + d[9] * d[3] * d[6],
      d[0] * d[6] * d[11] - d[0] * d[7] * d[10] - d[4] * d[2] * d[11] + d[4] * d[3] * d[10] + d[8] * d[2] * d[7] - d[8] * d[3] * d[6],
      -d[0] * d[5] * d[11] + d[0] * d[7] * d[9] + d[4] * d[1] * d[11] - d[4] * d[3] * d[9] - d[8] * d[1] * d[7] + d[8] * d[3] * d[5],
      d[0] * d[5] * d[10] - d[0] * d[6] * d[9] - d[4] * d[1] * d[10] + d[4] * d[2] * d[9] + d[8] * d[1] * d[6] - d[8] * d[2] * d[5]);

    const determinant = d0 * d[0] + d1 * d[4] + d2 * d[8] + d3 * d[12];
    if (0 === determinant) {
      this.initIdentity();
      return false;
    }

    this.multiplyByScalar(1 / determinant);
    return true;
  }
  public static fromInverse(src: Matrix4, out?: Matrix4): Matrix4 | undefined {
    const mat = src.clone(out);
    return mat.invert() ? mat : undefined;
  }

  public swap(firstIndex: number, secondIndex: number) {
    assert(firstIndex < this.data.length);
    assert(secondIndex < this.data.length);
    assert(secondIndex !== firstIndex);
    const tmp = this.data[firstIndex];
    this.data[firstIndex] = this.data[secondIndex];
    this.data[secondIndex] = tmp;
  }

  public transpose(): void {
    this.swap(1, 4);
    this.swap(2, 8);
    this.swap(3, 12);
    this.swap(6, 9);
    this.swap(7, 13);
    this.swap(11, 14);
  }
  public static fromTranspose(src: Matrix4, out?: Matrix4): Matrix4 {
    const mat = src.clone(out);
    mat.transpose();
    return mat;
  }

  public multiplyBy(other: Matrix4): void {
    const a = this.data;
    const b = other.data;
    this.setValues(
      a[0] * b[0] + a[4] * b[1] + a[8] * b[2] + a[12] * b[3],
      a[0] * b[4] + a[4] * b[5] + a[8] * b[6] + a[12] * b[7],
      a[0] * b[8] + a[4] * b[9] + a[8] * b[10] + a[12] * b[11],
      a[0] * b[12] + a[4] * b[13] + a[8] * b[14] + a[12] * b[15],
      a[1] * b[0] + a[5] * b[1] + a[9] * b[2] + a[13] * b[3],
      a[1] * b[4] + a[5] * b[5] + a[9] * b[6] + a[13] * b[7],
      a[1] * b[8] + a[5] * b[9] + a[9] * b[10] + a[13] * b[11],
      a[1] * b[12] + a[5] * b[13] + a[9] * b[14] + a[13] * b[15],
      a[2] * b[0] + a[6] * b[1] + a[10] * b[2] + a[14] * b[3],
      a[2] * b[4] + a[6] * b[5] + a[10] * b[6] + a[14] * b[7],
      a[2] * b[8] + a[6] * b[9] + a[10] * b[10] + a[14] * b[11],
      a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14] * b[15],
      a[3] * b[0] + a[7] * b[1] + a[11] * b[2] + a[15] * b[3],
      a[3] * b[4] + a[7] * b[5] + a[11] * b[6] + a[15] * b[7],
      a[3] * b[8] + a[7] * b[9] + a[11] * b[10] + a[15] * b[11],
      a[3] * b[12] + a[7] * b[13] + a[11] * b[14] + a[15] * b[15]);
  }
  public static fromProduct(a: Matrix4, b: Matrix4, out?: Matrix4): Matrix4 {
    const mat = a.clone(out);
    mat.multiplyBy(b);
    return mat;
  }

  public multiplyByScalar(scalar: number): void {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= scalar;
    }
  }

  public get(index: number) { assert(index < this.data.length); return this.data[index]; }
  public set(index: number, value: number) { assert(index < this.data.length); this.data[index] = value; }

  public at(row: number, col: number) { return this.get(col * 4 + row); }
  public setAt(row: number, col: number, value: number) { this.set(col * 4 + row, value); }

  public get m00() { return this.at(0, 0); }
  public set m00(value: number) { this.setAt(0, 0, value); }
  public get m01() { return this.at(0, 1); }
  public set m01(value: number) { this.setAt(0, 1, value); }
  public get m02() { return this.at(0, 2); }
  public set m02(value: number) { this.setAt(0, 2, value); }
  public get m03() { return this.at(0, 3); }
  public set m03(value: number) { this.setAt(0, 3, value); }
  public get m10() { return this.at(1, 0); }
  public set m10(value: number) { this.setAt(1, 0, value); }
  public get m11() { return this.at(1, 1); }
  public set m11(value: number) { this.setAt(1, 1, value); }
  public get m12() { return this.at(1, 2); }
  public set m12(value: number) { this.setAt(1, 2, value); }
  public get m13() { return this.at(1, 3); }
  public set m13(value: number) { this.setAt(1, 3, value); }
  public get m20() { return this.at(2, 0); }
  public set m20(value: number) { this.setAt(2, 0, value); }
  public get m21() { return this.at(2, 1); }
  public set m21(value: number) { this.setAt(2, 1, value); }
  public get m22() { return this.at(2, 2); }
  public set m22(value: number) { this.setAt(2, 2, value); }
  public get m23() { return this.at(2, 3); }
  public set m23(value: number) { this.setAt(2, 3, value); }

  public get m30() { return this.at(3, 0); }
  public set m30(value: number) { this.setAt(3, 0, value); }
  public get m31() { return this.at(3, 1); }
  public set m31(value: number) { this.setAt(3, 1, value); }
  public get m32() { return this.at(3, 2); }
  public set m32(value: number) { this.setAt(3, 2, value); }
  public get m33() { return this.at(3, 3); }
  public set m33(value: number) { this.setAt(3, 3, value); }
}

// missing Vector3d functions

export function fromNormalizedCrossProduct(vec0: Vector3d, vec1: Vector3d): Vector3d | undefined {
  return vec0.unitCrossProduct(vec1);
}

export function normalizedDifference(target: Point3d, origin: Point3d): Vector3d | undefined {
  return Vector3d.createStartEnd(origin, target).normalize();
}
