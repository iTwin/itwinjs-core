/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Matrix3d, Matrix4d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { fromNormalizedCrossProduct, Matrix3, Matrix4, normalizedDifference } from "../../../render/webgl/Matrix";

describe("Matrix3", () => {
  it("constructor works as expected", () => {
    // ensure correct conversion from 64 bit number to 32 bit number
    const mat = Matrix3.fromValues(9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991);
    mat.data.forEach((v) => expect(v).toBe(9007199254740992));
  });
  it("toMatrix3d works as expected", () => {
    const mat = Matrix3.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const rotMat = mat.toMatrix3d();
    expect(rotMat).toBeInstanceOf(Matrix3d);
    expect(mat.data[0]).toEqual(rotMat.coffs[0]);
    expect(mat.data[3]).toEqual(rotMat.coffs[1]);
    expect(mat.data[6]).toEqual(rotMat.coffs[2]);
    expect(mat.data[1]).toEqual(rotMat.coffs[3]);
    expect(mat.data[4]).toEqual(rotMat.coffs[4]);
    expect(mat.data[7]).toEqual(rotMat.coffs[5]);
    expect(mat.data[2]).toEqual(rotMat.coffs[6]);
    expect(mat.data[5]).toEqual(rotMat.coffs[7]);
    expect(mat.data[8]).toEqual(rotMat.coffs[8]);
  });
  it("fromMatrix3d works as expected", () => {
    const rotMat = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const mat = Matrix3.fromMatrix3d(rotMat);
    expect(mat).toBeInstanceOf(Matrix3);
    expect(mat.data[0]).toEqual(rotMat.coffs[0]);
    expect(mat.data[3]).toEqual(rotMat.coffs[1]);
    expect(mat.data[6]).toEqual(rotMat.coffs[2]);
    expect(mat.data[1]).toEqual(rotMat.coffs[3]);
    expect(mat.data[4]).toEqual(rotMat.coffs[4]);
    expect(mat.data[7]).toEqual(rotMat.coffs[5]);
    expect(mat.data[2]).toEqual(rotMat.coffs[6]);
    expect(mat.data[5]).toEqual(rotMat.coffs[7]);
    expect(mat.data[8]).toEqual(rotMat.coffs[8]);
  });
  it("transpose works as expected", () => {
    const mat = Matrix3.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const transposedMat = Matrix3.fromTranspose(mat);
    expect(mat.data[0]).toEqual(transposedMat.data[0]);
    expect(mat.data[3]).toEqual(transposedMat.data[1]);
    expect(mat.data[6]).toEqual(transposedMat.data[2]);
    expect(mat.data[1]).toEqual(transposedMat.data[3]);
    expect(mat.data[4]).toEqual(transposedMat.data[4]);
    expect(mat.data[7]).toEqual(transposedMat.data[5]);
    expect(mat.data[2]).toEqual(transposedMat.data[6]);
    expect(mat.data[5]).toEqual(transposedMat.data[7]);
    expect(mat.data[8]).toEqual(transposedMat.data[8]);
  });
});

