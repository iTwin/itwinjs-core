/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Checker } from "./Checker";
// import { prettyPrint } from "./testFunctions";
import { Sample } from "../serialization/GeometrySamples";
import { expect } from "chai";
/* tslint:disable:no-console */

describe("Transform", () => {
  it("CreateInvertible", () => {
    const ck = new Checker();
    const transforms = Sample.createInvertibleTransforms();
    const point3dA = Sample.createPoint3dLattice(-2, 1.5, 5);
    const point2dA = Sample.createPoint2dLattice(-2, 1.5, 5);
    const xyz = Point3d.create();
    // Point3d arrays for use as supplied result:
    const point3dD: Point3d[] = [];
    let point3dE: Point3d[] = [];
    let point2dE: Point2d[] = [];
    for (const transform of transforms) {
      // single point calls ...
      transform.multiplyPoint3d(point3dA[0], xyz);
      ck.testBoolean(transform.isIdentity, xyz.isAlmostEqual(point3dA[0]));
      transform.multiplyInversePoint3d(xyz, xyz);
      ck.testPoint3d(point3dA[0], xyz, "RoundTrip transform and inverse");
      const point3dB = transform.multiplyPoint3dArray(point3dA);
      const point3dC = transform.multiplyInversePoint3dArray(point3dB);
      if (ck.testPointer(point3dC, "transform inverse exists") && point3dC)
        ck.testPoint3dArray(point3dA, point3dC);

      transform.multiplyPoint3dArray(point3dA, point3dD);
      const point3dE1 = transform.multiplyInversePoint3dArray(point3dD, point3dE);
      if (ck.testPointer(point3dE1, "transform inverse exists") && point3dE1) {
        ck.testPoint3dArray(point3dA, point3dE1);
        point3dE = point3dE1; // capture for reuse !!!
      }

      const point2dB = transform.multiplyPoint2dArray(point2dA);
      const point2dE1 = transform.multiplyPoint2dArray(point2dA, point2dE);
      for (let i = 0; i < point2dA.length; i++) {
        transform.multiplyXYZ(point2dA[i].x, point2dA[i].y, 0.0, xyz);
        ck.testPoint2d(point2dE1[i], point2dB[i]);
        ck.testCoordinate(xyz.x, point2dB[i].x);
        ck.testCoordinate(xyz.y, point2dB[i].y);
      }
      point2dE = point2dE1; // capture for reuse

    }

    expect(ck.getNumErrors()).equals(0);
  });

  it("RangeMaps", () => {
    const ck = new Checker();
    const point3dA = Sample.createPoint3dLattice(-2, 1.5, 5);
    const npcToWorld = Transform.createIdentity();
    const worldToNpc = Transform.createIdentity();
    const npc = Point3d.create();
    // various points that never share any single coordinate
    const corners = [
      Point3d.createZero(),
      Point3d.create(1, 1, 1),
      Point3d.create(2, 3, 5),
      Point3d.create(-1, 4, 2),
      Point3d.create(6, 9.20)];
    for (let i = 0; i + 1 < corners.length; i++) {
      const cornerA = corners[i];
      const cornerB = corners[i + 1];
      Transform.initFromRange(corners[i], corners[i + 1], npcToWorld, worldToNpc);
      ck.testTrue(npcToWorld.multiplyTransformTransform(worldToNpc).isIdentity, "range maps  inverses");
      for (const xyz of point3dA) {
        worldToNpc.multiplyPoint3d(xyz, npc);
        const interpolated = cornerA.interpolateXYZ(npc.x, npc.y, npc.z, cornerB);
        ck.testPoint3d(xyz, interpolated);

      }
    }
    const xyz0 = Point3d.create(0, 0, 0);
    // walk through branches ....
    Transform.initFromRange(xyz0, xyz0, npcToWorld, worldToNpc);
    expect(ck.getNumErrors()).equals(0);
  });

  it("Misc", () => {
    const ck = new Checker();
    const matrixArray = Sample.createMatrix3dArray();
    for (const origin of [
      Point3d.create(0, 0, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(0, 3, 0),
      Point3d.create(0, 0, -2)]) {
      for (const matrixA of matrixArray) {
        const transformA = Transform.createOriginAndMatrix(origin, matrixA);
        const originB = transformA.getOrigin();
        ck.testPoint3d(origin, originB, "getOrigin");
        const transformC = Transform.createIdentity();
        const transformC1 = Transform.createOriginAndMatrixColumns(
          transformA.getTranslation(),
          transformA.matrix.columnX(),
          transformA.matrix.columnY(),
          transformA.matrix.columnZ(), transformC);
        const transformC2 = Transform.createOriginAndMatrixColumns(
          transformA.getOrigin(),
          transformA.matrix.columnX(),
          transformA.matrix.columnY(),
          transformA.matrix.columnZ());

        ck.testTrue(transformC === transformC1, "result returns same");
        ck.testTransform(transformA, transformC, "createOriginAndMatrixColumn");
        ck.testTransform(transformA, transformC2, "createOriginAndMatrixColumn");
        // (destroy the transform)
        transformA.setIdentity();
        ck.testTrue(transformA.isIdentity);
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Singular", () => {
    const ck = new Checker();
    const matrices = Sample.createSingularMatrix3d();
    const origin = Point3d.create(4, 1, 9);
    const pointA = Point3d.create(3, 2, -2);
    for (const matrix of matrices) {
      ck.testFalse(matrix.computeCachedInverse(true));
      ck.testFalse(matrix.computeCachedInverse(false));
      const transform = Transform.createRefs(origin, matrix);
      ck.testUndefined(transform.inverse(), "singular transform inverse undefined");
      const pointB = transform.multiplyInversePoint3d(pointA);
      ck.testUndefined(pointB);
      const pointC = transform.multiplyInversePoint3dArray([]);
      ck.testUndefined(pointC);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("MultiplyTransformMatrix3d", () => {
    const ck = new Checker();
    const points = Sample.createPoint3dLattice(-2, 1, 2);
    const transformA = Transform.createOriginAndMatrix(
      Point3d.create(1, 2, 3),
      Matrix3d.createRowValues(3, 4, 5, 6, 7, 8, 9, 10, 11));
    const matrixB = Matrix3d.createRowValues(-2, 3, -1, 6, 2, 4, -2, -3, 5);
    const transformB = Transform.createOriginAndMatrix(undefined, matrixB);
    const transformC = transformA.multiplyTransformMatrix3d(matrixB);
    // inplace update of uninvolved transform . .
    const transformD = transformA.multiplyTransformMatrix3d(matrixB, Transform.createIdentity());
    const transformE = transformA.multiplyTransformTransform(transformB);
    ck.testTransform(transformC, transformD);
    ck.testTransform(transformC, transformE);
    for (const p of points) {
      const productABp = transformA.multiplyPoint3d(transformB.multiplyPoint3d(p));
      const productCp = transformC.multiplyPoint3d(p);
      ck.testPoint3d(productABp, productCp);
    }
    // inplace update of primary transform
    const transformA1 = transformA.clone();
    ck.testTransform(transformA, transformA1, "clone transform");
    transformA1.multiplyTransformMatrix3d(matrixB, transformA1);
    ck.testFalse(transformA.isAlmostEqual(transformA1), "inplace multiply changes input");
    ck.testTransform(transformA1, transformE);
    expect(ck.getNumErrors()).equals(0);
  });

  it("MultiplyMatrix3dTransform", () => {
    const ck = new Checker();
    const points = Sample.createPoint3dLattice(-2, 1, 2);
    const matrixA = Matrix3d.createRowValues(-2, 3, -1, 6, 2, 4, -2, -3, 5);
    const transformA = Transform.createOriginAndMatrix(undefined, matrixA);
    const transformB = Transform.createOriginAndMatrix(
      Point3d.create(1, 2, 3),
      Matrix3d.createRowValues(3, 4, 5, 6, 7, 8, 9, 10, 11));

    const transformC = matrixA.multiplyMatrixTransform(transformB);
    // inplace update of uninvolved transform . .
    const transformD = matrixA.multiplyMatrixTransform(transformB, Transform.createIdentity());
    const transformE = transformA.multiplyTransformTransform(transformB);
    ck.testTransform(transformC, transformD);
    ck.testTransform(transformC, transformE);
    for (const p of points) {

      const productABp = Point3d.create();
      matrixA.multiplyXYZtoXYZ(transformB.multiplyPoint3d(p), productABp);
      const productCp = transformC.multiplyPoint3d(p);
      ck.testPoint3d(productABp, productCp);
    }
    // inplace update of primary transform
    const transformB1 = transformB.clone();
    ck.testTransform(transformB, transformB1, "clone transform");
    matrixA.multiplyMatrixTransform(transformB1, transformB1);
    ck.testFalse(transformA.isAlmostEqual(transformB1), "inplace multiply changes input");
    ck.testTransform(transformB1, transformE);
    expect(ck.getNumErrors()).equals(0);
  });

});
