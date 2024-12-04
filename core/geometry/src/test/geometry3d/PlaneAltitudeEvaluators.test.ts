/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { AxisOrder } from "../../Geometry";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { Sample } from "../../serialization/GeometrySamples";
import { Point4d } from "../../geometry4d/Point4d";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Plane3d } from "../../geometry3d/Plane3d";

/**
 * Check that planeA and planeB have matched PlaneAltitudeEvaluator results (other than bit loss)
 * Note that this is a strong set of orientation and scaling expectations.
 */
function verifyMatchedPlaneAltitudeEvaluator(ck: Checker, planeA: Plane3d, planeB: Plane3d) {
  const points = Sample.point3d;
  const vectors = Sample.createNonZeroVectors();
  ck.testCoordinate(planeA.normalX(), planeB.normalX(), "normalX");
  ck.testCoordinate(planeA.normalY(), planeB.normalY(), "normalY");
  ck.testCoordinate(planeA.normalZ(), planeB.normalZ(), "normalZ");
  for (const p of points) {
    ck.testCoordinate(planeA.altitude(p), planeB.altitude(p), { altitudeOf: p });
    ck.testCoordinate(planeA.altitudeXYZ(p.x, p.y, p.z), planeA.altitude(p), { altitudeOf: p });
    ck.testCoordinate(planeA.altitudeXYZ(p.x, p.y, p.z), planeB.altitudeXYZ(p.x, p.y, p.z), { altitudeOf: p });
    ck.testCoordinate(planeA.altitudeXYZ(p.x, p.y, p.z), planeA.altitude(p), { altitudeOf: p });
    const p4 = Point4d.create(p.x, p.y, p.z, 1.0);
    ck.testCoordinate(planeA.weightedAltitude(p4), planeB.weightedAltitude(p4), { weightedAltitude1: p4 });
    p4.z = 2.0;
    ck.testCoordinate(planeA.weightedAltitude(p4), planeB.weightedAltitude(p4), { weightedAltitude2: p4 });
    const qA = planeA.projectPointToPlane(p);
    const qB = planeB.projectPointToPlane(p);
    if (ck.testType(qA, Point3d) && ck.testType(qB, Point3d)) {
      ck.testPoint3d(qA, qB, "point projected to plane");
    }
  }
  for (const v of vectors) {
    ck.testCoordinate(planeA.velocity(v), planeB.velocity(v), { velocityOf: v });
    ck.testCoordinate(planeA.velocityXYZ(v.x, v.y, v.z), planeA.velocity(v), { velocityOf: v });
    ck.testCoordinate(planeA.velocityXYZ(v.x, v.y, v.z), planeB.velocityXYZ(v.x, v.y, v.z), { velocityOf: v });
    ck.testCoordinate(planeA.velocityXYZ(v.x, v.y, v.z), planeA.velocity(v), { velocityXYZ: v });
  }
}

describe("PlaneEvaluator", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const pointA = Point3d.create(1.2, 3);
    for (const normal of [Vector3d.createNormalized(0, 0, 1)!,
    Vector3d.createNormalized(2, -1, 4)!]) {

      const matrix = Matrix3d.createRigidHeadsUp(normal, AxisOrder.ZXY);
      const vectorU = matrix.columnX();
      const vectorV = matrix.columnY();
      const pointU = pointA.plus(vectorU);
      const pointV = pointA.plus(vectorV);

      const planeA = Plane3dByOriginAndUnitNormal.createOriginAndVectors(pointA, vectorU, vectorV)!;
      const planeB = Plane3dByOriginAndVectors.createOriginAndVectors(pointA, vectorU, vectorV);
      verifyMatchedPlaneAltitudeEvaluator(ck, planeA, planeB);

      const planeC = ClipPlane.createNormalAndPoint(normal, pointA)!;
      const planeD = Plane3dByOriginAndUnitNormal.create(pointA, normal)!;
      if (ck.testType(planeC, ClipPlane) && ck.testType(planeD, Plane3dByOriginAndUnitNormal))
        verifyMatchedPlaneAltitudeEvaluator(ck, planeC, planeD);

      const planeA1 = Plane3dByOriginAndUnitNormal.createOriginAndTargets(pointA, pointU, pointV)!;
      const planeB1 = Plane3dByOriginAndVectors.createOriginAndTargets(pointA, pointU, pointV);
      verifyMatchedPlaneAltitudeEvaluator(ck, planeA1, planeB1);

      for (const sourcePlane of [planeA, planeB, planeC, planeD, planeA1, planeB1]) {
        const plane4d = Point4d.createPlaneFrom(sourcePlane);
        if (ck.testType(plane4d, Point4d, "Convert to Point4d plane"))
          verifyMatchedPlaneAltitudeEvaluator(ck, sourcePlane, plane4d);
        // test specific conversions
        const planeM = Plane3dByOriginAndUnitNormal.createFrom(sourcePlane);
        if (ck.testType(planeM, Plane3dByOriginAndUnitNormal, "Convert to Plane3dByOriginAndUnitNormal")) {
          verifyMatchedPlaneAltitudeEvaluator(ck, sourcePlane, planeM);
        }

        const planeN = Plane3dByOriginAndVectors.createFrom(sourcePlane);
        if (ck.testType(planeN, Plane3dByOriginAndVectors, "Convert to Plane3dByOriginAndVectors")) {
          verifyMatchedPlaneAltitudeEvaluator(ck, sourcePlane, planeN);
        }
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

});
