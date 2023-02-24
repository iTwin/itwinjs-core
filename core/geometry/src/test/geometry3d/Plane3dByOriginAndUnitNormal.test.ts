/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipPlane } from "../../clipping/ClipPlane";
import { PlaneAltitudeEvaluator } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { PlaneOps } from "../../geometry3d/PlaneOps";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";

/** Exercise two planes expected to be parallel. */
function testParallelPair(ck: Checker,
  plane0: Plane3dByOriginAndUnitNormal,
  planeA: Plane3dByOriginAndUnitNormal,
  // expected altitude of planeA origin above plane0 origin.
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
  it("ParallelPlanes", () => {
    const ck = new Checker();
    const normalA = Vector3d.create(0.3, 0.4, 0.5).normalize()!;
    const normalB = normalA.scale(-1.0);
    const normalC = Vector3d.create(5, 2, 3);
    const originAB1 = Point3d.create(4, 3, 9);
    const originAB2 = originAB1.plusScaled(normalA, 1.54);
    // these are through the same point with opposing normals
    const planeA1 = Plane3dByOriginAndUnitNormal.create(originAB1, normalA)!;
    const planeB1 = Plane3dByOriginAndUnitNormal.create(originAB1, normalB)!;
    // these are through the another point with the same opposing normals
    const planeA2 = Plane3dByOriginAndUnitNormal.create(originAB2, normalA)!;
    const planeB2 = Plane3dByOriginAndUnitNormal.create(originAB2, normalB)!;
    // this is unrelated normal.
    const planeC = Plane3dByOriginAndUnitNormal.create(originAB2, normalC)!;
    ck.testExactNumber(1, PlaneOps.classifyIfParallelPlanes(planeA1, planeA1));
    ck.testExactNumber(-1, PlaneOps.classifyIfParallelPlanes(planeA1, planeB1));
    ck.testExactNumber(1, PlaneOps.classifyIfParallelPlanes(planeA2, planeA2));
    ck.testExactNumber(-1, PlaneOps.classifyIfParallelPlanes(planeA2, planeB2));

    ck.testExactNumber(2, PlaneOps.classifyIfParallelPlanes(planeA1, planeA2));
    ck.testExactNumber(-2, PlaneOps.classifyIfParallelPlanes(planeA1, planeB2));
    ck.testExactNumber(-2, PlaneOps.classifyIfParallelPlanes(planeB1, planeA2));
    ck.testExactNumber(2, PlaneOps.classifyIfParallelPlanes(planeB1, planeB2));

    ck.testExactNumber(0, PlaneOps.classifyIfParallelPlanes(planeA1, planeC));
    ck.testExactNumber(0, PlaneOps.classifyIfParallelPlanes(planeB1, planeC));
    ck.testExactNumber(0, PlaneOps.classifyIfParallelPlanes(planeA2, planeC));
    ck.testExactNumber(0, PlaneOps.classifyIfParallelPlanes(planeB2, planeC));

    expect(ck.getNumErrors()).equals(0);
  });
  it("PPPIntersection", () => {
    const ck = new Checker();
    const originA = Point3d.create(1, 2, 2.23);
    const normalA = Vector3d.create(0.3, 0.4, 0.5).normalize()!;
    const planeA = Plane3dByOriginAndUnitNormal.createXYZUVW(originA.x, originA.y, originA.z, normalA.x, normalA.y, normalA.z)!;
    const planeB = Plane3dByOriginAndUnitNormal.createXYZUVW(4, 2, -9, 4.3, 0.4, -1.0)!;
    const planeC = Plane3dByOriginAndUnitNormal.createXYZUVW(5, 2, 1, 1.2, -0.4, 3.7)!;

    const normalQ = Vector3d.create(-0.25, 0.31, 0.49);
    // 3 distinct parallel planes . ..
    const planeQ1 = ClipPlane.createNormalAndDistance(normalQ, 1.2)!;
    const planeQ2 = ClipPlane.createNormalAndDistance(normalQ, 4.7)!;
    const planeQ3 = ClipPlane.createNormalAndDistance(normalQ, 0.0)!;

    // test when 3 planes are known to generate 3-part return
    const test3WayIntersection = (plane0: PlaneAltitudeEvaluator, plane1: PlaneAltitudeEvaluator, plane2: PlaneAltitudeEvaluator) => {
      const planes: PlaneAltitudeEvaluator[] = [plane0, plane1, plane2, plane0];    // wrap to simplify loop indexing
      const result = PlaneOps.intersect3Planes(plane0, plane1, plane2);

      const numResultFragment = countDefined([result.point, result.plane, result.ray]);
      if (!ck.testTrue(numResultFragment < 2, "Disallow multiple result items from PlanePlanePlane")) {
        // bad -- skip further tests
      } if (result.point !== undefined) {
        for (const p of planes) {
          ck.testCoordinate(0, p.altitude(result.point), "Simple intersection on plane");
        }
      } else if (result.plane !== undefined) {
        // The three planes are identical
        for (const i of [0, 1, 2])
          ck.testExactNumber(1, Math.abs(PlaneOps.classifyIfParallelPlanes(planes[i], planes[i + 1])), "confirm identical planes");
      } else if (result.ray !== undefined) {
        for (let i = 0; i < 3; i++) {
          const normal = PlaneOps.planeNormal(planes[i]);
          ck.testCoordinate(0, planes[i].altitude(result.ray.origin), "ray on plane 0");
          ck.testPerpendicular(result.ray.direction, normal, "intersection in plane");
        }
      } else if (ck.testTrue(Array.isArray(result.pairwiseDetail), "Expect array result", result)
        && Array.isArray(result.pairwiseDetail)
        && ck.testExactNumber(3, result.pairwiseDetail.length, "3 pairs")) {
        for (const i of [0, 1, 2]) {
          const r01 = result.pairwiseDetail[i];
          if (r01.ray instanceof Ray3d) {
            for (const p of [planes[i], planes[i + 1]]) {
              ck.testCoordinate(0, p.altitude(r01.ray.origin), "ray on plane 0");
              ck.testPerpendicular(r01.ray.direction, Vector3d.create(p.normalX(), p.normalY(), p.normalZ()), "intersection in plane");
            }
          } else if (r01.plane !== undefined) {
            // plane must match both planes
            ck.testExactNumber(1, Math.abs(PlaneOps.classifyIfParallelPlanes(planes[i], planes[i + 1])), "confirm identical planes");
          } else if (r01 === undefined) {
            const normal0 = Vector3d.create(planes[i].normalX(), planes[i].normalY(), planes[i].normalZ());
            const normal1 = Vector3d.create(planes[i + 1].normalX(), planes[i + 1].normalY(), planes[i + 1].normalZ());
            ck.testTrue(normal0.isParallelTo(normal1, true));
          } else if (r01.separatorSegment !== undefined) {
            const p0 = PlaneOps.closestPointToOrigin(planes[i]);
            const p1 = PlaneOps.closestPointToOrigin(planes[i + 1]);
            ck.testCoordinate(r01.separatorSegment.pointA.distance(r01.separatorSegment.pointB), p0.distance(p1), "confirm distance between parallel planes");
          } else {
            ck.announceError("unexpected type in plane plane pair", r01);
          }
        }
      }

    };

    for (const singlePlane of [planeA, planeB, planeC]) {
      test3WayIntersection(singlePlane, singlePlane, singlePlane);
    }

    const planeXY1 = Plane3dByOriginAndUnitNormal.createXYZUVW(1, 0, 0, 0, 0, 1)!;
    const planeXZ22 = Plane3dByOriginAndUnitNormal.createXYZUVW(2, 2, 0, 0, 1, 0)!;

    test3WayIntersection(planeA, planeB, planeC);
    test3WayIntersection(planeXY1, planeXY1, planeXZ22);
    test3WayIntersection(planeQ1, planeQ1, planeB);
    test3WayIntersection(planeQ1, planeA, planeQ2);
    test3WayIntersection(planeA, planeQ1, planeQ3);
    expect(ck.getNumErrors()).equals(0);
  });

});
function countDefined(items: Array<object | undefined>): number {
  let n = 0;
  for (const item of items)
    if (item !== undefined)
      n++;
  return n;
}
