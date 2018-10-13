/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { Matrix3, Matrix4, fromNormalizedCrossProduct, normalizedDifference } from "@bentley/imodeljs-frontend/lib/webgl";
import { Vector3d, Point3d, Matrix3d, Transform, Matrix4d } from "@bentley/geometry-core";

describe("Matrix3", () => {
  it("constructor works as expected", () => {
    // ensure correct conversion from 64 bit number to 32 bit number
    const mat = Matrix3.fromValues(9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991);
    mat.data.forEach((v) => assert.isTrue(v === 9007199254740992));
  });
  it("toMatrix3d works as expected", () => {
    const mat = Matrix3.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const rotMat = mat.toMatrix3d();
    assert.isTrue(rotMat instanceof Matrix3d, "is an instance of Matrix3d");
    assert.isTrue(mat.data[0] === rotMat.coffs[0], "(0,0) is equivalent");
    assert.isTrue(mat.data[3] === rotMat.coffs[1], "(0,1) is equivalent");
    assert.isTrue(mat.data[6] === rotMat.coffs[2], "(0,2) is equivalent");
    assert.isTrue(mat.data[1] === rotMat.coffs[3], "(1,0) is equivalent");
    assert.isTrue(mat.data[4] === rotMat.coffs[4], "(1,1) is equivalent");
    assert.isTrue(mat.data[7] === rotMat.coffs[5], "(1,2) is equivalent");
    assert.isTrue(mat.data[2] === rotMat.coffs[6], "(2,0) is equivalent");
    assert.isTrue(mat.data[5] === rotMat.coffs[7], "(2,1) is equivalent");
    assert.isTrue(mat.data[8] === rotMat.coffs[8], "(2,2) is equivalent");
  });
  it("fromMatrix3d works as expected", () => {
    const rotMat = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const mat = Matrix3.fromMatrix3d(rotMat);
    assert.isTrue(mat instanceof Matrix3, "is an instance of Matrix3");
    assert.isTrue(mat.data[0] === rotMat.coffs[0], "(0,0) is equivalent");
    assert.isTrue(mat.data[3] === rotMat.coffs[1], "(0,1) is equivalent");
    assert.isTrue(mat.data[6] === rotMat.coffs[2], "(0,2) is equivalent");
    assert.isTrue(mat.data[1] === rotMat.coffs[3], "(1,0) is equivalent");
    assert.isTrue(mat.data[4] === rotMat.coffs[4], "(1,1) is equivalent");
    assert.isTrue(mat.data[7] === rotMat.coffs[5], "(1,2) is equivalent");
    assert.isTrue(mat.data[2] === rotMat.coffs[6], "(2,0) is equivalent");
    assert.isTrue(mat.data[5] === rotMat.coffs[7], "(2,1) is equivalent");
    assert.isTrue(mat.data[8] === rotMat.coffs[8], "(2,2) is equivalent");
  });
  it("transpose works as expected", () => {
    const mat = Matrix3.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const transposedMat = Matrix3.fromTranspose(mat);
    expect(mat.data[0]).to.equal(transposedMat.data[0]);
    expect(mat.data[3]).to.equal(transposedMat.data[1]);
    expect(mat.data[6]).to.equal(transposedMat.data[2]);
    expect(mat.data[1]).to.equal(transposedMat.data[3]);
    expect(mat.data[4]).to.equal(transposedMat.data[4]);
    expect(mat.data[7]).to.equal(transposedMat.data[5]);
    expect(mat.data[2]).to.equal(transposedMat.data[6]);
    expect(mat.data[5]).to.equal(transposedMat.data[7]);
    expect(mat.data[8]).to.equal(transposedMat.data[8]);
  });
});

