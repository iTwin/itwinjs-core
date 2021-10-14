/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point4d } from "../../geometry4d/Point4d";
import { Checker } from "../Checker";

/* eslint-disable no-console, @typescript-eslint/naming-convention */

function testExactPoint4dXYZW(ck: Checker, point: Point4d, x: number, y: number, z: number, w: number) {
  ck.testExactNumber(x, point.x);
  ck.testExactNumber(y, point.y);
  ck.testExactNumber(z, point.z);
  ck.testExactNumber(w, point.w);
}

function testExactPoint4dPoint4d(ck: Checker, pointA: Point4d, pointB: Point4d) {
  ck.testExactNumber(pointA.x, pointB.x);
  ck.testExactNumber(pointA.y, pointB.y);
  ck.testExactNumber(pointA.z, pointB.z);
  ck.testExactNumber(pointA.w, pointB.w);
}

describe("Point4d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    testExactPoint4dXYZW(ck, pointA, 3, 6, 9, 12);
    pointA.set(2, 4, 6, 8);
    testExactPoint4dXYZW(ck, pointA, 2, 4, 6, 8);
    pointA.x = 10; testExactPoint4dXYZW(ck, pointA, 10, 4, 6, 8);
    pointA.y = 20; testExactPoint4dXYZW(ck, pointA, 10, 20, 6, 8);
    pointA.z = 30; testExactPoint4dXYZW(ck, pointA, 10, 20, 30, 8);
    pointA.w = 40; testExactPoint4dXYZW(ck, pointA, 10, 20, 30, 40);

    const pointB = Point4d.create(-1, -2, -3, -4);
    pointB.setFrom(pointA); testExactPoint4dPoint4d(ck, pointA, pointB);
    const pointC = pointA.clone(); testExactPoint4dPoint4d(ck, pointB, pointC);
    const dataD = [12, 13, 14, 15];
    pointC.setFromJSON(dataD);
    const pointC2 = Point4d.fromJSON(dataD);
    testExactPoint4dPoint4d(ck, pointC, pointC2);
    const e = 1.0e-14;  // well below coordinate tolerance
    ck.testTrue(pointC.isAlmostEqualXYZW(dataD[0], dataD[1], dataD[2], dataD[3]));
    const q = 1.0 + e;
    ck.testTrue(pointC.isAlmostEqualXYZW(dataD[0] * q, dataD[1] * q + e, dataD[2] / q, dataD[3] / q + e));
    const f = 1.0e-3; // much bigger than coordinate tolerance . . .
    ck.testFalse(pointC.isAlmostEqualXYZW(dataD[0], dataD[1], dataD[2], dataD[3] - f));
    ck.testFalse(pointC.isAlmostEqualXYZW(dataD[0], dataD[1], dataD[2] + f, dataD[3]));
    ck.testFalse(pointC.isAlmostEqualXYZW(dataD[0], dataD[1] - 2 * f, dataD[2], dataD[3]));
    ck.testFalse(pointC.isAlmostEqualXYZW(dataD[0] + 3 * f, dataD[1], dataD[2], dataD[3]));

    const pointA1 = pointA.clone();
    ck.testTrue(pointA1.isAlmostEqual(pointA));
    pointA1.x += f; ck.testFalse(pointA1.isAlmostEqual(pointA)); pointA1.setFrom(pointA);
    pointA1.y += f; ck.testFalse(pointA1.isAlmostEqual(pointA)); pointA1.setFrom(pointA);
    pointA1.z += f; ck.testFalse(pointA1.isAlmostEqual(pointA)); pointA1.setFrom(pointA);
    pointA1.w += f; ck.testFalse(pointA1.isAlmostEqual(pointA)); pointA1.setFrom(pointA);

    pointC.setFromJSON([1]);
    testExactPoint4dXYZW(ck, pointC, 0, 0, 0, 0);

    const pointA3 = Point4d.fromJSON(pointA.toJSON());
    testExactPoint4dPoint4d(ck, pointA, pointA3);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Shifts", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    const e = 22.8231237123719;
    for (let i = 0; i < 4; i++) {
      const pointB = pointA.clone();
      const q = pointB.xyzw[i] + e; // we know that this is the maxAbs !!!
      pointB.xyzw[i] = q;
      ck.testCoordinate(pointA.distanceXYZW(pointB), e, "single component distance", pointA, pointB);
      ck.testCoordinate(pointA.distanceSquaredXYZW(pointB), e * e, "single component squared distance");
      ck.testCoordinate(pointA.maxDiff(pointB), e, "single component max diff");
      const vectorAB = pointB.minus(pointA);
      ck.testCoordinate(vectorAB.magnitudeXYZW(), e);
      if (i !== 3)
        ck.testCoordinate(vectorAB.magnitudeSquaredXYZ(), e * e);
      ck.testCoordinate(pointB.maxAbs(), q, "maxAbs");
      const pointB1 = pointA.plus(vectorAB);
      ck.testPoint4d(pointB, pointB1, ".plus");
    }
    for (let i = 0; i < 4; i++) {
      const pointB = Point4d.createZero();
      ck.testTrue(pointB.isAlmostZero);
      pointB.xyzw[i] = e;
      ck.testFalse(pointB.isAlmostZero, "Point4d.isAlmostZero");
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Vectors", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    const pointB = Point4d.create(-1.1, 0.2, 5.3, 1.4);

    const dABXY = pointA.realDistanceXY(pointB)!;
    const pointA3 = pointA.normalizeWeight()!;
    const pointB3 = pointB.normalizeWeight()!;
    ck.testCoordinate(dABXY, pointA3.realDistanceXY(pointB3)!);
    const diffAB3 = pointB.crossWeightedMinus(pointA);
    const diffAB4 = pointB.scale(pointA.w).minus(pointA.scale(pointB.w));
    const diffAB3W = Point4d.create(diffAB3.x, diffAB3.y, diffAB3.z, 0.0);
    ck.testPoint4d(diffAB4, diffAB3W, "crossWeightedDifference)");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Planes", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    const pointB = Point4d.create(-1.1, 0.2, 5.3, 1.4);
    const planeABZ = Point4d.createPlanePointPointZ(pointA, pointB)!;
    ck.testCoordinate(0.0, pointA.dotProduct(planeABZ));
    ck.testCoordinate(0.0, pointB.dotProduct(planeABZ));
    ck.testCoordinate(0.0, planeABZ.dotProductXYZW(0, 0, 1, 0));
    const pointU0 = Point4d.create(3, 7, 11, 0);
    ck.testCoordinate(pointB.velocityXYZ(pointU0.x, pointU0.y, pointU0.z),
      pointB.dotProductXYZW(pointU0.x, pointU0.y, pointU0.z, 0.0));

    const pointC = Point3d.create(1, 2, 9);
    const pointCH = Point4d.createFromPointAndWeight(pointC, 1.0);
    ck.testCoordinate(planeABZ.altitude(pointC), planeABZ.dotProduct(pointCH));

    const vectorE = Vector3d.create(7, 9, -1);
    const vectorEH = Point4d.createFromPointAndWeight(vectorE, 0.0);
    ck.testCoordinate(planeABZ.velocity(vectorE), planeABZ.dotProduct(vectorEH));

    const planeC = Point4d.create(4, 2, 1, 0).toPlane3dByOriginAndUnitNormal();
    ck.testDefined(planeC, "plane through origin");
    const planeD = Point4d.create(0, 0, 0, 1).toPlane3dByOriginAndUnitNormal();
    ck.testUndefined(planeD, "plane with undefined normal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Vectors", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    const pointB = Point4d.create(-1.1, 0.2, 5.3, 1.4);

    const dABXY = pointA.realDistanceXY(pointB)!;
    const pointA3 = pointA.normalizeWeight()!;
    const pointB3 = pointB.normalizeWeight()!;
    ck.testCoordinate(dABXY, pointA3.realDistanceXY(pointB3)!);
    const diffAB3 = pointB.crossWeightedMinus(pointA);
    const diffAB4 = pointB.scale(pointA.w).minus(pointA.scale(pointB.w));
    const diffAB3W = Point4d.create(diffAB3.x, diffAB3.y, diffAB3.z, 0.0);

    ck.testPoint4d(diffAB4, diffAB3W, "crossWeightedDifference)");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Packing", () => {
    const ck = new Checker();
    const packedData = new Float64Array([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24]);
    const unitVectors = [Point4d.unitX(), Point4d.unitY(), Point4d.unitZ(), Point4d.unitW()];
    for (let i = 0; i < 3; i++) {
      const i0 = 4 * i;
      const pointI = Point4d.createFromPackedXYZW(packedData, i0);
      const q = 10 * i;
      ck.testPoint4d(pointI, Point4d.create(q + 1, q + 2, q + 3, q + 4));
      for (let k = 0; k < 3; k++) {
        ck.testCoordinate(packedData[i0 + i], pointI.dotProduct(unitVectors[i]));
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Distances", () => {
    const ck = new Checker();
    const pointA = Point4d.create(3, 6, 9, 12);
    const pointB = Point4d.create(-1.1, 0.2, 5.3, 1.4);
    const xyzA = pointA.normalizeWeight()!;
    const xyzB = pointB.normalizeWeight()!;
    const vectorA = xyzA.clone(); vectorA.w = 0.0;
    const vectorB = xyzB.clone(); vectorB.w = 0.0;

    ck.testCoordinate(0.0, pointA.realDistanceXY(pointA)!);
    ck.testCoordinate(pointA.realDistanceXY(pointB)!, xyzA.realDistanceXY(xyzB)!);
    ck.testUndefined(pointA.realDistanceXY(vectorB));
    ck.testUndefined(vectorA.realDistanceXY(pointB));
    expect(ck.getNumErrors()).equals(0);
  });

  it("Quaternions", () => {
    const ck = new Checker();
    const quatA = Point4d.create(3, 6, 9, 12); quatA.normalizeQuaternion();
    const quatB = Point4d.create(-1.1, 0.2, 5.3, 1.4); quatB.normalizeQuaternion();
    const quat0 = Point4d.interpolateQuaternions(quatA, 0, quatA);
    const quat1 = Point4d.interpolateQuaternions(quatB, 1.0, quatB);
    ck.testCoordinate(1.0, quatA.magnitudeXYZW());
    ck.testCoordinate(1.0, quatB.magnitudeXYZW());
    ck.testPoint4d(quatA, quat0);
    ck.testPoint4d(quatB, quat1);
    const quat20 = Point4d.interpolateQuaternions(quat0, 0.20, quat1);
    const quat80 = Point4d.interpolateQuaternions(quat0, 0.80, quat1);
    const quat50 = Point4d.interpolateQuaternions(quat0, 0.50, quat1);
    const sum01 = quat0.plus(quat1);
    ck.testCoordinate(0, quat50.radiansToPoint4dXYZW(sum01)!);
    // const quatC = Point4d.interpolateQuaternions(quat0, 25, quat80);
    // ck.testPoint4d(quat20, quatC, "variant path to interpolant");

    const perp20 = Point4d.perpendicularPoint4dPlane(quat0, quat20, quat1);  // The three inputs are in a plane.  Quat should be zero?
    const perp80 = Point4d.perpendicularPoint4dPlane(quat0, quat80, quat1);  // The three inputs are in a plane.  Quat should be zero?
    ck.testCoordinate(0.0, perp20.magnitudeXYZW(), "coplanar quaternions have 0 cross product.");
    ck.testCoordinate(0.0, perp80.magnitudeXYZW(), "coplanar quaternions have 0 cross product.");
    const epsilon = 0.000001;
    const nearly1 = 1.0 - epsilon;
    const quatQ0 = Point4d.interpolateQuaternions(quat0, epsilon, quat1);
    const quatQ1 = Point4d.interpolateQuaternions(quat0, nearly1, quat1);
    const quat0Q0 = Point4d.interpolateQuaternions(quat0, 0.8, quatQ0);   // nearly parallel !!!
    ck.testLE(quat1.distanceXYZW(quatQ1), epsilon);
    ck.testLE(quat0.distanceXYZW(quat0Q0), epsilon);

    const quatANeg = quatA.negate();

    Point4d.interpolateQuaternions(quatA, 0.75, quatANeg); // not sure what this means physically.

    ck.testUndefined(quatA.radiansToPoint4dXYZW(Point4d.createZero()));
    expect(ck.getNumErrors()).equals(0);
  });
});
