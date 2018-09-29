/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d } from "../PointVector";
import { Matrix3d } from "../Transform";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { Checker } from "./Checker";
import { expect } from "chai";

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
    planeF.setFromJSON ({});
    planeF.setFromJSON ();
    planeD.clone (planeF);
    expect(ck.getNumErrors()).equals(0);
  });

  it("altitude", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const vectorU = Vector3d.create(-3, 4, 1);
    const planeAU = Plane3dByOriginAndUnitNormal.create (pointA, vectorU)!;
    const a = 1.4;
    const pointB = planeAU.altitudeToPoint (a);
    ck.testCoordinate (a, planeAU.altitude (pointB), "altitude match");
    expect(ck.getNumErrors()).equals(0);
  });

  it("nulls", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const failPlane = Plane3dByOriginAndUnitNormal.create (pointA, Vector3d.createZero ());
    ck.testUndefined (failPlane, "plane with null normal");
    expect(ck.getNumErrors()).equals(0);
  });
});
