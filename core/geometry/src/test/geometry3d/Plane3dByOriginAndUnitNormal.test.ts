/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";

/** Exercise two planes expected to be parallel. */
function testParallelPair(ck: Checker,
  plane0: Plane3dByOriginAndUnitNormal,
  planeA: Plane3dByOriginAndUnitNormal,
  // expetcted altitude of planeA origin above plane0 origin.
  a: number) {
  ck.testParallel(plane0.getNormalRef(), planeA.getNormalRef());
  ck.testCoordinate(a, plane0.altitude(planeA.getOriginRef()), "expected altitude");
  const f = 0.5;
  const planeB = Plane3dByOriginAndUnitNormal.create(
    plane0.getOriginRef().interpolate(f, planeA.getOriginRef()),
    plane0.getNormalRef());
  const planeB1 = planeB!.clone();
  ck.testCoordinate(planeB1.altitude(plane0.getOriginRef()), -f * a);

  const jsonB1 = planeB1.toJSON();
  const planeB1FromJSON = Plane3dByOriginAndUnitNormal.fromJSON(jsonB1);
  ck.testTrue(planeB1.isAlmostEqual(planeB1FromJSON), " clone, json round trip");

  const triad = Matrix3d.createRigidHeadsUp(plane0.getNormalRef())!;
  const pointC = plane0.getOriginRef().plus(triad.multiplyXYZ(2, 4.1, a));  // this should be on planeA but not at its origin.
  ck.testCoordinate(0, planeA.altitude(pointC));
  const pointC0 = plane0.projectPointToPlane(pointC);
  ck.testCoordinate(0, plane0.altitude(pointC0));
  ck.testTrue(plane0.isPointInPlane(pointC0));

  ck.testCoordinate(0, plane0.velocity(triad.multiplyXY(3, 4)), "in plane vector has zero velocity");
  const v = 23.4;
  ck.testCoordinate(v, plane0.velocity(triad.multiplyXYZ(3, 4, v)), "in plane vector has zero velocity");

}

describe("Plane3dByOriginAndUnitNormal", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const pointB = Point3d.create(5, 2, 1);
    const vectorU = Vector3d.create(-3, 4, 1);
    const planeXY0 = Plane3dByOriginAndUnitNormal.createXYPlane();
    const planeXY1 = Plane3dByOriginAndUnitNormal.createXYPlane(pointA);
    testParallelPair(ck, planeXY0, planeXY1, pointA.z);

    const planeYZ0 = Plane3dByOriginAndUnitNormal.createYZPlane();
    const planeYZ1 = Plane3dByOriginAndUnitNormal.createYZPlane(pointA);
    testParallelPair(ck, planeYZ0, planeYZ1, pointA.x);

    const planeZX0 = Plane3dByOriginAndUnitNormal.createZXPlane();
    const planeZX1 = Plane3dByOriginAndUnitNormal.createZXPlane(pointA);
    testParallelPair(ck, planeZX0, planeZX1, pointA.y);

    const planeABU = Plane3dByOriginAndUnitNormal.createPointPointVectorInPlane(pointA, pointB, vectorU)!;
    ck.testUndefined(Plane3dByOriginAndUnitNormal.createPointPointVectorInPlane(pointA, pointA, vectorU));
    const h = 3.90;
    const pointC = pointA.plusScaled(planeABU.getNormalRef(), h);
    const planeABUh = Plane3dByOriginAndUnitNormal.create(pointC, planeABU.getNormalRef());
    testParallelPair(ck, planeABU, planeABUh!, h);

    const planeD = Plane3dByOriginAndUnitNormal.createXYPlane();
    const planeE = Plane3dByOriginAndUnitNormal.createXYPlane();
    const planeF = Plane3dByOriginAndUnitNormal.createXYPlane();
    planeD.setFrom(planeABU);
    ck.testTrue(planeABU.isAlmostEqual(planeD), "plane setFrom(plane)");
    planeE.set(planeD.getOriginRef(), planeD.getNormalRef());
    ck.testTrue(planeE.isAlmostEqual(planeABU), "plane set(origin, normal)");
    Plane3dByOriginAndUnitNormal.create(planeABU.getOriginRef(), planeABU.getNormalRef(), planeF);
    ck.testTrue(planeF.isAlmostEqual(planeABU), "plane set(origin, normal)");
    ck.checkpoint("Plane3dByOriginAndUnitNormal.HelloWorld");
    // exercise error branches and supplied result ..
    planeF.setFromJSON({});
    planeF.setFromJSON();
    planeD.clone(planeF);
    expect(ck.getNumErrors()).equals(0);
  });

  it("altitude", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const vectorU = Vector3d.create(-3, 4, 1);
    const planeAU = Plane3dByOriginAndUnitNormal.create(pointA, vectorU)!;
    const a = 1.4;
    const pointB = planeAU.altitudeToPoint(a);
    ck.testCoordinate(a, planeAU.altitude(pointB), "altitude match");
    ck.testUndefined(Plane3dByOriginAndUnitNormal.createXYZUVW(3, 2, 1, 0, 0, 0));
    expect(ck.getNumErrors()).equals(0);
  });

  it("nulls", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const failPlane = Plane3dByOriginAndUnitNormal.create(pointA, Vector3d.createZero());
    ck.testUndefined(failPlane, "plane with null normal");
    const plane = Plane3dByOriginAndUnitNormal.createXYPlane();
    const plane1 = plane.cloneTransformed(Transform.createRowValues(
      1, 0, 0, 1,
      0, 1, 0, 3,
      0, 0, 0, 1));
    ck.testUndefined(plane1, "singular transform of plane");
    expect(ck.getNumErrors()).equals(0);
  });
  it("assortedCreate", () => {
    const ck = new Checker();
    const origin = Point3d.create(1, 2, 2.23);
    const normal = Vector3d.create(0.3, 0.4, 0.5).normalize()!;
    const planeA = Plane3dByOriginAndUnitNormal.createXYZUVW(origin.x, origin.y, origin.z, normal.x, normal.y, normal.z)!;
    const planeB = Plane3dByOriginAndUnitNormal.createXYPlane();
    ck.testFalse(planeA.isAlmostEqual(planeB));
    Plane3dByOriginAndUnitNormal.createXYZUVW(origin.x, origin.y, origin.z, normal.x, normal.y, normal.z, planeB);
    ck.testTrue(planeA.isAlmostEqual(planeB));

    const transform = planeB.getLocalToWorld();
    ck.testPoint3d(origin, transform.getOrigin());
    ck.testCoordinate(0, transform.matrix.columnX().dotProduct(normal));
    ck.testCoordinate(0, transform.matrix.columnY().dotProduct(normal));

    const angle = Angle.createDegrees(20);
    const planeP = Plane3dByOriginAndUnitNormal.createXYAngle(1, 2, angle);
    Plane3dByOriginAndUnitNormal.createXYAngle(1, 2, angle, planeB);
    ck.testTrue(planeP.isAlmostEqual(planeB), "createXYAngle into result");
    expect(ck.getNumErrors()).equals(0);
  });

});