describe("Matrix4", () => {
  it("constructor works as expected", () => {
    // ensure correct conversion from 64 bit number to 32 bit number
    const mat = Matrix4.fromValues(
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
      9007199254740991,
    );
    mat.data.forEach((v) => expect(v).toBe(9007199254740992));
  });
  it("identity works as expected", () => {
    const mat = Matrix4.fromIdentity();
    expect(mat.data[0]).toBe(1);
    expect(mat.data[4]).toBe(0);
    expect(mat.data[8]).toBe(0);
    expect(mat.data[12]).toBe(0);
    expect(mat.data[1]).toBe(0);
    expect(mat.data[5]).toBe(1);
    expect(mat.data[9]).toBe(0);
    expect(mat.data[13]).toBe(0);
    expect(mat.data[2]).toBe(0);
    expect(mat.data[6]).toBe(0);
    expect(mat.data[10]).toBe(1);
    expect(mat.data[14]).toBe(0);
    expect(mat.data[3]).toBe(0);
    expect(mat.data[7]).toBe(0);
    expect(mat.data[11]).toBe(0);
    expect(mat.data[15]).toBe(1);
  });
  it("getRotation works as expected", () => {
    const mat4 = Matrix4.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat3 = mat4.getRotation();
    expect(mat3.data[0]).toBe(mat4.data[0]);
    expect(mat3.data[3]).toBe(mat4.data[4]);
    expect(mat3.data[6]).toBe(mat4.data[8]);
    expect(mat3.data[1]).toBe(mat4.data[1]);
    expect(mat3.data[4]).toBe(mat4.data[5]);
    expect(mat3.data[7]).toBe(mat4.data[9]);
    expect(mat3.data[2]).toBe(mat4.data[2]);
    expect(mat3.data[5]).toBe(mat4.data[6]);
    expect(mat3.data[8]).toBe(mat4.data[10]);
  });
  it("initFromTransform works as expected", () => {
    const origin = new Vector3d(10, 11, 12);
    const rotMat = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const tran = Transform.createOriginAndMatrix(origin, rotMat);
    const mat4 = Matrix4.fromIdentity();
    mat4.initFromTransform(tran);
    expect(mat4.data[0]).toBe(1);
    expect(mat4.data[4]).toBe(2);
    expect(mat4.data[8]).toBe(3);
    expect(mat4.data[12]).toBe(10);
    expect(mat4.data[1]).toBe(4);
    expect(mat4.data[5]).toBe(5);
    expect(mat4.data[9]).toBe(6);
    expect(mat4.data[13]).toBe(11);
    expect(mat4.data[2]).toBe(7);
    expect(mat4.data[6]).toBe(8);
    expect(mat4.data[10]).toBe(9);
    expect(mat4.data[14]).toBe(12);
    expect(mat4.data[3]).toBe(0);
    expect(mat4.data[7]).toBe(0);
    expect(mat4.data[11]).toBe(0);
    expect(mat4.data[15]).toBe(1);
  });
  it("toTransform works as expected", () => {
    const validMat = Matrix4.fromValues(1, 2, 3, 10, 4, 5, 6, 11, 7, 8, 9, 12, 0, 0, 0, 1);
    const tran = validMat.toTransform();
    const mat = tran.matrix;
    const origin = tran.origin;
    expect(mat.at(0, 0)).toBe(1);
    expect(mat.at(0, 1)).toBe(2);
    expect(mat.at(0, 2)).toBe(3);
    expect(origin.x).toBe(10);
    expect(mat.at(1, 0)).toBe(4);
    expect(mat.at(1, 1)).toBe(5);
    expect(mat.at(1, 2)).toBe(6);
    expect(origin.y).toBe(11);
    expect(mat.at(2, 0)).toBe(7);
    expect(mat.at(2, 1)).toBe(8);
    expect(mat.at(2, 2)).toBe(9);
    expect(origin.z).toBe(12);
  });
  it("fromMatrix4d works as expected", () => {
    const mat4d = Matrix4d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat4 = Matrix4.fromMatrix4d(mat4d);
    expect(mat4.data[0]).toBe(mat4d.atIJ(0, 0));
    expect(mat4.data[4]).toBe(mat4d.atIJ(0, 1));
    expect(mat4.data[8]).toBe(mat4d.atIJ(0, 2));
    expect(mat4.data[12]).toBe(mat4d.atIJ(0, 3));
    expect(mat4.data[1]).toBe(mat4d.atIJ(1, 0));
    expect(mat4.data[5]).toBe(mat4d.atIJ(1, 1));
    expect(mat4.data[9]).toBe(mat4d.atIJ(1, 2));
    expect(mat4.data[13]).toBe(mat4d.atIJ(1, 3));
    expect(mat4.data[2]).toBe(mat4d.atIJ(2, 0));
    expect(mat4.data[6]).toBe(mat4d.atIJ(2, 1));
    expect(mat4.data[10]).toBe(mat4d.atIJ(2, 2));
    expect(mat4.data[14]).toBe(mat4d.atIJ(2, 3));
    expect(mat4.data[3]).toBe(mat4d.atIJ(3, 0));
    expect(mat4.data[7]).toBe(mat4d.atIJ(3, 1));
    expect(mat4.data[11]).toBe(mat4d.atIJ(3, 2));
    expect(mat4.data[15]).toBe(mat4d.atIJ(3, 3));
  });
  it("toMatrix4d works as expected", () => {
    const mat4 = Matrix4.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat4d = mat4.toMatrix4d();
    expect(mat4.data[0]).toBe(mat4d.atIJ(0, 0));
    expect(mat4.data[4]).toBe(mat4d.atIJ(0, 1));
    expect(mat4.data[8]).toBe(mat4d.atIJ(0, 2));
    expect(mat4.data[12]).toBe(mat4d.atIJ(0, 3));
    expect(mat4.data[1]).toBe(mat4d.atIJ(1, 0));
    expect(mat4.data[5]).toBe(mat4d.atIJ(1, 1));
    expect(mat4.data[9]).toBe(mat4d.atIJ(1, 2));
    expect(mat4.data[13]).toBe(mat4d.atIJ(1, 3));
    expect(mat4.data[2]).toBe(mat4d.atIJ(2, 0));
    expect(mat4.data[6]).toBe(mat4d.atIJ(2, 1));
    expect(mat4.data[10]).toBe(mat4d.atIJ(2, 2));
    expect(mat4.data[14]).toBe(mat4d.atIJ(2, 3));
    expect(mat4.data[3]).toBe(mat4d.atIJ(3, 0));
    expect(mat4.data[7]).toBe(mat4d.atIJ(3, 1));
    expect(mat4.data[11]).toBe(mat4d.atIJ(3, 2));
    expect(mat4.data[15]).toBe(mat4d.atIJ(3, 3));
  });
});
describe("Vector3d functions", () => {
  it("fromNormalizedCrossProduct", () => {
    const vec0 = new Vector3d(-1, 7, 4);
    const vec1 = new Vector3d(-5, 8, 4);
    const vec = Vector3d.createCrossProduct(vec0.x, vec0.y, vec0.z, vec1.x, vec1.y, vec1.z);
    expect(vec.isExactEqual(new Vector3d(-4, -16, 27))).toBe(true); // cross product is correct
    const nVec = vec.normalize();
    // (-0.126428, -0.505712, 0.853388)
    const expectedResult = new Vector3d(-0.126428, -0.505712, 0.853388);
    expect(nVec!.isAlmostEqual(expectedResult)).toBe(true); // normalized is correct
    expect(fromNormalizedCrossProduct(vec0, vec1)!.isAlmostEqual(expectedResult)).toBe(true); // fromNormalizedCrossProduct works as expected
  });
  it("normalizedDifference", () => {
    const target = new Point3d(5, 6, 7);
    const origin = new Point3d(1, 2, 3);
    // expected result (0.57735, 0.57735, 0.57735)
    const expectedResult = new Point3d(0.57735, 0.57735, 0.57735);
    expect(normalizedDifference(target, origin)!.isAlmostEqual(expectedResult)).toBe(true);
  });
});
