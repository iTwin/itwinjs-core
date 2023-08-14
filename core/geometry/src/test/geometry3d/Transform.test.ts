/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";

import { AxisOrder } from "../../Geometry";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("Transform.Inverse", () => {
  it("Transform.Inverse", () => {
    const ck = new Checker();
    const transforms = Sample.createInvertibleTransforms();
    const point3dA = Sample.createPoint3dLattice(-2, 1.5, 5);
    const point2dA = Sample.createPoint2dLattice(-2, 1.5, 5);
    const xyz = Point3d.create();
    // Point3d arrays for use as supplied result
    const point3dD: Point3d[] = [];
    const point3dE: Point3d[] = [];
    const point2dE: Point2d[] = [];
    for (const transform of transforms) {
      transform.multiplyPoint3d(point3dA[0], xyz);
      ck.testBoolean(transform.isIdentity, xyz.isAlmostEqual(point3dA[0]));

      transform.multiplyInversePoint3d(xyz, xyz);
      ck.testPoint3d(point3dA[0], xyz, "transform times transform inverse is identity");

      const point3dB = transform.multiplyPoint3dArray(point3dA);
      const point3dC = transform.multiplyInversePoint3dArray(point3dB);
      if (ck.testPointer(point3dC, "transform inverse exists") && point3dC)
        ck.testPoint3dArray(point3dA, point3dC, "transform times transform inverse is identity");

      transform.multiplyPoint3dArray(point3dA, point3dD);
      const point3dE1 = transform.multiplyInversePoint3dArray(point3dD, point3dE);
      if (point3dE1 !== point3dE) {
        assert.fail();
      }
      if (ck.testPointer(point3dE1, "transform inverse exists") && point3dE1) {
        ck.testPoint3dArray(point3dE1, point3dE);
        ck.testPoint3dArray(point3dA, point3dE, "transform times transform inverse is identity");
      }

      const point2dB = transform.multiplyPoint2dArray(point2dA);
      const point2dE1 = transform.multiplyPoint2dArray(point2dA, point2dE);
      if (point2dE1 !== point2dE) {
        assert.fail();
      }
      for (let i = 0; i < point2dA.length; i++) {
        transform.multiplyXYZ(point2dA[i].x, point2dA[i].y, 0.0, xyz);
        ck.testPoint2d(point2dE1[i], point2dE[i]);
        ck.testPoint2d(point2dE[i], point2dB[i]);
        ck.testCoordinate(xyz.x, point2dB[i].x);
        ck.testCoordinate(xyz.y, point2dB[i].y);
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.InitFromRange", () => {
  it("Transform.InitFromRange", () => {
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
      Point3d.create(6, 9, 10),
    ];
    for (let i = 0; i < corners.length - 1; i++) {
      const cornerA = corners[i];
      const cornerB = corners[i + 1];
      Transform.initFromRange(corners[i], corners[i + 1], npcToWorld, worldToNpc);
      ck.testTrue(npcToWorld.multiplyTransformTransform(worldToNpc).isIdentity, "npcToWorld is inverse of worldToNpc");
      for (const xyz of point3dA) {
        /**
         * Transform T (or worldToNpc) maps [a,b] to [0,1] so for a given x:
         * Tx = (x-a)/(b-a) = f
         *
         * Interpolation N (or npcToWorld) maps [0,1] to [a,b] so for a given f:
         * Nf = a(1-f) + bf = x
         */
        worldToNpc.multiplyPoint3d(xyz, npc); // Tx = f
        const interpolated = cornerA.interpolateXYZ(npc.x, npc.y, npc.z, cornerB); // Nf = x
        ck.testPoint3d(xyz, interpolated);
      }
    }
    const xyz0 = Point3d.create(2, 3, 4);
    Transform.initFromRange(xyz0, xyz0, npcToWorld, worldToNpc); // pass same point as min and max
    ck.testTrue(worldToNpc.matrix.isIdentity);
    ck.testPoint3d(worldToNpc.origin as Point3d, Point3d.create(-xyz0.x, -xyz0.y, -xyz0.z));
    ck.testTrue(npcToWorld.matrix.isIdentity);
    ck.testPoint3d(npcToWorld.origin as Point3d, xyz0);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.CreateOriginAndMatrix", () => {
  it("Transform.CreateOriginAndMatrix", () => {
    const ck = new Checker();
    const matrixArray = Sample.createMatrix3dArray();
    for (const origin of [
      Point3d.create(0, 0, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(0, 3, 0),
      Point3d.create(0, 0, -2),
    ]) {
      for (const matrixA of matrixArray) {
        const transformA = Transform.createOriginAndMatrix(origin, matrixA);
        const originA = transformA.getOrigin();
        ck.testPoint3d(origin, originA, "getOrigin");
        const transformB = Transform.createIdentity();
        const transformB1 = Transform.createOriginAndMatrixColumns(
          transformA.getTranslation(),
          transformA.matrix.columnX(),
          transformA.matrix.columnY(),
          transformA.matrix.columnZ(),
          transformB,
        );
        const transformB2 = Transform.createOriginAndMatrixColumns(
          transformA.getOrigin(),
          transformA.matrix.columnX(),
          transformA.matrix.columnY(),
          transformA.matrix.columnZ(),
        );
        ck.testTrue(transformB === transformB1, "input result and returned result are the same");
        ck.testTransform(transformA, transformB1);
        ck.testTransform(transformA, transformB2);

        // destroy the transform
        transformA.setIdentity();
        ck.testTrue(transformA.isIdentity);
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.Singular", () => {
  it("Transform.Singular", () => {
    const ck = new Checker();
    const matrices = Sample.createSingularMatrix3d();
    const origin = Point3d.create(4, 1, 9);
    const pointA = Point3d.create(3, 2, -2);
    for (const matrix of matrices) {
      ck.testFalse(matrix.computeCachedInverse(false));
      ck.testFalse(matrix.computeCachedInverse(true));
      const transform = Transform.createRefs(origin, matrix);
      ck.testUndefined(
        transform.inverse(),
        "Inverse of a transform is undefined if the transform has singular matrix part",
      );
      const pointB = transform.multiplyInverseXYZ(pointA.x, pointA.y, pointA.z);
      ck.testUndefined(pointB);
      const pointC = transform.multiplyInversePoint3dArray([]);
      ck.testUndefined(pointC);
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.MultiplyTransformMatrix3d", () => {
  it("Transform.MultiplyTransformMatrix3d", () => {
    const ck = new Checker();
    const points = Sample.createPoint3dLattice(-2, 1, 2);
    const transformA = Transform.createOriginAndMatrix(
      Point3d.create(1, 2, 3),
      Matrix3d.createRowValues(3, 4, 5, 6, 7, 8, 9, 10, 11),
    ); // [A a]
    const matrixB = Matrix3d.createRowValues(-2, 3, -1, 6, 2, 4, -2, -3, 5);
    const transformB = Transform.createOriginAndMatrix(undefined, matrixB); // [B 0]
    const transformC = transformA.multiplyTransformMatrix3d(matrixB); // [AB a]
    const transformD = transformA.multiplyTransformMatrix3d(matrixB, Transform.createIdentity()); // [AB a]
    const transformE = transformA.multiplyTransformTransform(transformB); // [A a]*[B 0] = [AB A0+a] = [AB a]
    ck.testTransform(transformC, transformD);
    ck.testTransform(transformC, transformE);
    for (const p of points) {
      const productABp = transformA.multiplyPoint3d(transformB.multiplyPoint3d(p));
      const productCp = transformC.multiplyPoint3d(p);
      ck.testPoint3d(productABp, productCp);
    }
    const transformA1 = transformA.clone(); // A1 = [A a]
    ck.testTransform(transformA, transformA1, "clone transform");
    transformA1.multiplyTransformMatrix3d(matrixB, transformA1); // A1 = [AB a]
    ck.testFalse(transformA.isAlmostEqual(transformA1));
    ck.testTransform(transformA1, transformE);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.MultiplyMatrix3dTransform", () => {
  it("Transform.MultiplyMatrix3dTransform", () => {
    const ck = new Checker();
    const points = Sample.createPoint3dLattice(-2, 1, 2);
    const matrixA = Matrix3d.createRowValues(-2, 3, -1, 6, 2, 4, -2, -3, 5);
    const transformA = Transform.createOriginAndMatrix(undefined, matrixA); // [A 0]
    const transformB = Transform.createOriginAndMatrix(
      Point3d.create(1, 2, 3),
      Matrix3d.createRowValues(3, 4, 5, 6, 7, 8, 9, 10, 11),
    ); // [B b]
    const transformC = matrixA.multiplyMatrixTransform(transformB); // [AB Ab]
    const transformD = matrixA.multiplyMatrixTransform(transformB, Transform.createIdentity()); // [AB Ab]
    const transformE = transformA.multiplyTransformTransform(transformB); // [A 0]*[B b] = [AB Ab+0] = [AB Ab]
    ck.testTransform(transformC, transformD);
    ck.testTransform(transformC, transformE);
    for (const p of points) {
      const productABp = Point3d.create();
      matrixA.multiplyXYZtoXYZ(transformB.multiplyPoint3d(p), productABp);
      const productCp = transformC.multiplyPoint3d(p);
      ck.testPoint3d(productABp, productCp);
    }

    const transformB1 = transformB.clone(); // B1 = [B b]
    ck.testTransform(transformB, transformB1, "clone transform");
    matrixA.multiplyMatrixTransform(transformB1, transformB1); // B1 = [AB Ab]
    ck.testFalse(transformA.isAlmostEqual(transformB1));
    ck.testTransform(transformB1, transformE);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.Identity", () => {
  it("Transform.Identity", () => {
    const ck = new Checker();
    const myIdentity0 = Transform.createIdentity(); // user identity
    const myIdentity1 = Transform.createIdentity(); // user identity
    const systemIdentity0 = Transform.identity; // system identity
    const systemIdentity1 = Transform.identity; // system identity
    ck.testTransform(myIdentity0, systemIdentity0, "matching user and system identity contents");
    ck.testTransform(myIdentity1, systemIdentity1), "matching user and system identity contents";
    ck.testTrue(systemIdentity0 === systemIdentity1, "system identity is unique");
    ck.testFalse(myIdentity0 === myIdentity1, "createIdentity makes distinct objects for user identity");
    ck.testFalse(systemIdentity0 === myIdentity0, "system identity object is different then user identity object");
    ck.testFalse(systemIdentity0 === myIdentity1, "system identity object is different then user identity object");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.Clone", () => {
  it("Transform.Clone", () => {
    const ck = new Checker();
    const transformA = Transform.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    const transformB = Transform.createIdentity();
    const transformB1 = transformA.clone(transformB); // B1 = A = B
    ck.testTrue(transformB === transformB1);

    const transformC = Transform.createIdentity();
    const transformB2 = Transform.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, transformC); // B2 = A = C
    ck.testTransform(transformA, transformB2);
    ck.testTransform(transformA, transformB);

    transformC.setFromJSON();
    ck.testTransform(transformC, Transform.identity, "setFromJSON defaults to identity");

    transformC.setFromJSON(transformB);
    ck.testTransform(transformC, transformB, "setFromJSON with transform object input");
  });
});

describe("Transform.CloneRigid", () => {
  it("Transform.CloneRigid", () => {
    const ck = new Checker();
    const singularTransformA = Transform.createRowValues(
      1, 2, 4, 0,
      2, 4, 3, 1,
      3, 6, -10, 1,
    ); // columns X and Y (or 0 and 1) are dependent so matrix part is singular
    const points = [Point3d.create(1, 2, 3), Point3d.create(3, 2, 9)];
    ck.testFalse(singularTransformA.multiplyInversePoint3dArrayInPlace(points));
    ck.testUndefined(
      singularTransformA.cloneRigid(AxisOrder.XYZ),
      "cloneRigid fail because column X and Y are dependent",
    );

    const rigidTransformA = singularTransformA.cloneRigid(AxisOrder.ZXY);
    if (ck.testPointer(rigidTransformA, "cloneRigid does not fail because column Z and X are independent")) {
      ck.testTrue(rigidTransformA.matrix.isRigid());
      const xy = Point2d.create(1, 2);
      const xyz = Point3d.create(1, 2, 0);
      const xyA = rigidTransformA.multiplyPoint2d(xy);
      const xyzA = rigidTransformA.multiplyPoint3d(xyz);
      ck.testCoordinate(xyA.x, xyzA.x);
      ck.testCoordinate(xyA.y, xyzA.y);
    }

    const shift = Point3d.create(1, 2, 3);
    const translateA = Transform.createTranslation(shift);
    const translateB = Transform.createOriginAndMatrix(shift, undefined);
    ck.testTransform(translateA, translateB);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.CreateRigidFromOriginAndColumns", () => {
  it("Transform.CreateRigidFromOriginAndColumns", () => {
    const ck = new Checker();
    const origin = Point3d.create(5, 6, 7);
    const vectorU = Vector3d.create(1, 2, 3);
    const vectorV = Vector3d.create(4, 2, -1);
    const transform0 = Transform.createIdentity();
    const transform1 = Transform.createRigidFromOriginAndColumns(origin, vectorU, vectorV, AxisOrder.XYZ);
    const transform2 = Transform.createRigidFromOriginAndColumns(origin, vectorU, vectorV, AxisOrder.XYZ, transform0);
    if (ck.testPointer(transform1) && ck.testPointer(transform2) && ck.testTrue(transform1.matrix.isRigid())) {
      ck.testTransform(transform0, transform1);
      ck.testTransform(transform1, transform2);
      ck.testParallel(vectorU, transform0.matrix.columnX());
      ck.testPerpendicular(vectorU, transform0.matrix.columnZ());
      ck.testPerpendicular(vectorV, transform0.matrix.columnZ());
      ck.testPerpendicular(vectorU, transform0.matrix.columnY());
      ck.testLE(0.0, transform0.matrix.dotColumnX(vectorU));
      ck.testLE(0.0, transform0.matrix.dotColumnY(vectorV));

    }
    ck.testUndefined(Transform.createRigidFromOriginAndColumns(origin, vectorU, vectorU, AxisOrder.XYZ));
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.GetMatrix", () => {
  it("Transform.GetMatrix", () => {
    const ck = new Checker();
    const transform0 = Transform.createZero();
    const transform1 = Transform.createRefs(Point3d.createZero(), Matrix3d.identity, transform0);
    ck.testTransform(transform0, transform1);
    const matrix = transform1.getMatrix();
    ck.testMatrix3d(matrix, Matrix3d.identity);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.CreateMatrixPickupPutdown", () => {
  it("Transform.CreateMatrixPickupPutdown", () => {
    const ck = new Checker();
    const matrix = Matrix3d.createRowValues(3, 4, 5, 6, 7, 8, 9, 10, 11);
    const a = Point3d.create(1, 2, 3);
    const b = Point3d.create(2, 4, 6);
    const transform = Transform.createMatrixPickupPutdown(matrix, a, b);
    const c = transform.multiplyPoint3d(a);
    ck.testPoint3d(b, c);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Transform.createFlattenAlongVectorToPlane", () => {
  it("Transform.createFlattenAlongVectorToPlane", () => {
    const ck = new Checker();
    const spacePoints = Sample.point3d;
    for (const planeOrigin of spacePoints) {
      for (const planeNormal of [Vector3d.create(0, 0, 1), Vector3d.create(2, 3, -1)]) {
        for (const sweepDirection of ([Vector3d.create(0, 0, 1), Vector3d.create(-2, 3, 1)])) {
          const transform = Transform.createFlattenAlongVectorToPlane(sweepDirection, planeOrigin, planeNormal);
          if (ck.testDefined(transform, "expect good transform") && transform !== undefined) {
            for (const pointA of spacePoints) {
              const pointB = transform.multiplyPoint3d(pointA);
              const dotB = planeNormal.dotProductStartEnd(planeOrigin, pointB);
              if (!ck.testCoordinate(0.0, dotB, "ProjectedPoint on plane")) {
                GeometryCoreTestIO.consoleLog({ planeOrigin, planeNormal, sweepDirection, trans: transform.toJSON() });
                GeometryCoreTestIO.consoleLog({ pointA, pointB });
                Transform.createFlattenAlongVectorToPlane(sweepDirection, planeOrigin, planeNormal);
                break;
              }
            }
          }
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