describe("Matrix4", () => {
  it("constructor works as expected", () => {
    // ensure correct conversion from 64 bit number to 32 bit number
    const mat = Matrix4.fromValues(9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991, 9007199254740991);
    mat.data.forEach((v) => assert.isTrue(v === 9007199254740992));
  });
  it("identity works as expected", () => {
    const mat = Matrix4.fromIdentity();
    assert.isTrue(mat.data[0] === 1, "(0,0) --> 1");
    assert.isTrue(mat.data[4] === 0, "(0,1) --> 0");
    assert.isTrue(mat.data[8] === 0, "(0,2) --> 0");
    assert.isTrue(mat.data[12] === 0, "(0,3) --> 0");
    assert.isTrue(mat.data[1] === 0, "(1,0) --> 0");
    assert.isTrue(mat.data[5] === 1, "(1,1) --> 1");
    assert.isTrue(mat.data[9] === 0, "(1,2) --> 0");
    assert.isTrue(mat.data[13] === 0, "(1,3) --> 0");
    assert.isTrue(mat.data[2] === 0, "(2,0) --> 0");
    assert.isTrue(mat.data[6] === 0, "(2,1) --> 0");
    assert.isTrue(mat.data[10] === 1, "(2,2) --> 1");
    assert.isTrue(mat.data[14] === 0, "(2,3) --> 0");
    assert.isTrue(mat.data[3] === 0, "(3,0) --> 0");
    assert.isTrue(mat.data[7] === 0, "(3,1) --> 0");
    assert.isTrue(mat.data[11] === 0, "(3,2) --> 0");
    assert.isTrue(mat.data[15] === 1, "(3,3) --> 1");
  });
  it("getRotation works as expected", () => {
    const mat4 = Matrix4.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat3 = mat4.getRotation();
    assert.isTrue(mat3.data[0] === mat4.data[0], "(0,0) is equivalent");
    assert.isTrue(mat3.data[3] === mat4.data[4], "(0,1) is equivalent");
    assert.isTrue(mat3.data[6] === mat4.data[8], "(0,2) is equivalent");
    assert.isTrue(mat3.data[1] === mat4.data[1], "(1,0) is equivalent");
    assert.isTrue(mat3.data[4] === mat4.data[5], "(1,1) is equivalent");
    assert.isTrue(mat3.data[7] === mat4.data[9], "(1,2) is equivalent");
    assert.isTrue(mat3.data[2] === mat4.data[2], "(2,0) is equivalent");
    assert.isTrue(mat3.data[5] === mat4.data[6], "(2,1) is equivalent");
    assert.isTrue(mat3.data[8] === mat4.data[10], "(2,2) is equivalent");
  });
  it("initFromTransform works as expected", () => {
    const origin = new Vector3d(10, 11, 12);
    const rotMat = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const tran = Transform.createOriginAndMatrix(origin, rotMat);
    const mat4 = Matrix4.fromIdentity();
    mat4.initFromTransform(tran);
    assert.isTrue(mat4.data[0] === 1, "(0,0) --> 1");
    assert.isTrue(mat4.data[4] === 2, "(0,1) --> 2");
    assert.isTrue(mat4.data[8] === 3, "(0,2) --> 3");
    assert.isTrue(mat4.data[12] === 10, "(0,3) --> 10");
    assert.isTrue(mat4.data[1] === 4, "(1,0) --> 4");
    assert.isTrue(mat4.data[5] === 5, "(1,1) --> 5");
    assert.isTrue(mat4.data[9] === 6, "(1,2) --> 6");
    assert.isTrue(mat4.data[13] === 11, "(1,3) --> 11");
    assert.isTrue(mat4.data[2] === 7, "(2,0) --> 7");
    assert.isTrue(mat4.data[6] === 8, "(2,1) --> 8");
    assert.isTrue(mat4.data[10] === 9, "(2,2) --> 9");
    assert.isTrue(mat4.data[14] === 12, "(2,3) --> 12");
    assert.isTrue(mat4.data[3] === 0, "(3,0) --> 0");
    assert.isTrue(mat4.data[7] === 0, "(3,1) --> 0");
    assert.isTrue(mat4.data[11] === 0, "(3,2) --> 0");
    assert.isTrue(mat4.data[15] === 1, "(3,3) --> 1");
  });
  it("toTransform works as expected", () => {
    const invalidMat = Matrix4.fromValues(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    // throws error when (3,0) !== 0 && (3,1) !== 0 && (3,2) !== 0 && (3,3) !== 1
    assert.throw(invalidMat.toTransform.bind(invalidMat));
    const validMat = Matrix4.fromValues(1, 2, 3, 10, 4, 5, 6, 11, 7, 8, 9, 12, 0, 0, 0, 1);
    const tran = validMat.toTransform();
    const mat = tran.matrix;
    const origin = tran.origin;
    assert.isTrue(mat.at(0, 0) === 1, "(0,0) --> 1");
    assert.isTrue(mat.at(0, 1) === 2, "(0,1) --> 2");
    assert.isTrue(mat.at(0, 2) === 3, "(0,2) --> 3");
    assert.isTrue(origin.x === 10, "(0,3) --> 10");
    assert.isTrue(mat.at(1, 0) === 4, "(1,0) --> 4");
    assert.isTrue(mat.at(1, 1) === 5, "(1,1) --> 5");
    assert.isTrue(mat.at(1, 2) === 6, "(1,2) --> 6");
    assert.isTrue(origin.y === 11, "(1,3) --> 11");
    assert.isTrue(mat.at(2, 0) === 7, "(2,0) --> 7");
    assert.isTrue(mat.at(2, 1) === 8, "(2,1) --> 8");
    assert.isTrue(mat.at(2, 2) === 9, "(2,2) --> 9");
    assert.isTrue(origin.z === 12, "(2,3) --> 12");
  });
  it("fromMatrix4d works as expected", () => {
    const mat4d = Matrix4d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat4 = Matrix4.fromMatrix4d(mat4d);
    assert.isTrue(mat4.data[0] === mat4d.atIJ(0, 0), "(0,0) is equivalent");
    assert.isTrue(mat4.data[4] === mat4d.atIJ(0, 1), "(0,1) is equivalent");
    assert.isTrue(mat4.data[8] === mat4d.atIJ(0, 2), "(0,2) is equivalent");
    assert.isTrue(mat4.data[12] === mat4d.atIJ(0, 3), "(0,3) is equivalent");
    assert.isTrue(mat4.data[1] === mat4d.atIJ(1, 0), "(1,0) is equivalent");
    assert.isTrue(mat4.data[5] === mat4d.atIJ(1, 1), "(1,1) is equivalent");
    assert.isTrue(mat4.data[9] === mat4d.atIJ(1, 2), "(1,2) is equivalent");
    assert.isTrue(mat4.data[13] === mat4d.atIJ(1, 3), "(1,3) is equivalent");
    assert.isTrue(mat4.data[2] === mat4d.atIJ(2, 0), "(2,0) is equivalent");
    assert.isTrue(mat4.data[6] === mat4d.atIJ(2, 1), "(2,1) is equivalent");
    assert.isTrue(mat4.data[10] === mat4d.atIJ(2, 2), "(2,2) is equivalent");
    assert.isTrue(mat4.data[14] === mat4d.atIJ(2, 3), "(2,3) is equivalent");
    assert.isTrue(mat4.data[3] === mat4d.atIJ(3, 0), "(3,0) is equivalent");
    assert.isTrue(mat4.data[7] === mat4d.atIJ(3, 1), "(3,1) is equivalent");
    assert.isTrue(mat4.data[11] === mat4d.atIJ(3, 2), "(3,2) is equivalent");
    assert.isTrue(mat4.data[15] === mat4d.atIJ(3, 3), "(3,3) is equivalent");
  });
  it("toMatrix4d works as expected", () => {
    const mat4 = Matrix4.fromValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    const mat4d = mat4.toMatrix4d();
    assert.isTrue(mat4.data[0] === mat4d.atIJ(0, 0), "(0,0) is equivalent");
    assert.isTrue(mat4.data[4] === mat4d.atIJ(0, 1), "(0,1) is equivalent");
    assert.isTrue(mat4.data[8] === mat4d.atIJ(0, 2), "(0,2) is equivalent");
    assert.isTrue(mat4.data[12] === mat4d.atIJ(0, 3), "(0,3) is equivalent");
    assert.isTrue(mat4.data[1] === mat4d.atIJ(1, 0), "(1,0) is equivalent");
    assert.isTrue(mat4.data[5] === mat4d.atIJ(1, 1), "(1,1) is equivalent");
    assert.isTrue(mat4.data[9] === mat4d.atIJ(1, 2), "(1,2) is equivalent");
    assert.isTrue(mat4.data[13] === mat4d.atIJ(1, 3), "(1,3) is equivalent");
    assert.isTrue(mat4.data[2] === mat4d.atIJ(2, 0), "(2,0) is equivalent");
    assert.isTrue(mat4.data[6] === mat4d.atIJ(2, 1), "(2,1) is equivalent");
    assert.isTrue(mat4.data[10] === mat4d.atIJ(2, 2), "(2,2) is equivalent");
    assert.isTrue(mat4.data[14] === mat4d.atIJ(2, 3), "(2,3) is equivalent");
    assert.isTrue(mat4.data[3] === mat4d.atIJ(3, 0), "(3,0) is equivalent");
    assert.isTrue(mat4.data[7] === mat4d.atIJ(3, 1), "(3,1) is equivalent");
    assert.isTrue(mat4.data[11] === mat4d.atIJ(3, 2), "(3,2) is equivalent");
    assert.isTrue(mat4.data[15] === mat4d.atIJ(3, 3), "(3,3) is equivalent");
  });
});
describe("Vector3d functions", () => {
  it("fromNormalizedCrossProduct", () => {
    const vec0 = new Vector3d(-1, 7, 4);
    const vec1 = new Vector3d(-5, 8, 4);
    const vec = Vector3d.createCrossProduct(vec0.x, vec0.y, vec0.z, vec1.x, vec1.y, vec1.z);
    assert.isTrue(vec.isExactEqual(new Vector3d(-4, -16, 27)), "cross product is correct");
    const nVec = vec.normalize();
    // (-0.126428, -0.505712, 0.853388)
    const expectedResult = new Vector3d(-0.126428, -0.505712, 0.853388);
    assert.isTrue(nVec!.isAlmostEqual(expectedResult), "normalized is correct");
    assert.isTrue(fromNormalizedCrossProduct(vec0, vec1)!.isAlmostEqual(expectedResult), "fromNormalizedCrossProduct works as expected");
  });
  it("normalizedDifference", () => {
    const target = new Point3d(5, 6, 7);
    const origin = new Point3d(1, 2, 3);
    // expected result (0.57735, 0.57735, 0.57735)
    const expectedResult = new Point3d(0.57735, 0.57735, 0.57735);
    assert.isTrue(normalizedDifference(target, origin)!.isAlmostEqual(expectedResult), "normalizedDifference works as expected");
  });
});
