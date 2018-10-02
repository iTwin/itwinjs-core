/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d } from "../geometry3d/PointVector";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Transform";
import { Ray3d } from "../geometry3d/Ray3d";
import { Checker } from "./Checker";
import { expect } from "chai";

/** create rays, using optional result (which may be undefined)
 */
function createRays(ck: Checker, target?: Ray3d) {
  const pointA = Point3d.create(1, 2, 3);
  const directionA = Vector3d.create(4, 5, 6);
  const pointB = pointA.plus(directionA);
  const ray = Ray3d.create(pointA, directionA, target);

  ck.testFalse(pointA === ray.origin, "confirm inputs cloned");
  ck.testFalse(directionA === ray.direction, "confirm inputs cloned");
  const ray1 = Ray3d.createXYZUVW(pointA.x, pointA.y, pointA.z, directionA.x, directionA.y, directionA.z, target);
  ck.testPoint3d(pointA, ray1.origin);
  ck.testVector3d(directionA, ray1.direction);

  const transform = Transform.createOriginAndMatrix(Point3d.create(4, 2, -1), Matrix3d.createScale(-3, -2, 5));
  const ray3 = ray.clone();
  const ray3A = ray.clone(Ray3d.createZero());
  const ray4 = ray.cloneTransformed(transform);
  ck.testTrue(ray3.isAlmostEqual(ray), "clone");
  ck.testTrue(ray3A.isAlmostEqual(ray), "clone");
  ck.testFalse(ray4.isAlmostEqual(ray), "clone Transformed");

  for (const f of [0.5, 1, -1]) {
    const pointF = ray1.fractionToPoint(f);
    const fractionOut = ray1.pointToFraction(pointF);
    ck.testCoordinate(f, fractionOut);
    const pointF4 = ray4.fractionToPoint(f);
    ck.testPoint3d(pointF4, transform.multiplyPoint3d(pointF), "transform*ray");

    const pointF1 = ray1.projectPointToRay(pointF);
    ck.testPoint3d(pointF, pointF1, "fraction to point reprojects to same point");
    const frame = ray.toRigidZFrame();
    if (ck.testPointer(frame) && frame) {
      const localPoint = Point3d.create(0.3, 0.8, 5.7);
      const globalPoint = frame.multiplyPoint3d(localPoint);
      const distanceToRay = ray.distance(globalPoint);
      ck.testCoordinate(distanceToRay, localPoint.magnitudeXY(), " projection distance is inplane part");
    }

    const ray5 = Ray3d.createPointVectorNumber(pointA, directionA, 4.0, target);
    ck.testPoint3d(ray5.origin, pointA);
    ck.testVector3d(ray5.direction, directionA);
  }

  const ray2 = Ray3d.createStartEnd(pointA, pointB);
  const ray2A = Ray3d.createStartEnd(pointA, pointB, Ray3d.createZero());
  ck.testTrue(ray2.isAlmostEqual(ray));
  ck.testTrue(ray2A.isAlmostEqual(ray));

  const json2 = ray2.toJSON();
  const ray2B = Ray3d.fromJSON(json2);
  const ray2C = Ray3d.fromJSON();
  ck.testTrue(ray2.isAlmostEqual(ray2B), "json round trip");
  ck.testPointer(ray2C, "expect some default fromJSON");

}

describe("Ray3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const rayX = Ray3d.createXAxis();
    const rayY = Ray3d.createYAxis();
    const rayZ = Ray3d.createZAxis();
    ck.testPerpendicular(rayX.direction, rayY.direction);
    ck.testPerpendicular(rayX.direction, rayZ.direction);
    ck.testPerpendicular(rayY.direction, rayZ.direction);
    const ray0 = Ray3d.createZero();
    const rayQ = Ray3d.createXYZUVW(1, 2, 3, 4, 5, 6);
    const rayQ0 = Ray3d.createZero(rayQ);
    ck.testTrue(ray0.isAlmostEqual(rayQ0));
    ck.testTrue(ray0.isAlmostEqual(rayQ));

    const rayU = Ray3d.createXYZUVW(1, 2, 3, 4, 5, 6);
    ck.testTrue(rayU.trySetDirectionMagnitudeInPlace(2.0));
    ck.testCoordinate(2.0, rayU.direction.magnitude(), "ray direction with imposed magnitude");
    createRays(ck, undefined);
    createRays(ck, rayQ0);

    const nullray = Ray3d.createXYZUVW(1, 2, 3, 0, 0, 0);  // general origin, zero vector to trigger else branches ..
    nullray.toRigidZFrame();
    nullray.tryNormalizeInPlaceWithAreaWeight(0.0);
    nullray.tryNormalizeInPlaceWithAreaWeight(1.0);
    const spacePoint = Point3d.create(8, 10, 1);
    ck.testCoordinate(spacePoint.distance(nullray.origin), nullray.distance(spacePoint), "distance to null ray");

    ck.testFalse(nullray.trySetDirectionMagnitudeInPlace(), "trySetMagnnitude of nullray");
    expect(ck.getNumErrors()).equals(0);
  });
});
