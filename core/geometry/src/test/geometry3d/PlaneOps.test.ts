/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Cone, GeometryQuery, Plane3dByOriginAndVectors } from "../../core-geometry";
import { PlaneAltitudeEvaluator } from "../../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { PlaneOps } from "../../geometry3d/PlaneOps";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Sphere } from "../../solid/Sphere";
describe.only("PlaneOps", () => {

  it("RayPlaneIntersection", () => {
    const ck = new Checker();
    const normal = Vector3d.create(0.2, 0.5, -0.7);
    const inPlaneVector = normal.crossProduct(Vector3d.create(1, 1, 1));
    const planeOrigin = Point3d.create(1, 2, 3);
    const planeP = ClipPlane.createNormalAndPoint(normal, planeOrigin)!;
    const rayA = Ray3d.createXYZUVW(-1, 1, 1, 0.4, -0.1, 0.5)!;
    const intersectionA = PlaneOps.intersectRayPlane(rayA, planeP);
    if (ck.testType(intersectionA.point, Point3d, "single point intersection")
      && ck.testCoordinate(0, planeP.altitude(intersectionA.point), "confirm intersectionA.point on plane")) {
      const rayB = Ray3d.create(intersectionA.point, inPlaneVector);
      const intersectionB = PlaneOps.intersectRayPlane(rayB, planeP);
      if (ck.testType(intersectionB.ray, Ray3d, "confirm ray in plane")
        && ck.testCoordinate(0, planeP.altitude(intersectionB.ray.origin), "origin in plane")
        && ck.testCoordinate(0, planeP.velocity(intersectionB.ray.direction), "direction in plane")) {
        const rayC = Ray3d.create(rayA.origin, inPlaneVector);
        const intersectionC = PlaneOps.intersectRayPlane(rayC, planeP);
        ck.testType(intersectionC.separatorSegment, Object);
        ck.testCoordinate(0, planeP.altitude(intersectionC.separatorSegment!.pointB));
        const rayPointC = rayC.projectPointToRay(intersectionC.separatorSegment!.pointA);
        ck.testPoint3d(rayPointC, intersectionC.separatorSegment!.pointA, "separator segment point on ray");
      }
    }
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
    const allGeometry: GeometryQuery[] = [];
    const originA = Point3d.create(1, 2, 2.23);
    const normalA = Vector3d.create(0.3, 0.4, 0.5).normalize()!;
    const planeA = Plane3dByOriginAndUnitNormal.createXYZUVW(originA.x, originA.y, originA.z, normalA.x, normalA.y, normalA.z)!;
    const planeB = Plane3dByOriginAndUnitNormal.createXYZUVW(4, 2, -9, 4.3, 0.4, -1.0)!;
    const planeC = Plane3dByOriginAndUnitNormal.createXYZUVW(5, 2, 1, 1.2, -0.4, 3.7)!;

    const normalQ = Vector3d.create(-0.25, 0.31, 0.49);
    // 3 distinct parallel planes . ..
    const planeQ1 = ClipPlane.createNormalAndDistance(normalQ, 1.2)!;
    const planeQ2 = ClipPlane.createNormalAndDistance(normalQ, 4.7)!;
    const planeQ3 = ClipPlane.createNormalAndDistance(normalQ, -1.0)!;
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const planePanelSize = 15;
    const sphereSize = 1;
    const cylinderRadiusA = 0.25;
    const cylinderRadiusB = 0.35;
    // test when 3 planes are known to generate 3-part return
    const test3WayIntersection = (plane0: PlaneAltitudeEvaluator, plane1: PlaneAltitudeEvaluator, plane2: PlaneAltitudeEvaluator) => {
      const planes: PlaneAltitudeEvaluator[] = [plane0, plane1, plane2, plane0];    // wrap to simplify loop indexing
      GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 8, plane0, 0.6 * planePanelSize, x0, y0, z0);
      GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 8, plane1, 0.8 * planePanelSize, x0, y0, z0);
      GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 8, plane2, 1.0 * planePanelSize, x0, y0, z0);
      const result = PlaneOps.intersect3Planes(plane0, plane1, plane2);

      const numResultFragment = countDefined([result.point, result.plane, result.ray]);
      if (!ck.testTrue(numResultFragment < 2, "Disallow multiple result items from PlanePlanePlane")) {
        // bad -- skip further tests
      } else if (result.point !== undefined) {
        GeometryCoreTestIO.captureGeometry(allGeometry, Sphere.createCenterRadius(result.point, sphereSize), x0, y0, z0);
        for (const p of planes) {
          ck.testCoordinate(0, p.altitude(result.point), "Simple intersection on plane");
        }
      } else if (result.plane !== undefined) {
        // The three planes are identical
        GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 0, result.plane, 2.0 * planePanelSize, x0, y0, z0);
        for (const i of [0, 1, 2])
          ck.testExactNumber(1, Math.abs(PlaneOps.classifyIfParallelPlanes(planes[i], planes[i + 1])), "confirm identical planes");
      } else if (result.ray !== undefined) {
        GeometryCoreTestIO.captureGeometry(allGeometry,
          Cone.createAxisPoints(result.ray.fractionToPoint(-2.5 * planePanelSize), result.ray.fractionToPoint(2.5 * planePanelSize),
            cylinderRadiusA, cylinderRadiusA, false), x0, y0, z0);
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
            GeometryCoreTestIO.captureGeometry(allGeometry,
              Cone.createAxisPoints(r01.ray.fractionToPoint(-planePanelSize), r01.ray.fractionToPoint(planePanelSize),
                sphereSize, sphereSize, false), x0, y0, z0);

            for (const p of [planes[i], planes[i + 1]]) {
              ck.testCoordinate(0, p.altitude(r01.ray.origin), "ray on plane 0");
              ck.testPerpendicular(r01.ray.direction, Vector3d.create(p.normalX(), p.normalY(), p.normalZ()), "intersection in plane");
            }
          } else if (r01.plane !== undefined) {
            // plane must match both planes
            GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 0, r01.plane, 2.0 * planePanelSize, x0, y0, z0);
            ck.testExactNumber(1, Math.abs(PlaneOps.classifyIfParallelPlanes(planes[i], planes[i + 1])), "confirm identical planes");
          } else if (r01 === undefined) {
            const normal0 = Vector3d.create(planes[i].normalX(), planes[i].normalY(), planes[i].normalZ());
            const normal1 = Vector3d.create(planes[i + 1].normalX(), planes[i + 1].normalY(), planes[i + 1].normalZ());
            ck.testTrue(normal0.isParallelTo(normal1, true));
          } else if (r01.separatorSegment !== undefined) {
            const p0 = PlaneOps.closestPointToOrigin(planes[i]);
            const p1 = PlaneOps.closestPointToOrigin(planes[i + 1]);
            GeometryCoreTestIO.captureGeometry(allGeometry,
              Cone.createAxisPoints(r01.separatorSegment.pointA, r01.separatorSegment.pointB, cylinderRadiusB, cylinderRadiusB, false), x0, y0, z0);
            ck.testCoordinate(r01.separatorSegment.pointA.distance(r01.separatorSegment.pointB), p0.distance(p1), "confirm distance between parallel planes");
          } else {
            ck.announceError("unexpected type in plane plane pair", r01);
          }
        }
      }
      x0 += 10 * planePanelSize;
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
    test3WayIntersection(planeQ3, planeQ1, planeQ2);
    const frame = Plane3dByOriginAndVectors.createOriginAndVectors(
      Point3d.create(1, 2, 3),
      Vector3d.create(1, 0, 2),
      Vector3d.create(-2, 1, 1));
    test3WayIntersection(
      Plane3dByOriginAndUnitNormal.create(frame.origin, frame.vectorU)!,
      Plane3dByOriginAndUnitNormal.create(frame.origin, frame.vectorV)!,
      Plane3dByOriginAndUnitNormal.create(frame.origin, frame.vectorV.plusScaled(frame.vectorU, 0.9))!);

    test3WayIntersection(
      Plane3dByOriginAndUnitNormal.create(frame.origin, frame.vectorU)!,
      Plane3dByOriginAndUnitNormal.create(frame.origin, frame.vectorV)!,
      Plane3dByOriginAndUnitNormal.create(frame.origin.plusScaled(frame.vectorU, 2.0), frame.vectorV.plusScaled(frame.vectorU, 0.9))!);

    GeometryCoreTestIO.saveGeometry(allGeometry, "PlaneOps", "PPPIntersection");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PPIntersection", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const originA = Point3d.create(1, 2, 2.23);
    const normalA = Vector3d.create(0.3, 0.4, 0.5).normalize()!;
    const planeA = Plane3dByOriginAndUnitNormal.createXYZUVW(originA.x, originA.y, originA.z, normalA.x, normalA.y, normalA.z)!;

    const normalQ = Vector3d.create(-0.25, 0.31, 0.49);
    // 3 distinct parallel planes . ..
    const planeQ1 = ClipPlane.createNormalAndDistance(normalQ, 1.2)!;
    const planeQ2 = ClipPlane.createNormalAndDistance(normalQ, 4.7)!;
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const planePanelSize = 15;
    const cylinderRadiusA = 0.25;
    const cylinderRadiusB = 0.35;
    // test when 3 planes are known to generate 3-part return
    const test2WayIntersection = (plane0: PlaneAltitudeEvaluator, plane1: PlaneAltitudeEvaluator) => {
      const planes: PlaneAltitudeEvaluator[] = [plane0, plane1, plane0];    // wrap to simplify loop indexing
      GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 8, plane0, 0.6 * planePanelSize, x0, y0, z0);
      GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 8, plane1, 0.8 * planePanelSize, x0, y0, z0);
      const result = PlaneOps.intersect2Planes(plane0, plane1);

      const numResultFragment = countDefined([result.plane, result.ray, result.separatorSegment]);
      if (!ck.testTrue(numResultFragment < 2, "Disallow multiple result items from PlanePlanePlane")) {
        // bad -- skip further tests
      } else if (result.plane !== undefined) {
        // The three planes are identical
        GeometryCoreTestIO.createAndCaptureLoopOnPlane(allGeometry, 0, result.plane, 2.0 * planePanelSize, x0, y0, z0);
        for (const i of [0, 1])
          ck.testExactNumber(1, Math.abs(PlaneOps.classifyIfParallelPlanes(planes[i], planes[i + 1])), "confirm identical planes");
      } else if (result.ray !== undefined) {
        GeometryCoreTestIO.captureGeometry(allGeometry,
          Cone.createAxisPoints(result.ray.fractionToPoint(-2.5 * planePanelSize), result.ray.fractionToPoint(2.5 * planePanelSize),
            cylinderRadiusA, cylinderRadiusA, false), x0, y0, z0);
        for (let i = 0; i < 2; i++) {
          const normal = PlaneOps.planeNormal(planes[i]);
          ck.testCoordinate(0, planes[i].altitude(result.ray.origin), "ray on plane 0");
          ck.testPerpendicular(result.ray.direction, normal, "intersection in plane");
        }
      } else if (result.separatorSegment !== undefined) {
        const p0 = PlaneOps.closestPointToOrigin(plane0);
        const p1 = PlaneOps.closestPointToOrigin(plane1);
        GeometryCoreTestIO.captureGeometry(allGeometry,
          Cone.createAxisPoints(result.separatorSegment.pointA, result.separatorSegment.pointB, cylinderRadiusB, cylinderRadiusB, false), x0, y0, z0);
        ck.testCoordinate(result.separatorSegment.pointA.distance(result.separatorSegment.pointB), p0.distance(p1), "confirm distance between parallel planes");
      } else {
        ck.announceError("unexpected type in plane plane pair", result);
      }
      x0 += 10 * planePanelSize;
    };

    test2WayIntersection(planeA, planeA);

    test2WayIntersection(planeA, planeQ1);
    test2WayIntersection(planeQ1, planeQ2);

    GeometryCoreTestIO.saveGeometry(allGeometry, "PlaneOps", "PPIntersection");
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
